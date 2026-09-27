import { requireAdmin } from '@/lib/auth';
import { ok, withHandler, ApiError } from '@/lib/http';
import db from '@/lib/db';
import bcrypt from 'bcryptjs';
import { ensureIsAdminColumn } from '@/lib/admin/ensure';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withHandler(async (req, ctx) => {
  await requireAdmin(req);
  await ensureIsAdminColumn();
  const body = await req.json().catch(() => ({}));
  const { newPassword } = body || {};
  if (!newPassword || newPassword.length < 6) throw new ApiError(400, '新密码不能少于6位');
  if (newPassword.length > 50) throw new ApiError(400, '密码不能超过50位');

  const [rows]: any = await db.query('SELECT id, is_admin FROM sl_sys_user WHERE id = ? AND del_flag = 0', [ctx.params.id]);
  if (!rows.length) throw new ApiError(404, '用户不存在');
  if (rows[0].is_admin) throw new ApiError(400, '超级管理员密码不可通过此接口重置');

  const hashed = await bcrypt.hash(newPassword, 10);
  await db.query('UPDATE sl_sys_user SET password = ? WHERE id = ?', [hashed, ctx.params.id]);
  return ok({ success: true });
});
