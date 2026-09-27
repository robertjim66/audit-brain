import { requireAuth } from '@/lib/auth';
import { ok, withHandler, ApiError } from '@/lib/http';
import db from '@/lib/db';
import { assertProject } from '@/lib/audit/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ORDER: Record<string, number> = { diff: 0, unconfirmed: 1, match: 2 };

export const GET = withHandler(async (req, ctx) => {
  const auth = await requireAuth(req);
  const id = ctx.params.id;
  const conclusion = req.nextUrl.searchParams.get('conclusion') || 'all';
  const [prog]: any = await db.query('SELECT project_id FROM audit_check_program WHERE id=? AND del_flag=0', [id]);
  if (!prog.length) throw new ApiError(404, '核对记录不存在');
  await assertProject(prog[0].project_id, auth.userId);

  let sql = 'SELECT * FROM audit_check_item WHERE program_id=? AND del_flag=0';
  const params: any[] = [id];
  if (conclusion && conclusion !== 'all') {
    sql += ' AND conclusion=?';
    params.push(conclusion);
  }
  sql += ' ORDER BY CASE conclusion WHEN "diff" THEN 0 WHEN "unconfirmed" THEN 1 ELSE 2 END, ABS(COALESCE(diff_amount,0)) DESC LIMIT 2000';

  const [rows]: any = await db.query(sql, params);
  const list = rows.map((r: any) => {
    let evidence: any = {};
    try { evidence = JSON.parse(r.evidence_json || '{}'); } catch {}
    const { evidence_json, ...rest } = r;
    return { ...rest, evidence };
  });
  return ok(list);
});
