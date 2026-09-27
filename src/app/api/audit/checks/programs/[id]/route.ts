import { requireAuth } from '@/lib/auth';
import { ok, withHandler, ApiError } from '@/lib/http';
import db from '@/lib/db';
import { assertProject } from '@/lib/audit/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const DELETE = withHandler(async (req, ctx) => {
  const auth = await requireAuth(req);
  const id = ctx.params.id;
  const [rows]: any = await db.query('SELECT project_id FROM audit_check_program WHERE id=? AND del_flag=0', [id]);
  if (!rows.length) throw new ApiError(404, '核对记录不存在');
  await assertProject(rows[0].project_id, auth.userId);
  await db.query('UPDATE audit_check_item SET del_flag=1 WHERE program_id=?', [id]);
  await db.query('UPDATE audit_check_program SET del_flag=1 WHERE id=?', [id]);
  return ok({ ok: true });
});
