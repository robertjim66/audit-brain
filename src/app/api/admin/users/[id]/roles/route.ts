import { requireAdmin } from '@/lib/auth';
import { ok, withHandler, ApiError } from '@/lib/http';
import db from '@/lib/db';
import { ensureRoleTables } from '@/lib/admin/ensure';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withHandler(async (req, ctx) => {
  await requireAdmin(req);
  await ensureRoleTables();
  const targetId = ctx.params.id;
  const body = await req.json().catch(() => ({}));
  const { role_ids } = body || {};
  if (!Array.isArray(role_ids)) throw new ApiError(400, 'role_ids 必须为数组');

  const [rows]: any = await db.query('SELECT id FROM sl_sys_user WHERE id = ? AND del_flag = 0', [targetId]);
  if (!rows.length) throw new ApiError(404, '用户不存在');

  await db.query('DELETE FROM sl_sys_user_role WHERE user_id = ?', [targetId]);
  for (const roleId of role_ids) {
    await db.query('INSERT IGNORE INTO sl_sys_user_role (user_id, role_id) VALUES (?, ?)', [targetId, roleId]);
  }
  return ok({ success: true });
});
