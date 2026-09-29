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

  // 提交列表之外的既有模型：内置模型按「防漏传」意图补回末尾，避免前端漏传把
  // 配置静默弄丢；自定义模型由用户显式增删，漏提交即视为删除，否则页面上
  // 点「删除」永远删不掉。
  const incomingKeys = new Set(incoming.map((p: any) => p?.key).filter(Boolean));
  const ordered: Array<{ cur: any; patch: any }> = [];
  for (const patch of incoming) {
    if (!patch || !patch.key) continue;
    const hit = current.models.find(
      (m: any) => m.key === patch.key || (patch.model && m.model === patch.model)
    );
    if (hit) {
      if (!ordered.some((o) => o.cur === hit)) ordered.push({ cur: hit, patch });
      continue;
    }
    // 匹配不到 = 用户新增的模型（含自定义接入点）。校验后作为新项插入，
    // 不能直接忽略：否则前端新增的模型会被静默丢弃且不报错。
    ordered.push({ cur: null, patch });
  }
  for (const cur of current.models) {
    if (cur.isCustom) continue;
    if (incomingKeys.has(cur.key)) continue;
    if (ordered.some((o) => o.cur === cur)) continue;
    ordered.push({ cur, patch: null });
  }

  const models = ordered.map(({ cur, patch }) => {
    if (!cur) {
      // 新增模型：只认自定义接入点必填项，其余给合理默认
      const model = String(patch.model || '').trim();
      if (!model) throw new ApiError(400, '新增模型必须填写模型标识');
      const apiKey = String(patch.apiKey || '').trim();
      if (!apiKey) throw new ApiError(400, `模型「${patch.label || model}」需要填写 API Key`);
      const baseUrl = String(patch.baseUrl || '').trim();
      if (!baseUrl) throw new ApiError(400, `模型「${patch.label || model}」需要填写 Base URL`);
      if (!/^https?:\/\//i.test(baseUrl)) {
        throw new ApiError(400, 'Base URL 需以 http:// 或 https:// 开头');
      }
      const t = Math.round(Number(patch.timeoutMs));
      return {
        key: String(patch.key).trim(),
        label: String(patch.label || model).trim().slice(0, 60),
        model,
        baseUrl: baseUrl.replace(/\/+$/, ''),
        apiKey,
        role: 'backup',
        enabled: patch.enabled !== false,
        timeoutMs: Number.isFinite(t) && t > 0 ? Math.min(t, 3600000) : 600000,
        supportsTools: true,
        supportsVision: false,
        freeQuota: String(patch.freeQuota || ''),
        note: String(patch.note || '用户自定义接入点'),
        isCustom: true,
      };
    }
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

  const keys = models.map((m) => m.key);
  if (new Set(keys).size !== keys.length) throw new ApiError(400, '存在重复的模型标识（key）');


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
