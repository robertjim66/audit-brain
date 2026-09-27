import { withHandler, ApiError } from '@/lib/http';
import { requireAuth } from '@/lib/auth';
import db from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withHandler(async (req) => {
  const auth = await requireAuth(req);
  const [users]: any = await db.query(
    'SELECT id, username, nickname, avatar, email, is_admin FROM sl_sys_user WHERE id = ? AND del_flag = 0',
    [auth.userId]
  );
  if (users.length === 0) throw new ApiError(401, '用户不存在');
  const u = users[0];
  return Response.json({ ...u, id: String(u.id), is_admin: u.is_admin === 1 });
});
