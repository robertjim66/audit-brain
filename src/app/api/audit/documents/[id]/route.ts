import { requireAuth } from '@/lib/auth';
import { ok, fail, withHandler, ApiError } from '@/lib/http';
import db from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withHandler(async (req, ctx) => {
  await requireAuth(req);
  const [rows]: any = await db.query('SELECT * FROM audit_document WHERE id=? AND del_flag=0', [ctx.params.id]);
  if (rows.length === 0) throw new ApiError(404, '资料不存在');
  return ok(rows[0]);
});

export const DELETE = withHandler(async (req, ctx) => {
  await requireAuth(req);
  await db.query('UPDATE audit_document SET del_flag=1 WHERE id=?', [ctx.params.id]);
  await db.query('UPDATE audit_element SET del_flag=1 WHERE document_id=?', [ctx.params.id]);
  return ok({ success: true });
});
