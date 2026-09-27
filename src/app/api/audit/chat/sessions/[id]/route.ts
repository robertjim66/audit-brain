import { requireAuth, isAdmin } from '@/lib/auth';
import { ok, withHandler } from '@/lib/http';
import { deleteSession } from '@/lib/audit/agent/chatService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const DELETE = withHandler(async (req, ctx) => {
  const auth = await requireAuth(req);
  await deleteSession(ctx.params.id, auth.userId, await isAdmin(auth.userId));
  return ok({ success: true });
});
