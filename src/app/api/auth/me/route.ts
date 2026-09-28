import { withHandler, readJson, ApiError } from '@/lib/http';
import { requireAuth } from '@/lib/auth';
import db from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/auth/me —— 当前登录用户信息
export const GET = withHandler(async (req) => {
  const auth = await requireAuth(req);
  const [users]: any = await db.query(
    'SELECT id, username, nickname, avatar, email, is_admin, created_at FROM sl_sys_user WHERE id = ? AND del_flag = 0',
    [auth.userId]
  );
  if (users.length === 0) throw new ApiError(401, '用户不存在');
  const u = users[0];
  return Response.json({ ...u, id: String(u.id), is_admin: u.is_admin === 1 });
});

// PUT /api/auth/me —— 修改本人资料（仅 nickname / email，username 不可改）
export const PUT = withHandler(async (req) => {
  const auth = await requireAuth(req);
  const body = await readJson<{ nickname?: string; email?: string | null }>(req);

  const sets: string[] = [];
  const params: any[] = [];

  if (body && Object.prototype.hasOwnProperty.call(body, 'nickname')) {
    const nickname = String(body.nickname ?? '').trim();
    if (!nickname) throw new ApiError(400, '昵称不能为空');
    if (nickname.length > 50) throw new ApiError(400, '昵称长度不能超过 50 个字符');
    sets.push('nickname = ?');
    params.push(nickname);
  }

  if (body && Object.prototype.hasOwnProperty.call(body, 'email')) {
    // 空串视为清空邮箱；非空时做基本格式校验
    const raw = body.email == null ? '' : String(body.email).trim();
    if (raw) {
      if (raw.length > 100) throw new ApiError(400, '邮箱长度不能超过 100 个字符');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) throw new ApiError(400, '邮箱格式不正确');
    }
    sets.push('email = ?');
    params.push(raw || null);
  }

  if (!sets.length) throw new ApiError(400, '没有可更新字段');

  sets.push('updated_by = ?');
  params.push(auth.userId);
  params.push(auth.userId);
  await db.query(`UPDATE sl_sys_user SET ${sets.join(', ')} WHERE id = ? AND del_flag = 0`, params);

  const [users]: any = await db.query(
    'SELECT id, username, nickname, avatar, email, is_admin, created_at FROM sl_sys_user WHERE id = ? AND del_flag = 0',
    [auth.userId]
  );
  if (users.length === 0) throw new ApiError(401, '用户不存在');
  const u = users[0];
  return Response.json({ ...u, id: String(u.id), is_admin: u.is_admin === 1 });
});
