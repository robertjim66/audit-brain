import { requireAuth, requireAdmin } from '@/lib/auth';
import { ok, withHandler, ApiError } from '@/lib/http';
import { getPublicConfig, saveConfig, getFullConfig } from '@/lib/arkClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 查看脱敏配置（登录可见）
export const GET = withHandler(async (req) => {
  await requireAuth(req);
  return ok(await getPublicConfig());
});

// 保存配置（仅管理员）：以「提交顺序」为降级优先级；主模型固定链首
export const PUT = withHandler(async (req) => {
  await requireAdmin(req);
  const auth = await requireAuth(req);
  const body = await req.json().catch(() => ({}));
  const current = await getFullConfig(true);
  const incoming = Array.isArray(body.models) ? body.models : [];

  // 未出现在提交列表里的既有模型追加到末尾，避免前端漏传导致配置被静默丢掉
  const ordered: Array<{ cur: any; patch: any }> = [];
  for (const patch of incoming) {
    const hit = current.models.find(
      (m: any) => m.key === patch.key || (patch.model && m.model === patch.model)
    );
    if (hit && !ordered.some((o) => o.cur === hit)) ordered.push({ cur: hit, patch });
  }
  for (const cur of current.models) {
    if (!ordered.some((o) => o.cur === cur)) ordered.push({ cur, patch: null });
  }

  const models = ordered.map(({ cur, patch }) => {
    const next = { ...cur };
    if (!patch) return next;
    if (typeof patch.enabled === 'boolean') next.enabled = patch.enabled;
    if (patch.label) next.label = String(patch.label);
    if (patch.model) next.model = String(patch.model).trim();
    if (patch.note !== undefined) next.note = String(patch.note || '');
    if (patch.freeQuota !== undefined) next.freeQuota = String(patch.freeQuota || '');
    if (patch.timeoutMs !== undefined) {
      const t = Math.round(Number(patch.timeoutMs));
      // 0 或非法 = 跟随调用方默认；上限 1 小时，防止误填把单个模型拖死
      next.timeoutMs = Number.isFinite(t) && t > 0 ? Math.min(t, 3600000) : 0;
    }
    // apiKey：undefined/未提交=保持原值；空串=清除自定义（回退 env）；非空=覆盖
    if (typeof patch.apiKey === 'string') next.apiKey = patch.apiKey.trim();
    if (typeof patch.baseUrl === 'string') next.baseUrl = patch.baseUrl.trim();
    return next;
  });

  const activeModel = body.activeModel || current.activeModel;
  const activeHit = models.find((m) => m.model === activeModel || m.key === activeModel);
  if (!activeHit) throw new ApiError(400, '主模型不在配置列表中');
  if (activeHit.enabled === false) throw new ApiError(400, '主模型必须是已启用的模型');
  if (models.every((m: any) => m.enabled === false)) throw new ApiError(400, '至少要启用一个模型');
  // 主模型固定排链首：让「列表顺序 = 降级顺序」直观且不会被误配
  const finalModels = [activeHit, ...models.filter((m) => m !== activeHit)];

  const chainTimeoutMs = Math.round(Number(body.chainTimeoutMs));
  const saved = await saveConfig(
    {
      failoverEnabled:
        typeof body.failoverEnabled === 'boolean' ? body.failoverEnabled : current.failoverEnabled,
      activeModel,
      chainTimeoutMs:
        Number.isFinite(chainTimeoutMs) && chainTimeoutMs > 0
          ? Math.min(chainTimeoutMs, 7200000)
          : current.chainTimeoutMs,
      models: finalModels,
    },
    String(auth.userId)
  );

  return ok({ ok: true, config: await getPublicConfig() });
});
