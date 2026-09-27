import { requireAuth, requireAdmin } from '@/lib/auth';
import { ok, withHandler, ApiError } from '@/lib/http';
import db from '@/lib/db';
import snowflake from '@/lib/snowflake';
import { ensureDictTable } from '@/lib/admin/ensure';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withHandler(async (req) => {
  await requireAdmin(req);
  await ensureDictTable();
  const type = req.nextUrl.searchParams.get('type');
  const where = ['del_flag = 0'];
  const params: any[] = [];
  if (type) { where.push('dict_type = ?'); params.push(type); }
  const [rows]: any = await db.query(
    `SELECT * FROM sl_sys_dict WHERE ${where.join(' AND ')} ORDER BY dict_type, sort_order ASC`, params
  );
  return ok(rows);
});

export const POST = withHandler(async (req) => {
  await requireAdmin(req);
  await ensureDictTable();
  const body = await req.json().catch(() => ({}));
  const { dict_type, dict_code, dict_label, dict_icon = '', sort_order = 0, status = 1 } = body || {};
  if (!dict_type || !dict_type.trim()) throw new ApiError(400, '字典类型不能为空');
  if (!dict_code || !dict_code.trim()) throw new ApiError(400, '字典编码不能为空');
  if (!dict_label || !dict_label.trim()) throw new ApiError(400, '字典名称不能为空');
  const [dup]: any = await db.query('SELECT id FROM sl_sys_dict WHERE dict_type = ? AND dict_code = ? AND del_flag = 0', [dict_type.trim(), dict_code.trim()]);
  if (dup.length) throw new ApiError(400, '该类型下已存在相同编码的字典项');

  const id = snowflake.nextId();
  const auth = await requireAuth(req);
  await db.query(
    `INSERT INTO sl_sys_dict (id, dict_type, dict_code, dict_label, dict_icon, sort_order, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, dict_type.trim().slice(0, 50), dict_code.trim().slice(0, 50), dict_label.trim().slice(0, 100),
     dict_icon ? String(dict_icon).slice(0, 20) : null, Number(sort_order) || 0, status ? 1 : 0, auth.userId]
  );
  return ok({ success: true, id: String(id) });
});
