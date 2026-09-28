import { requireAuth } from '@/lib/auth';
import { ok, withHandler } from '@/lib/http';
import db from '@/lib/db';
import { assertProject } from '@/lib/audit/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withHandler(async (req, ctx) => {
  const auth = await requireAuth(req);
  const projectId = ctx.params.projectId;
  await assertProject(projectId, auth.userId);
  const [rows]: any = await db.query(
    'SELECT * FROM audit_document WHERE project_id=? AND del_flag=0 ORDER BY created_at DESC, id DESC LIMIT 500',
    [projectId]
  );
  return ok(rows);
});
