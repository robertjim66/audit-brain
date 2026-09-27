import { requireAuth, requireAdmin } from '@/lib/auth';
import { ok, withHandler, ApiError } from '@/lib/http';
import db from '@/lib/db';
import snowflake from '@/lib/snowflake';
import bcrypt from 'bcryptjs';
import { ensureIsAdminColumn } from '@/lib/admin/ensure';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withHandler(async (req) => {
  await requireAdmin(req);
  await ensureIsAdminColumn();
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') || '') || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.nextUrl.searchParams.get('page_size') || '') || 20));
  const offset = (page - 1) * pageSize;
  const keyword = (req.nextUrl.searchParams.get('keyword') || '').trim();

  const where = ['u.del_flag = 0'];
  const params: any[] = [];
  if (keyword) {
    where.push('(u.username LIKE ? OR u.nickname LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`);
  }
  const [countRows]: any = await db.query(`SELECT COUNT(*) AS total FROM sl_sys_user u WHERE ${where.join(' AND ')}`, params);
  const [rows]: any = await db.query(
    `SELECT u.id, u.username, u.nickname, u.email, u.is_admin, u.created_at,
            GROUP_CONCAT(r.role_name ORDER BY r.sort_no SEPARATOR ',') AS role_names,
            GROUP_CONCAT(r.id ORDER BY r.sort_no SEPARATOR ',') AS role_ids
     FROM sl_sys_user u
     LEFT JOIN sl_sys_user_role ur ON ur.user_id = u.id
     LEFT JOIN sl_sys_role r ON r.id = ur.role_id AND r.del_flag = 0 AND r.status = 1
     WHERE ${where.join(' AND ')}
     GROUP BY u.id
     ORDER BY u.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  return ok({
    list: rows.map((r: any) => ({
      ...r, id: String(r.id),
      role_names: r.role_names ? r.role_names.split(',') : [],
      role_ids: r.role_ids ? r.role_ids.split(',').map(String) : [],
    })),
    total: countRows[0].total, page, page_size: pageSize,
  });
});

export const POST = withHandler(async (req) => {
  await requireAdmin(req);
  await ensureIsAdminColumn();
  const body = await req.json().catch(() => ({}));
  const { username, password, nickname, is_admin } = body || {};
  if (!username || typeof username !== 'string' || !username.trim()) throw new ApiError(400, '用户名不能为空');
  if (!password || password.length < 6) throw new ApiError(400, '密码不能少于6位');
  if (password.length > 50) throw new ApiError(400, '密码不能超过50位');
  const cleanUsername = username.trim().slice(0, 30);
  const [exists]: any = await db.query('SELECT id FROM sl_sys_user WHERE username = ? AND del_flag = 0', [cleanUsername]);
  if (exists.length) throw new ApiError(400, '用户名已存在');

  const userId = snowflake.nextId();
  const hashed = await bcrypt.hash(password, 10);
  const auth = await requireAuth(req);
  await db.query(
    'INSERT INTO sl_sys_user (id, username, password, nickname, is_admin, created_by) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, cleanUsername, hashed, (nickname || cleanUsername).slice(0, 20), is_admin ? 1 : 0, auth.userId]
  );
  return ok({ success: true, id: String(userId) });
});
