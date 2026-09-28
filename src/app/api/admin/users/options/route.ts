import { requireAdmin } from '@/lib/auth';
import { ok, withHandler } from '@/lib/http';
import db from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/users/options —— 可指派用户下拉列表。
 * 供项目成员分配使用：只暴露 id/username/nickname，不含邮箱等联系方式。
 */
export const GET = withHandler(async (req) => {
  await requireAdmin(req);
  const keyword = new URL(req.url).searchParams.get('keyword')?.trim() || '';
  const params: any[] = [];
  let where = 'del_flag = 0';
  if (keyword) {
    where += ' AND (username LIKE ? OR nickname LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }
  const [rows]: any = await db.query(
    `SELECT id, username, nickname, is_admin FROM sl_sys_user
     WHERE ${where} ORDER BY is_admin DESC, username ASC LIMIT 100`,
    params
  );
  return ok(rows.map((r: any) => ({ ...r, id: String(r.id), is_admin: r.is_admin === 1 })));
});
