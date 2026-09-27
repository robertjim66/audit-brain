import { requireAdmin } from '@/lib/auth';
import { ok, withHandler, ApiError } from '@/lib/http';
import db from '@/lib/db';
import { ensureRoleTables } from '@/lib/admin/ensure';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PUT = withHandler(async (req, ctx) => {
  await requireAdmin(req);
  await ensureRoleTables();
  const body = await req.json().catch(() => ({}));
  const { menu_ids } = body || {};
  if (!Array.isArray(menu_ids)) throw new ApiError(400, 'menu_ids 必须为数组');
  const [rows]: any = await db.query('SELECT id FROM sl_sys_role WHERE id = ? AND del_flag = 0', [ctx.params.id]);
  if (!rows.length) throw new ApiError(404, '角色不存在');
  await db.query('DELETE FROM sl_sys_role_menu WHERE role_id = ?', [ctx.params.id]);
  for (const menuId of menu_ids) {
    await db.query('INSERT IGNORE INTO sl_sys_role_menu (role_id, menu_id) VALUES (?, ?)', [ctx.params.id, menuId]);
  }
  return ok({ success: true });
});
