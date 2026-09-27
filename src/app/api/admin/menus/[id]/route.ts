import { requireAdmin } from '@/lib/auth';
import { ok, withHandler, ApiError } from '@/lib/http';
import db from '@/lib/db';
import { ensureMenuTables } from '@/lib/admin/ensure';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PUT = withHandler(async (req, ctx) => {
  await requireAdmin(req);
  await ensureMenuTables();
  const [rows]: any = await db.query('SELECT id FROM sl_sys_menu WHERE id = ?', [ctx.params.id]);
  if (!rows.length) throw new ApiError(404, '菜单不存在');
  const body = await req.json().catch(() => ({}));
  const { menu_name, menu_icon, menu_url, sort_no, is_enabled, parent_id, menu_type, perm_key } = body || {};
  const updates: string[] = [];
  const vals: any[] = [];
  if (menu_name !== undefined) { updates.push('menu_name = ?'); vals.push(String(menu_name).trim().slice(0, 30)); }
  if (menu_icon !== undefined) { updates.push('menu_icon = ?'); vals.push(String(menu_icon).slice(0, 20)); }
  if (menu_url !== undefined) { updates.push('menu_url = ?'); vals.push(String(menu_url).trim().slice(0, 100)); }
  if (sort_no !== undefined) { updates.push('sort_no = ?'); vals.push(Number(sort_no) || 0); }
  if (is_enabled !== undefined) { updates.push('is_enabled = ?'); vals.push(is_enabled ? 1 : 0); }
  if (parent_id !== undefined) { updates.push('parent_id = ?'); vals.push(Number(parent_id) || 0); }
  if (menu_type !== undefined) { updates.push('menu_type = ?'); vals.push(Number(menu_type) === 1 ? 1 : 0); }
  if (perm_key !== undefined) { updates.push('perm_key = ?'); vals.push(perm_key ? String(perm_key).trim().slice(0, 60) : null); }
  if (!updates.length) throw new ApiError(400, '没有要更新的字段');
  vals.push(ctx.params.id);
  await db.query(`UPDATE sl_sys_menu SET ${updates.join(', ')} WHERE id = ?`, vals);
  return ok({ success: true });
});

export const DELETE = withHandler(async (req, ctx) => {
  await requireAdmin(req);
  await ensureMenuTables();
  const [rows]: any = await db.query('SELECT id, is_builtin FROM sl_sys_menu WHERE id = ?', [ctx.params.id]);
  if (!rows.length) throw new ApiError(404, '菜单不存在');
  if (rows[0].is_builtin) throw new ApiError(400, '内置菜单不可删除');
  const [children]: any = await db.query('SELECT id FROM sl_sys_menu WHERE parent_id = ?', [ctx.params.id]);
  if (children.length) {
    const childIds = children.map((r: any) => r.id);
    await db.query('DELETE FROM sl_sys_role_menu WHERE menu_id IN (?)', [childIds]);
    await db.query('DELETE FROM sl_sys_menu WHERE parent_id = ?', [ctx.params.id]);
  }
  await db.query('DELETE FROM sl_sys_menu WHERE id = ?', [ctx.params.id]);
  await db.query('DELETE FROM sl_sys_role_menu WHERE menu_id = ?', [ctx.params.id]);
  return ok({ success: true });
});
