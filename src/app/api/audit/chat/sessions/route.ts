import { requireAuth, isAdmin } from '@/lib/auth';
import { ok, withHandler, ApiError } from '@/lib/http';
import { listSessions, createSession } from '@/lib/audit/agent/chatService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withHandler(async (req) => {
  const auth = await requireAuth(req);
  const projectId = req.nextUrl.searchParams.get('project_id');
  if (!projectId) throw new ApiError(400, '缺少 project_id');
  const list = await listSessions(projectId, auth.userId, await isAdmin(auth.userId));
  return ok(list);
});

export const POST = withHandler(async (req) => {
  const auth = await requireAuth(req);
  const body = await req.json().catch(() => ({}));
  const { project_id, title } = body || {};
  if (!project_id) throw new ApiError(400, '缺少 project_id');
  const s = await createSession(project_id, auth.userId, await isAdmin(auth.userId), title);
  return ok(s);
});
