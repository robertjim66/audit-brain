import { requireAuth, requireAdmin } from '@/lib/auth';
import { ok, withHandler, ApiError } from '@/lib/http';
import db from '@/lib/db';
import { ensureIsAdminColumn } from '@/lib/admin/ensure';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PUT = withHandler(async (req, ctx) => {
  await requireAdmin(req);
  await ensureIsAdminColumn();
  const targetId = ctx.params.id;
  const body = await req.json().catch(() => ({}));
  const { nickname, email, is_admin } = body || {};
  const [rows]: any = await db.query('SELECT id, is_admin FROM sl_sys_user WHERE id = ? AND del_flag = 0', [targetId]);
  if (!rows.length) throw new ApiError(404, '用户不存在');
  const target = rows[0];

  if (target.is_admin && is_admin !== undefined) throw new ApiError(400, '超级管理员权限不可通过此接口修改');
  const auth = await requireAuth(req);
  if (String(targetId) === String(auth.userId) && is_admin === 0) throw new ApiError(400, '不能取消自己的超管权限');

  const updates: string[] = [];
  const vals: any[] = [];
  if (nickname !== undefined) { updates.push('nickname = ?'); vals.push(String(nickname).trim().slice(0, 20)); }
  if (email !== undefined) { updates.push('email = ?'); vals.push(email || null); }
  if (is_admin !== undefined && !target.is_admin) { updates.push('is_admin = ?'); vals.push(is_admin ? 1 : 0); }
  if (!updates.length) throw new ApiError(400, '没有要更新的字段');

  vals.push(targetId);
  await db.query(`UPDATE sl_sys_user SET ${updates.join(', ')} WHERE id = ?`, vals);
  return ok({ success: true });
});

export const DELETE = withHandler(async (req, ctx) => {
  await requireAdmin(req);
  await ensureIsAdminColumn();
  const targetId = ctx.params.id;
  const auth = await requireAuth(req);
  if (String(targetId) === String(auth.userId)) throw new ApiError(400, '不能删除自己的账号');
  const [rows]: any = await db.query('SELECT id, is_admin FROM sl_sys_user WHERE id = ? AND del_flag = 0', [targetId]);
  if (!rows.length) throw new ApiError(404, '用户不存在');
  if (rows[0].is_admin) throw new ApiError(400, '超级管理员账号不可删除');
  await db.query('UPDATE sl_sys_user SET del_flag = 1 WHERE id = ?', [targetId]);
  return ok({ success: true });
});
