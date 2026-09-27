import { requireAuth, requireAdmin } from '@/lib/auth';
import { ok, withHandler, ApiError } from '@/lib/http';
import { describeNamespace, setManyConfig, reloadConfig } from '@/lib/configStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NS_PATTERN = /^[a-z0-9]+(\.[a-z0-9]+)*$/;

export const GET = withHandler(async (req, ctx) => {
  await requireAuth(req);
  const ns = ctx.params.namespace;
  if (!NS_PATTERN.test(String(ns || ''))) throw new ApiError(400, `配置域名不合法：${ns}`);
  return ok(await describeNamespace(ns, true));
});

export const PUT = withHandler(async (req, ctx) => {
  await requireAdmin(req);
  const ns = ctx.params.namespace;
  if (!NS_PATTERN.test(String(ns || ''))) throw new ApiError(400, `配置域名不合法：${ns}`);
  const body = await req.json().catch(() => ({}));
  const entries = Array.isArray(body.items)
    ? body.items.filter((x: any) => x && x.key)
    : Object.entries(body || {})
        .filter(([k]) => k !== 'items' && k !== 'skipEmptySecrets')
        .map(([key, value]) => ({ key, value }));
  if (!entries.length) throw new ApiError(400, '没有可保存的配置项');
  const auth = await requireAuth(req);
  const written = await setManyConfig(ns, entries, { userId: auth.userId, skipEmptySecrets: body.skipEmptySecrets !== false });
  reloadConfig(ns);
  return ok({ ok: true, written, config: await describeNamespace(ns) });
});
