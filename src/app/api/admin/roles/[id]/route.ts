import { requireAdmin } from '@/lib/auth';
import { ok, withHandler, ApiError } from '@/lib/http';
import db from '@/lib/db';
import { ensureRoleTables } from '@/lib/admin/ensure';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PUT = withHandler(async (req, ctx) => {
  await requireAdmin(req);
  await ensureRoleTables();
  const [rows]: any = await db.query('SELECT id FROM sl_sys_role WHERE id = ? AND del_flag = 0', [ctx.params.id]);
  if (!rows.length) throw new ApiError(404, '角色不存在');
  const body = await req.json().catch(() => ({}));
  const { role_name, description, status, sort_no } = body || {};
  const updates: string[] = [];
  const vals: any[] = [];
  if (role_name !== undefined) { updates.push('role_name = ?'); vals.push(String(role_name).trim().slice(0, 30)); }
  if (description !== undefined) { updates.push('description = ?'); vals.push(description || null); }
  if (status !== undefined) { updates.push('status = ?'); vals.push(status ? 1 : 0); }
  if (sort_no !== undefined) { updates.push('sort_no = ?'); vals.push(Number(sort_no) || 0); }
  if (!updates.length) throw new ApiError(400, '没有要更新的字段');
  vals.push(ctx.params.id);
  await db.query(`UPDATE sl_sys_role SET ${updates.join(', ')} WHERE id = ?`, vals);
  return ok({ success: true });
});

export const DELETE = withHandler(async (req, ctx) => {
  await requireAdmin(req);
  await ensureRoleTables();
  if (ctx.params.id === '1' || ctx.params.id === '2') throw new ApiError(400, '预置角色不可删除');
  const [rows]: any = await db.query('SELECT id FROM sl_sys_role WHERE id = ? AND del_flag = 0', [ctx.params.id]);
  if (!rows.length) throw new ApiError(404, '角色不存在');
  await db.query('UPDATE sl_sys_role SET del_flag = 1 WHERE id = ?', [ctx.params.id]);
  await db.query('DELETE FROM sl_sys_user_role WHERE role_id = ?', [ctx.params.id]);
  await db.query('DELETE FROM sl_sys_role_menu WHERE role_id = ?', [ctx.params.id]);
  return ok({ success: true });
});
