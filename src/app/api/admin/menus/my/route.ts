import { requireAuth, isAdmin } from '@/lib/auth';
import { ok, withHandler } from '@/lib/http';
import db from '@/lib/db';
import { ensureMenuTables } from '@/lib/admin/ensure';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withHandler(async (req) => {
  const auth = await requireAuth(req);
  await ensureMenuTables();
  const adminFlag = await isAdmin(auth.userId);
  if (adminFlag) {
    const [rows]: any = await db.query('SELECT * FROM sl_sys_menu WHERE is_enabled = 1 ORDER BY sort_no');
    return ok(rows);
  }
  const [rows]: any = await db.query(
    `SELECT DISTINCT m.*
     FROM sl_sys_menu m
     INNER JOIN sl_sys_role_menu rm ON rm.menu_id = m.id
     INNER JOIN sl_sys_user_role ur ON ur.role_id = rm.role_id
     WHERE ur.user_id = ? AND m.is_enabled = 1
     ORDER BY m.sort_no`,
    [auth.userId]
  );
  if (rows.length === 0) {
    const [all]: any = await db.query('SELECT * FROM sl_sys_menu WHERE is_enabled = 1 AND menu_type = 0 ORDER BY sort_no');
    return ok(all);
  }
  return ok(rows);
});
