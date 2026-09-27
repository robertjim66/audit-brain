import { requireAuth, requireAdmin } from '@/lib/auth';
import { ok, withHandler, ApiError } from '@/lib/http';
import db from '@/lib/db';
import { ensureDictTable } from '@/lib/admin/ensure';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 按类型获取启用状态的字典项（供任意已登录页面消费）
export const GET = withHandler(async (req, ctx) => {
  await requireAuth(req);
  await ensureDictTable();
  const [rows]: any = await db.query(
    `SELECT id, dict_type, dict_code, dict_label, dict_icon, sort_order
     FROM sl_sys_dict WHERE dict_type = ? AND status = 1 AND del_flag = 0 ORDER BY sort_order ASC`,
    [ctx.params.id]
  );
  return ok(rows);
});

export const PUT = withHandler(async (req, ctx) => {
  await requireAdmin(req);
  await ensureDictTable();
  const [rows]: any = await db.query('SELECT id FROM sl_sys_dict WHERE id = ? AND del_flag = 0', [ctx.params.id]);
  if (!rows.length) throw new ApiError(404, '字典项不存在');
  const body = await req.json().catch(() => ({}));
  const { dict_label, dict_icon, sort_order, status } = body || {};
  const updates: string[] = [];
  const vals: any[] = [];
  if (dict_label !== undefined) {
    if (!String(dict_label).trim()) throw new ApiError(400, '字典名称不能为空');
    updates.push('dict_label = ?'); vals.push(String(dict_label).trim().slice(0, 100));
  }
  if (dict_icon !== undefined) { updates.push('dict_icon = ?'); vals.push(dict_icon ? String(dict_icon).slice(0, 20) : null); }
  if (sort_order !== undefined) { updates.push('sort_order = ?'); vals.push(Number(sort_order) || 0); }
  if (status !== undefined) { updates.push('status = ?'); vals.push(status ? 1 : 0); }
  if (!updates.length) throw new ApiError(400, '没有要更新的字段');
  vals.push(ctx.params.id);
  await db.query(`UPDATE sl_sys_dict SET ${updates.join(', ')} WHERE id = ?`, vals);
  return ok({ success: true });
});

export const DELETE = withHandler(async (req, ctx) => {
  await requireAdmin(req);
  await ensureDictTable();
  const [rows]: any = await db.query('SELECT id FROM sl_sys_dict WHERE id = ? AND del_flag = 0', [ctx.params.id]);
  if (!rows.length) throw new ApiError(404, '字典项不存在');
  await db.query('UPDATE sl_sys_dict SET del_flag = 1 WHERE id = ?', [ctx.params.id]);
  return ok({ success: true });
});
