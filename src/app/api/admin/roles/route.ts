import { requireAdmin } from '@/lib/auth';
import { ok, withHandler, ApiError } from '@/lib/http';
import db from '@/lib/db';
import snowflake from '@/lib/snowflake';
import { ensureRoleTables } from '@/lib/admin/ensure';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withHandler(async (req) => {
  await requireAdmin(req);
  await ensureRoleTables();
  const [rows]: any = await db.query(`
    SELECT r.id, r.role_name, r.role_code, r.description, r.status, r.sort_no,
           COUNT(ur.user_id) AS user_count,
           GROUP_CONCAT(rm.menu_id ORDER BY rm.menu_id SEPARATOR ',') AS menu_ids
    FROM sl_sys_role r
    LEFT JOIN sl_sys_user_role ur ON ur.role_id = r.id
    LEFT JOIN sl_sys_role_menu rm ON rm.role_id = r.id
    WHERE r.del_flag = 0
    GROUP BY r.id
    ORDER BY r.sort_no, r.id
  `);
  return ok(rows.map((r: any) => ({
    ...r, id: String(r.id),
    menu_ids: r.menu_ids ? r.menu_ids.split(',').map(Number) : [],
  })));
});

export const POST = withHandler(async (req) => {
  await requireAdmin(req);
  await ensureRoleTables();
  const body = await req.json().catch(() => ({}));
  const { role_name, role_code, description, status, sort_no } = body || {};
  if (!role_name || !role_name.trim()) throw new ApiError(400, '角色名称不能为空');
  if (!role_code || !/^[A-Z_]+$/.test(role_code.trim().toUpperCase())) throw new ApiError(400, '角色标识只能为大写字母和下划线');
  const code = role_code.trim().toUpperCase();
  const [dup]: any = await db.query('SELECT id FROM sl_sys_role WHERE role_code = ? AND del_flag = 0', [code]);
  if (dup.length) throw new ApiError(400, '角色标识已存在');

  const id = snowflake.nextId();
  await db.query(
    'INSERT INTO sl_sys_role (id, role_name, role_code, description, status, sort_no) VALUES (?, ?, ?, ?, ?, ?)',
    [id, role_name.trim(), code, description || null, status !== undefined ? (status ? 1 : 0) : 1, sort_no || 0]
  );
  return ok({ success: true, id: String(id) });
});
