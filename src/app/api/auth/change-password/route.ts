import { withHandler, readJson, ApiError } from '@/lib/http';
import { requireAuth, comparePassword, hashPassword } from '@/lib/auth';
import db from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withHandler(async (req) => {
  const auth = await requireAuth(req);
  const { old_password, new_password } = await readJson<{ old_password?: string; new_password?: string }>(req);
  if (!old_password || !new_password) throw new ApiError(400, '请填写完整信息');
  if (new_password.length < 6 || new_password.length > 50) throw new ApiError(400, '新密码长度需 6-50 个字符');

  const [users]: any = await db.query('SELECT * FROM sl_sys_user WHERE id = ? AND del_flag = 0', [auth.userId]);
  if (users.length === 0) throw new ApiError(404, '用户不存在');
  const valid = await comparePassword(old_password, users[0].password);
  if (!valid) throw new ApiError(400, '原密码不正确');

  const hashed = await hashPassword(new_password);
  await db.query('UPDATE sl_sys_user SET password = ? WHERE id = ?', [hashed, auth.userId]);
  return Response.json({ success: true });
});
