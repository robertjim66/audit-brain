import { requireAdmin } from '@/lib/auth';
import { ok, withHandler } from '@/lib/http';
import db from '@/lib/db';
import { ensureMenuTables } from '@/lib/admin/ensure';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 只读：菜单数据由 SQL 种子维护，角色管理页据此渲染「配置菜单权限」菜单树。
// 菜单本身不提供增删改入口。
export const GET = withHandler(async (req) => {
  await requireAdmin(req);
  await ensureMenuTables();
  const [rows]: any = await db.query('SELECT * FROM sl_sys_menu ORDER BY parent_id, sort_no');
  return ok(rows);
});
