import { requireAuth } from '@/lib/auth';
import { ok, withHandler, ApiError } from '@/lib/http';
import db from '@/lib/db';
import { assertProject } from '@/lib/audit/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TYPE_LABEL: Record<string, string> = {
  no_seal: '签章异常/三无签证', no_photo: '缺少影像资料', qty_diff: '量差异常',
  round_amount: '凑整金额', late_visa: '集中/竣工后签证', duplicate: '重复计量',
  invoice_serial: '连号发票', other: '其他',
};

function decode(row: any) {
  let ev: any = {};
  try { ev = JSON.parse(row.evidence_json || '{}'); } catch {}
  const amount = ev.amount != null ? ev.amount : null;
  const { evidence_json, ...rest } = row;
  return { ...rest, evidence: ev, amount, type_label: TYPE_LABEL[row.finding_type] || row.finding_type };
}

export const GET = withHandler(async (req) => {
  const auth = await requireAuth(req);
  const projectId = req.nextUrl.searchParams.get('project_id');
  if (!projectId) throw new ApiError(400, '缺少 project_id');
  await assertProject(projectId, auth.userId);

  const risk = req.nextUrl.searchParams.get('risk_level');
  const status = req.nextUrl.searchParams.get('status');
  const type = req.nextUrl.searchParams.get('finding_type');

  let sql = 'SELECT * FROM audit_finding WHERE project_id=? AND del_flag=0';
  const params: any[] = [projectId];
  if (risk) { sql += ' AND risk_level=?'; params.push(risk); }
  if (status) { sql += ' AND status=?'; params.push(status); }
  if (type) { sql += ' AND finding_type=?'; params.push(type); }
  sql += ' ORDER BY FIELD(risk_level,"high","mid","low"), id';

  const [rows]: any = await db.query(sql, params);
  const list = rows.map(decode);

  const [all]: any = await db.query(
    'SELECT risk_level, status, finding_type FROM audit_finding WHERE project_id=? AND del_flag=0',
    [projectId]
  );
  const summary: any = { total: all.length, high: 0, mid: 0, low: 0, open: 0, confirmed: 0, misreport: 0, closed: 0, byType: {} as Record<string, number> };
  for (const r of all) {
    summary[r.risk_level] = (summary[r.risk_level] || 0) + 1;
    summary[r.status] = (summary[r.status] || 0) + 1;
    summary.byType[r.finding_type] = (summary.byType[r.finding_type] || 0) + 1;
  }
  return ok({ summary, typeLabel: TYPE_LABEL, total: list.length, list });
});
