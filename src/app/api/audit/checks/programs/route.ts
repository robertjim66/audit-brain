import { requireAuth } from '@/lib/auth';
import { ok, withHandler, ApiError } from '@/lib/http';
import db from '@/lib/db';
import { assertProject } from '@/lib/audit/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withHandler(async (req) => {
  const auth = await requireAuth(req);
  const projectId = req.nextUrl.searchParams.get('project_id');
  if (!projectId) throw new ApiError(400, '缺少 project_id');
  await assertProject(projectId, auth.userId);

  const [rows]: any = await db.query(
    'SELECT * FROM audit_check_program WHERE project_id=? AND del_flag=0 ORDER BY created_at DESC',
    [projectId]
  );
  const list = rows.map((r: any) => {
    let summary: any = {};
    try { summary = JSON.parse(r.summary_json || '{}'); } catch {}
    const { summary_json, ...rest } = r;
    return { ...rest, summary };
  });
  return ok(list);
});
