import { requireAuth, isAdmin } from '@/lib/auth';
import { ok, withHandler } from '@/lib/http';
import { listMessages, assertSessionAccess } from '@/lib/audit/agent/chatService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withHandler(async (req, ctx) => {
  const auth = await requireAuth(req);
  await assertSessionAccess(ctx.params.id, auth.userId, await isAdmin(auth.userId));
  return ok(await listMessages(ctx.params.id));
});
