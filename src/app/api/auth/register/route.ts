import { withHandler, readJson, ApiError } from '@/lib/http';
import { signToken, hashPassword, isAdmin } from '@/lib/auth';
import { verifyCaptcha } from '@/lib/captcha';
import db from '@/lib/db';
import snowflake from '@/lib/snowflake';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function validateUsername(u: string): string | null {
  if (!u || typeof u !== 'string') return '请输入用户名';
  if (u.length < 3 || u.length > 20) return '用户名长度需 3-20 个字符';
  if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(u)) return '用户名只能包含字母、数字、下划线、中文';
  return null;
}
function validatePassword(p: string): string | null {
  if (!p || typeof p !== 'string') return '请输入密码';
  if (p.length < 6 || p.length > 50) return '密码长度需 6-50 个字符';
  return null;
}

export const POST = withHandler(async (req) => {
  const { username, password, nickname, captchaCode, captchaToken } = await readJson<{
    username?: string; password?: string; nickname?: string; captchaCode?: string; captchaToken?: string;
  }>(req);

  // 先过验证码：挡住机器批量注册
  const cap = verifyCaptcha(captchaCode, captchaToken);
  if (!cap.ok) {
    throw new ApiError(400, cap.reason === 'missing' ? '请输入图形验证码' : '验证码错误或已失效，请点击图片刷新');
  }

  const err = validateUsername(username || '') || validatePassword(password || '') || (!nickname || !nickname.trim() ? '请输入昵称' : null);
  if (err) throw new ApiError(400, err);

  const [existing]: any = await db.query('SELECT id FROM sl_sys_user WHERE username = ?', [username]);
  if (existing.length > 0) throw new ApiError(400, '用户名已存在');

  const hashed = await hashPassword(password!);
  const userId = snowflake.nextId();
  await db.query(
    'INSERT INTO sl_sys_user (id, username, password, nickname, created_by) VALUES (?, ?, ?, ?, ?)',
    [userId, username, hashed, nickname?.trim() || username, userId]
  );

  const token = signToken(userId, username!);
  const adminFlag = await isAdmin(userId);
  return Response.json({
    token,
    is_admin: adminFlag,
    user: { id: userId, username, nickname: nickname?.trim(), is_admin: adminFlag },
  });
});
