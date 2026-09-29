import { requireAuth } from '@/lib/auth';
import { ok, withHandler, ApiError } from '@/lib/http';
import db from '@/lib/db';
import { assertProject } from '@/lib/audit/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const DELETE = withHandler(async (req, ctx) => {
  const auth = await requireAuth(req);
  const id = ctx.params.id;
  const [rows]: any = await db.query('SELECT project_id, status, title FROM audit_finding WHERE id=? AND del_flag=0', [id]);
  if (!rows.length) throw new ApiError(404, '疑点不存在');
  await assertProject(rows[0].project_id, auth.userId);

  // 已处置的疑点属于审计结论，删除等于销毁工作底稿；需先改回「待处理」
  if (String(rows[0].status) !== 'open') {
    throw new ApiError(400, `「${rows[0].title}」已处置，不能删除；如需删除请先将其状态改回「待处理」`);
  }
  await db.query('UPDATE audit_finding SET del_flag=1 WHERE id=?', [id]);
  return ok({ success: true });
});
