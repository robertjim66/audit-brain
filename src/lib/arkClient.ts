/**
 * 火山方舟 Ark 客户端（OpenAI 兼容 /chat/completions）
 *
 * 模型链完全由「模型配置」页（/admin/ai-model-config）决定，持久化为统一配置中心中
 * `audit.ai` 域的 `model_chain` 键：activeModel 永远排第一，其后按 models 数组顺序降级；
 * 主模型遇 402/429/403/5xx/超时/未开通 自动切换下一个已启用备用模型；参数类 400 不切换。
 */
import { getConfig as cfgGet, setConfig as cfgSet, reloadConfig } from './configStore';
import { recordAIRequest } from './aiLogger';

const DEFAULT_BASE_URL = process.env.ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3';

const CONFIG_NS = 'audit.ai';
const CONFIG_KEY = 'model_chain';
const CONFIG_DESC = '审计 Agent 模型链（主模型 + 备用降级顺序 + 各模型超时 + 故障转移开关）';

interface ModelCfg {
  key: string;
  label: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  role: string;
  enabled: boolean;
  timeoutMs: number;
  supportsTools?: boolean;
  supportsVision?: boolean;
  freeQuota?: string;
  note?: string;
  /** 用户自定义接入点（非内置模型）：地址与密钥由用户自己填，不与 env 做「冗余清空」比对 */
  isCustom?: boolean;
}
interface ChainCfg {
  failoverEnabled: boolean;
  activeModel: string;
  chainTimeoutMs: number;
  models: ModelCfg[];
}

function envDefaults(): ChainCfg {
  return {
    failoverEnabled: true,
    activeModel: process.env.ARK_MODEL || 'doubao-seed-evolving',
    chainTimeoutMs: 1800000,
    models: [
      {
        key: 'seed-evolving',
        label: 'Doubao-Seed-Evolving',
        model: process.env.ARK_MODEL || 'doubao-seed-evolving',
        baseUrl: '', apiKey: '', role: 'primary', enabled: true,
        timeoutMs: 900000, supportsTools: true, supportsVision: true,
        freeQuota: '50万tokens免费额度',
        note: '活动指定模型，工具调用/多模态/Agent 能力最强；长报告单次可达 15 分钟',
      },
      {
        key: 'seed-21-turbo',
        label: 'Doubao-Seed-2.1-turbo（备用1）',
        model: 'doubao-seed-2-1-turbo-260628',
        baseUrl: '', apiKey: '', role: 'backup', enabled: true,
        timeoutMs: 600000, supportsTools: true, supportsVision: true,
        freeQuota: '50万tokens免费额度', note: '同代 turbo，主模型欠费/限流时自动顶上',
      },
      {
        key: 'seed-20-lite',
        label: 'Doubao-Seed-2.0-lite（备用2）',
        model: 'doubao-seed-2-0-lite-260215',
        baseUrl: '', apiKey: '', role: 'backup', enabled: true,
        timeoutMs: 300000, supportsTools: true, supportsVision: true,
        freeQuota: '免费额度', note: '再兜底，轻量低成本；长清单逐项核对能力较弱',
      },
    ],
  };
}

function withEnv(cfg: any): ChainCfg {
  const base = envDefaults();
  const baseByKey = new Map(base.models.map((m) => [m.key, m]));
  const merged: ChainCfg = {
    failoverEnabled: cfg.failoverEnabled !== false,
    activeModel: cfg.activeModel || base.activeModel,
    chainTimeoutMs: Number(cfg.chainTimeoutMs) > 0 ? Number(cfg.chainTimeoutMs) : base.chainTimeoutMs,
    models: (Array.isArray(cfg.models) && cfg.models.length ? cfg.models : base.models).map((m: any) => ({
      ...m,
      timeoutMs: Number(m.timeoutMs) > 0 ? Number(m.timeoutMs) : baseByKey.get(m.key)?.timeoutMs || 0,
      // 自定义接入点缺省用 env 的地址/密钥会导致「配了却调不通」，这里保持空，
      // 由调用方 callOnce 显式报错提示未配置，而不是静默走到方舟地址。
      baseUrl: m.isCustom
        ? (m.baseUrl || '')
        : (m.baseUrl || process.env.ARK_BASE_URL || DEFAULT_BASE_URL),
      apiKey: m.isCustom ? (m.apiKey || '') : (m.apiKey || process.env.ARK_API_KEY || ''),
      enabled: m.enabled !== false,
    })),
  };
  return merged;
}

async function getConfig(force = false): Promise<ChainCfg> {
  if (force) reloadConfig(CONFIG_NS);
  let cfg: ChainCfg | null = null;
  try {
    const stored = await cfgGet<any>(CONFIG_NS, CONFIG_KEY, null);
    if (stored && typeof stored === 'object') cfg = withEnv(stored);
  } catch (err: any) {
    console.warn('[arkClient] 读取模型配置失败，使用环境变量默认:', err.message);
  }
  if (!cfg) cfg = withEnv(envDefaults());
  return cfg;
}

/** 服务端用：返回含密钥的完整模型配置（含 apiKey/baseUrl 明文，仅内部/路由可用） */
export async function getFullConfig(force = false): Promise<ChainCfg> {
  return getConfig(force);
}

export async function saveConfig(cfg: any, userId?: string): Promise<ChainCfg> {
  const persisted = {
    failoverEnabled: !!cfg.failoverEnabled,
    activeModel: cfg.activeModel,
    chainTimeoutMs: Number(cfg.chainTimeoutMs) > 0 ? Number(cfg.chainTimeoutMs) : 0,
    models: (cfg.models || []).map((m: any) => {
      const defBase = process.env.ARK_BASE_URL || DEFAULT_BASE_URL;
      return {
        key: m.key, label: m.label, model: m.model, role: m.role,
        enabled: m.enabled !== false,
        timeoutMs: Number(m.timeoutMs) > 0 ? Number(m.timeoutMs) : 0,
        supportsTools: !!m.supportsTools, supportsVision: !!m.supportsVision,
        freeQuota: m.freeQuota || '', note: m.note || '',
        isCustom: !!m.isCustom,
        // 自定义接入点不参与「与 env 比对」的清空语义：它的 baseUrl/apiKey
        // 本来就是用户自己填的，必须原样保留，否则重连时会被当成冗余抹掉。
        baseUrl: m.isCustom
          ? (m.baseUrl || '')
          : (m.baseUrl && m.baseUrl !== defBase ? m.baseUrl : ''),
        apiKey: m.isCustom
          ? (m.apiKey || '')
          : (m.apiKey && m.apiKey !== process.env.ARK_API_KEY ? m.apiKey : ''),
      };
    }),
  };
  await cfgSet(CONFIG_NS, CONFIG_KEY, persisted, {
    valueType: 'json',
    description: CONFIG_DESC,
    updatedBy: userId,
  });
  return getConfig(true);
}

export function reload(): void {
  reloadConfig(CONFIG_NS);
}

function buildChain(cfg: ChainCfg): ModelCfg[] {
  const all = cfg.models || [];
  const active =
    all.find((m) => m.model === cfg.activeModel || m.key === cfg.activeModel) ||
    all.find((m) => m.role === 'primary') ||
    all[0];
  if (!active || active.enabled === false) return [];
  if (!cfg.failoverEnabled) return [active];
  const backups = all.filter((m) => m !== active && m.enabled !== false);
  return [active, ...backups];
}

function isFailoverStatus(status: number, bodyText: string): boolean {
  if ([402, 403, 404, 408, 429, 500, 502, 503, 504].includes(status)) return true;
  if (status === 400) {
    return /model|not found|not support|unavailable|decommission|下线|未开通|不存在|不支持/i.test(bodyText || '');
  }
  return false;
}

/** 解析 OpenAI 兼容 SSE 流，支持 onDelta 逐字回调（流式用空闲超时） */
async function readSse(res: any, armTimeout: () => void, onDelta?: (delta: string, full: string) => void): Promise<any> {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '', content = '', reasoning = '', usage = null, modelId = null;
  const toolCalls: any[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    armTimeout();
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line || !line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      let chunk: any = null;
      try { chunk = JSON.parse(data); } catch { continue; }
      if (chunk.model) modelId = chunk.model;
      if (chunk.usage) usage = chunk.usage;
      const d = chunk.choices && chunk.choices[0] && chunk.choices[0].delta;
      if (!d) continue;
      if (d.content) {
        content += d.content;
        if (onDelta) { try { onDelta(d.content, content); } catch { /* ignore */ } }
      }
      if (d.reasoning_content) reasoning += d.reasoning_content;
      if (Array.isArray(d.tool_calls)) {
        for (const tc of d.tool_calls) {
          const i = tc.index || 0;
          toolCalls[i] = toolCalls[i] || { id: '', type: 'function', function: { name: '', arguments: '' } };
          if (tc.id) toolCalls[i].id += tc.id;
          if (tc.function && tc.function.name) toolCalls[i].function.name += tc.function.name;
          if (tc.function && tc.function.arguments) toolCalls[i].function.arguments += tc.function.arguments;
        }
      }
    }
  }
  const message: any = { role: 'assistant', content };
  if (reasoning) message.reasoning_content = reasoning;
  const tcs = toolCalls.filter(Boolean);
  if (tcs.length) message.tool_calls = tcs;
  return { model: modelId, choices: [{ message, finish_reason: 'stop' }], usage };
}

/**
 * 截断模型输出尾部的内部工具调用标记。
 * DeepSeek 偶尔会把内部工具调用语法（｜｜DSML｜｜ 或 | DSML | 系列特殊 token）直接写进 content，
 * 这类标记不属于答复内容，被回灌进 messages 还会污染后续轮次；一旦出现即从该处截断。
 */
const TOOL_MARKUP_RE =
  /[｜|]{2,}\s*DSML\s*[｜|]{2,}|<\s*\/?\s*[｜|]{2,}\s*DSML|[|｜]\s*DSML\s*[|｜]|<\s*\/?\s*DSML\b/i;

function stripToolMarkup(text: string): string {
  const s = String(text || '');
  const at = s.search(TOOL_MARKUP_RE);
  return at >= 0 ? s.slice(0, at).trimEnd() : s;
}

export { stripToolMarkup };

async function callOnce(model: ModelCfg, payload: any, timeoutMs: number, opts: { stream?: boolean; onDelta?: (delta: string, full: string) => void } = {}): Promise<any> {
  if (!model.apiKey) {
    // 自定义接入点没有 env 可回退，报错要说清是它自己没配，别把用户引去查 ARK_API_KEY
    throw new Error(
      model.isCustom
        ? `自定义模型「${model.label || model.model}」未配置 API Key`
        : `模型 ${model.model} 未配置 API Key（env ARK_API_KEY 也为空）`
    );
  }
  if (!model.baseUrl) throw new Error(`模型「${model.label || model.model}」未配置 Base URL`);
  const useStream = opts.stream === true;
  const controller = new AbortController();
  let timer: any = null;
  const armTimeout = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => controller.abort(), timeoutMs);
  };
  armTimeout();
  try {
    const body = { ...payload, model: model.model };
    if (useStream) {
      body.stream = true;
      body.stream_options = { include_usage: true };
    }
    const res = await fetch(`${model.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${model.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      let json: any = null;
      try { json = JSON.parse(text); } catch { /* non-JSON */ }
      const err: any = new Error((json && (json.error?.message || json.message)) || text.slice(0, 300) || `HTTP ${res.status}`);
      err.status = res.status;
      err.body = text.slice(0, 800);
      err.failover = isFailoverStatus(res.status, text);
      throw err;
    }
    if (useStream) return await readSse(res, armTimeout, opts.onDelta);
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* non-JSON */ }
    return json;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export interface ChatCompletionParams {
  messages: any[];
  tools?: any[];
  toolChoice?: any;
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  totalTimeoutMs?: number;
  stream?: boolean;
  onDelta?: (delta: string, full: string) => void;
  onReset?: () => void;
  businessType?: string;
  businessId?: string | number;
  userId?: string | number | null;
}

export async function chatCompletion(p: ChatCompletionParams): Promise<{
  content: string; toolCalls: any[]; reasoning: string; model: string; modelKey: string; usage: any; chain: any[]; raw: any;
}> {
  const cfg = await getConfig();
  const chain = buildChain(cfg);
  if (chain.length === 0) throw new Error('未配置任何可用模型，请在「模型设置」中启用');

  const payload: any = {
    messages: p.messages,
    temperature: p.temperature ?? 0.1,
    max_tokens: p.maxTokens || 4096,
  };
  if (p.tools && p.tools.length) {
    payload.tools = p.tools;
    payload.tool_choice = p.toolChoice || 'auto';
  }
  if (p.json) payload.response_format = { type: 'json_object' };

  const attempts: any[] = [];
  let lastErr: any;
  const budget = (p.totalTimeoutMs ?? 0) > 0 ? p.totalTimeoutMs! : cfg.chainTimeoutMs > 0 ? cfg.chainTimeoutMs : 0;
  const deadline = budget > 0 ? Date.now() + budget : 0;
  for (const model of chain) {
    const started = Date.now();
    if (attempts.length && p.onReset) { try { p.onReset(); } catch { /* ignore */ } }
    const asked = model.timeoutMs > 0 ? model.timeoutMs : (p.timeoutMs || 120000);
    let perModelTimeout = asked;
    if (deadline) {
      const remain = deadline - Date.now();
      if (remain < 5000) {
        attempts.push({ key: model.key, model: model.model, ok: false, latencyMs: 0, error: '总时间预算已耗尽，跳过该模型', status: null });
        continue;
      }
      perModelTimeout = Math.min(perModelTimeout, remain);
    }
    const reqTime = new Date();
    const logCtx = {
      userId: p.userId,
      businessType: p.businessType || 'ark_chat',
      businessId: p.businessId,
    };
    try {
      const json = await callOnce(model, payload, perModelTimeout, { stream: p.stream === true, onDelta: p.onDelta });
      const msg = json.choices && json.choices[0] && json.choices[0].message;
      attempts.push({ key: model.key, model: model.model, ok: true, latencyMs: Date.now() - started });
      recordAIRequest({
        ...logCtx,
        requestUrl: `${model.baseUrl.replace(/\/$/, '')}/chat/completions`,
        requestModel: model.model,
        requestBody: { ...payload, model: model.model, stream: p.stream === true },
        responseResult: json,
        requestTime: reqTime,
        responseTime: new Date(),
        status: 0,
      });
      const failedBefore = attempts.filter((a: any) => !a.ok);
      if (failedBefore.length) {
        console.warn(`[ark] 已降级到 ${model.model}（此前失败：${failedBefore.map((a: any) => `${a.model}:${a.error || a.status}`).join(' | ')}）`);
      }
      return {
        content: stripToolMarkup(msg?.content || ''),
        toolCalls: msg?.tool_calls || [],
        reasoning: msg?.reasoning_content || '',
        model: json.model || model.model,
        modelKey: model.key,
        usage: json.usage || null,
        chain: attempts,
        raw: json,
      };
    } catch (err: any) {
      const secs = ((Date.now() - started) / 1000).toFixed(1);
      attempts.push({ key: model.key, model: model.model, ok: false, latencyMs: Date.now() - started, error: err.message, status: err.status });
      recordAIRequest({
        ...logCtx,
        requestUrl: `${model.baseUrl.replace(/\/$/, '')}/chat/completions`,
        requestModel: model.model,
        requestBody: { ...payload, model: model.model, stream: p.stream === true },
        responseResult: null,
        requestTime: reqTime,
        responseTime: new Date(),
        status: 1,
        errorMsg: `${err.status != null ? 'HTTP' + err.status + ' ' : ''}${err.message}`,
      });
      lastErr = err;
      const canFailover = err.name === 'AbortError' || err.failover === true || !err.status;
      console.warn(`[ark] 模型 ${model.model} 调用失败(${secs}s, ${canFailover ? '可降级' : '不可降级'})：${err.message}`);
      if (!cfg.failoverEnabled || !canFailover) break;
    }
  }
  const e = new Error(`所有模型均调用失败：${lastErr?.message || '未知错误'}`);
  (e as any).attempts = attempts;
  throw e;
}

/** 连通性测试：逐个模型发极简请求 */
export async function testChain(timeoutMs = 30000): Promise<any> {
  const cfg = await getConfig(true);
  const models = (cfg.models || []).filter((m) => m.enabled !== false);
  const results: any[] = [];
  for (const model of models) {
    const started = Date.now();
    const reqTime = new Date();
    const testPayload = {
      messages: [{ role: 'user', content: 'ping，请回复：pong' }],
      max_tokens: 16,
      temperature: 0,
      model: model.model,
    };
    try {
      const json = await callOnce(model, testPayload, timeoutMs);
      results.push({
        key: model.key, label: model.label, model: model.model,
        ok: true, latencyMs: Date.now() - started,
        reply: (json.choices?.[0]?.message?.content || '').slice(0, 50),
        isActive: cfg.activeModel === model.model || cfg.activeModel === model.key,
      });
      recordAIRequest({
        userId: undefined, businessType: 'model_test', businessId: model.key,
        requestUrl: `${model.baseUrl.replace(/\/$/, '')}/chat/completions`,
        requestModel: model.model, requestBody: testPayload, responseResult: json,
        requestTime: reqTime, responseTime: new Date(), status: 0,
      });
    } catch (err: any) {
      results.push({
        key: model.key, label: model.label, model: model.model,
        ok: false, latencyMs: Date.now() - started,
        error: err.message, status: err.status || null,
        isActive: cfg.activeModel === model.model || cfg.activeModel === model.key,
      });
    }
  }
  return { failoverEnabled: cfg.failoverEnabled, activeModel: cfg.activeModel, results };
}

/** 给前端的脱敏配置（不回显 key） */
export async function getPublicConfig(): Promise<any> {
  const cfg = await getConfig();
  const chain = buildChain(cfg);
  const chainKeys = chain.map((m) => m.key);
  const defBase = process.env.ARK_BASE_URL || DEFAULT_BASE_URL;
  return {
    failoverEnabled: cfg.failoverEnabled,
    activeModel: cfg.activeModel,
    chainTimeoutMs: cfg.chainTimeoutMs,
    models: cfg.models.map((m) => ({
      key: m.key, label: m.label, model: m.model,
      role: (m.model === cfg.activeModel || m.key === cfg.activeModel) ? 'primary' : 'backup',
      enabled: m.enabled !== false,
      timeoutMs: m.timeoutMs || 0,
      inChain: chainKeys.includes(m.key),
      chainOrder: chainKeys.indexOf(m.key) + 1,
      isCustom: !!m.isCustom,
      supportsTools: !!m.supportsTools, supportsVision: !!m.supportsVision,
      freeQuota: m.freeQuota || '', note: m.note || '',
      // 自定义模型总是「自带密钥 + 自带地址」，与内置模型的 env 回退语义不同
      hasCustomKey: m.isCustom ? !!m.apiKey : !!m.apiKey && m.apiKey !== process.env.ARK_API_KEY,
      usingEnvKey: m.isCustom ? false : (!m.apiKey || m.apiKey === process.env.ARK_API_KEY),
      hasKey: !!m.apiKey,
      hasCustomBaseUrl: m.isCustom ? !!m.baseUrl : !!m.baseUrl && m.baseUrl !== defBase,
    })),
    effectiveChain: chain.map((m, i) => ({
      order: i + 1, key: m.key, label: m.label, model: m.model, timeoutMs: m.timeoutMs || 0,
    })),
  };
}
