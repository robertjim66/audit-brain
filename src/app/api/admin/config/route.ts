import { requireAuth } from '@/lib/auth';
import { ok, withHandler } from '@/lib/http';
import { listNamespaces } from '@/lib/configStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NS_PATTERN = /^[a-z0-9]+(\.[a-z0-9]+)*$/;

export const GET = withHandler(async (req) => {
  await requireAuth(req);
  return ok({ namespaces: await listNamespaces() });
});
