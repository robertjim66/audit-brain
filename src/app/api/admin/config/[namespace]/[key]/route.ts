import { requireAdmin } from '@/lib/auth';
import { ok, withHandler, ApiError } from '@/lib/http';
import { removeConfig, reloadConfig } from '@/lib/configStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NS_PATTERN = /^[a-z0-9]+(\.[a-z0-9]+)*$/;

export const DELETE = withHandler(async (req, ctx) => {
  await requireAdmin(req);
  const ns = ctx.params.namespace;
  if (!NS_PATTERN.test(String(ns || ''))) throw new ApiError(400, `配置域名不合法：${ns}`);
  const removed = await removeConfig(ns, ctx.params.key);
  reloadConfig(ns);
  return ok({ ok: true, removed });
});
