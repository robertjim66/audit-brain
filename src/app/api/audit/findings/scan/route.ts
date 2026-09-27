import { requireAuth } from '@/lib/auth';
import { ok, withHandler, ApiError } from '@/lib/http';
import { assertProject } from '@/lib/audit/guard';
import { runFindingScan } from '@/lib/audit/findingScan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withHandler(async (req) => {
  const auth = await requireAuth(req);
  const body = await req.json().catch(() => ({}));
  const projectId = body.project_id;
  if (!projectId) throw new ApiError(400, '缺少 project_id');
  await assertProject(projectId, auth.userId);

  const summary = await runFindingScan(projectId, auth.userId);
  return ok({ success: true, summary });
});
