import { requireAuth } from '@/lib/auth';
import { ok, withHandler, ApiError } from '@/lib/http';
import db from '@/lib/db';
import { assertProject } from '@/lib/audit/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const DELETE = withHandler(async (req, ctx) => {
  const auth = await requireAuth(req);
  const id = ctx.params.id;
  const [rows]: any = await db.query('SELECT project_id FROM audit_finding WHERE id=? AND del_flag=0', [id]);
  if (!rows.length) throw new ApiError(404, '疑点不存在');
  await assertProject(rows[0].project_id, auth.userId);
  await db.query('UPDATE audit_finding SET del_flag=1 WHERE id=?', [id]);
  return ok({ success: true });
});
