import { requireAuth } from '@/lib/auth';
import { ok, withHandler, ApiError, readJson } from '@/lib/http';
import db from '@/lib/db';
import { assertProject } from '@/lib/audit/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUSES = new Set(['open', 'confirmed', 'misreport', 'closed']);

export const PATCH = withHandler(async (req, ctx) => {
  const auth = await requireAuth(req);
  const id = ctx.params.id;
  const body = await readJson<{ status?: string; remark?: string }>(req);
  if (!body.status || !STATUSES.has(body.status)) throw new ApiError(400, '无效的 status，应为 open/confirmed/misreport/closed');
  const [rows]: any = await db.query('SELECT project_id FROM audit_finding WHERE id=? AND del_flag=0', [id]);
  if (!rows.length) throw new ApiError(404, '疑点不存在');
  await assertProject(rows[0].project_id, auth.userId);

  // remark 只在请求显式携带时更新：改状态不应抹掉已有的处置意见
  if (typeof body.remark === 'string') {
    await db.query(
      'UPDATE audit_finding SET status=?, remark=?, updated_by=? WHERE id=?',
      [body.status, body.remark.slice(0, 500), auth.userId, id]
    );
  } else {
    await db.query(
      'UPDATE audit_finding SET status=?, updated_by=? WHERE id=?',
      [body.status, auth.userId, id]
    );
  }
  const [updated]: any = await db.query('SELECT * FROM audit_finding WHERE id=?', [id]);
  let ev: any = {};
  try { ev = JSON.parse(updated[0].evidence_json || '{}'); } catch {}
  const { evidence_json, ...rest } = updated[0];
  return ok({ ...rest, evidence: ev, amount: ev.amount != null ? ev.amount : null });
});
