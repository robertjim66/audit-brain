import { requireAdmin } from '@/lib/auth';
import { ok, withHandler, ApiError } from '@/lib/http';
import db from '@/lib/db';
import { ensureMenuTables } from '@/lib/admin/ensure';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withHandler(async (req) => {
  await requireAdmin(req);
  await ensureMenuTables();
  const [rows]: any = await db.query('SELECT * FROM sl_sys_menu ORDER BY parent_id, sort_no');
  return ok(rows);
});

export const POST = withHandler(async (req) => {
  await requireAdmin(req);
  await ensureMenuTables();
  const body = await req.json().catch(() => ({}));
  const { page_key, menu_name, menu_icon, menu_url, sort_no, parent_id, menu_type, perm_key } = body || {};
  if (!menu_name || !menu_name.trim()) throw new ApiError(400, '名称不能为空');
  const type = Number(menu_type) === 1 ? 1 : 0;
  if (type === 0 && (!menu_url || !menu_url.trim())) throw new ApiError(400, '菜单页面路径不能为空');
  if (type === 1 && (!perm_key || !perm_key.trim())) throw new ApiError(400, '按钮权限标识不能为空');

  const key = page_key || `custom_${Date.now()}`;
  const pid = Number(parent_id) || 0;
  await db.query(
    `INSERT INTO sl_sys_menu (page_key, menu_name, menu_icon, menu_url, sort_no, is_enabled, is_builtin, parent_id, menu_type, perm_key)
     VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?, ?)`,
    [key, menu_name.trim().slice(0, 30), menu_icon || (type === 1 ? '🔘' : '📄'),
     menu_url ? menu_url.trim() : '', sort_no || 99, pid, type, perm_key ? perm_key.trim().slice(0, 60) : null]
  );
  return ok({ success: true });
});
