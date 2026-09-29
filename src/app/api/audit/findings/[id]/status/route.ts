import { requireAuth } from '@/lib/auth';
import { ok, withHandler, ApiError, readJson } from '@/lib/http';
import db from '@/lib/db';
import { assertProject } from '@/lib/audit/guard';
import { recordDispose, latestHandlers, FINDING_STATUSES } from '@/lib/audit/dispose';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUSES = new Set<string>(FINDING_STATUSES);

export const PATCH = withHandler(async (req, ctx) => {
  const auth = await requireAuth(req);
  const id = ctx.params.id;
  const body = await readJson<{ status?: string; remark?: string }>(req);
  if (!body.status || !STATUSES.has(body.status)) {
    throw new ApiError(400, `无效的 status，应为 ${FINDING_STATUSES.join('/')}`);
  }
  const [rows]: any = await db.query(
    'SELECT id, project_id, finding_type, title, status, remark FROM audit_finding WHERE id=? AND del_flag=0',
    [id]
  );
  if (!rows.length) throw new ApiError(404, '疑点不存在');
  const finding = rows[0];
  await assertProject(finding.project_id, auth.userId);

  const prevStatus = String(finding.status || 'open');
  const nextStatus = body.status;
  const hasRemark = typeof body.remark === 'string';
  const remark = hasRemark ? String(body.remark).slice(0, 500) : null;

  // 状态未变且未提交新备注时不写流水，避免「点了同一个按钮」刷出无意义记录
  if (prevStatus === nextStatus && !(hasRemark && remark !== (finding.remark ?? ''))) {
    return ok({ ...(await loadOne(id)), unchanged: true });
  }

  // remark 只在请求显式携带时更新：改状态不应抹掉已有的处置意见
  if (hasRemark) {
    await db.query(
      'UPDATE audit_finding SET status=?, remark=?, updated_by=? WHERE id=?',
      [nextStatus, remark, auth.userId, id]
    );
  } else {
    await db.query(
      'UPDATE audit_finding SET status=?, updated_by=? WHERE id=?',
      [nextStatus, auth.userId, id]
    );
  }

  // 记录处理人：状态变更或补充备注都留痕
  await recordDispose({
    findingId: id,
    projectId: finding.project_id,
    findingType: finding.finding_type,
    title: finding.title,
    fromStatus: prevStatus,
    toStatus: nextStatus,
    operatorId: auth.userId,
    remark: hasRemark ? remark : finding.remark,
  });

  return ok(await loadOne(id));
});

/** 读取单条疑点（已解码 evidence、附带最近处理人）。 */
async function loadOne(id: string) {
  const [rows]: any = await db.query('SELECT * FROM audit_finding WHERE id=?', [id]);
  const row = rows[0];
  let ev: any = {};
  try { ev = JSON.parse(row.evidence_json || '{}'); } catch {}
  const { evidence_json, ...rest } = row;
  const handlers = await latestHandlers([String(id)]);
  return { ...rest, evidence: ev, amount: ev.amount != null ? ev.amount : null, handler: handlers[String(id)] || null };
}
