import { requireAuth } from '@/lib/auth';
import { ok, withHandler } from '@/lib/http';
import db from '@/lib/db';
import { assertDocument } from '@/lib/audit/guard';
import { invalidateProject } from '@/lib/audit/agent/projectStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withHandler(async (req, ctx) => {
  const auth = await requireAuth(req);
  await assertDocument(ctx.params.id, auth.userId);
  const [rows]: any = await db.query('SELECT * FROM audit_document WHERE id=? AND del_flag=0', [ctx.params.id]);
  return ok(rows[0]);
});

export const DELETE = withHandler(async (req, ctx) => {
  const auth = await requireAuth(req);
  const doc = await assertDocument(ctx.params.id, auth.userId);
  await db.query('UPDATE audit_document SET del_flag=1 WHERE id=?', [ctx.params.id]);
  await db.query('UPDATE audit_element SET del_flag=1 WHERE document_id=?', [ctx.params.id]);
  // 资料失效后 Agent 的项目缓存必须同步失效，否则仍会按已删资料取证
  invalidateProject(doc.project_id);
  return ok({ success: true });
});
