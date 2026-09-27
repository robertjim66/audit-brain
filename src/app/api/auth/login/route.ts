import { withHandler, readJson, ApiError } from '@/lib/http';
import { signToken, comparePassword, isAdmin } from '@/lib/auth';
import db from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withHandler(async (req) => {
  const { username, password } = await readJson<{ username?: string; password?: string }>(req);
  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    throw new ApiError(400, '请输入用户名和密码');
  }
  const [users]: any = await db.query(
    'SELECT * FROM sl_sys_user WHERE username = ? AND del_flag = 0',
    [username]
  );
  if (users.length === 0) throw new ApiError(400, '用户名或密码错误');
  const user = users[0];
  const valid = await comparePassword(password, user.password);
  if (!valid) throw new ApiError(400, '用户名或密码错误');

  const token = signToken(String(user.id), user.username);
  const adminFlag = await isAdmin(String(user.id));
  return Response.json({
    token,
    is_admin: adminFlag,
    user: { id: String(user.id), username: user.username, nickname: user.nickname, is_admin: adminFlag },
  });
});
