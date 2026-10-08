import { withHandler, readJson, ApiError } from '@/lib/http';
import { signToken, comparePassword, isAdmin } from '@/lib/auth';
import { verifyCaptcha } from '@/lib/captcha';
import db from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withHandler(async (req) => {
  const { username, password, captchaCode, captchaToken } = await readJson<{
    username?: string; password?: string; captchaCode?: string; captchaToken?: string;
  }>(req);

  // 先过验证码再验证密码：挡住拿同一个验证码反复撞库的路径
  const cap = verifyCaptcha(captchaCode, captchaToken);
  if (!cap.ok) {
    throw new ApiError(400, cap.reason === 'missing' ? '请输入图形验证码' : '验证码错误或已失效，请点击图片刷新');
  }

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
