'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/apiClient';
import { Button, Card, Badge, Spinner, Modal, Input, Textarea } from '@/components/ui/primitives';
import { IconChevronUp, IconChevronDown, IconCheck, IconClose } from '@/components/ui/icons';

type ModelCfg = {
  key: string;
  label: string;
  model: string;
  role: string;
  enabled: boolean;
  timeoutMs: number;
  inChain: boolean;
  chainOrder: number;
  supportsTools: boolean;
  supportsVision: boolean;
  freeQuota: string;
  note: string;
  isCustom?: boolean;
  hasCustomKey: boolean;
  usingEnvKey: boolean;
  hasKey: boolean;
  hasCustomBaseUrl: boolean;
};

type NewModelForm = {
  label: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  note: string;
};
const EMPTY_NEW: NewModelForm = { label: '', model: '', baseUrl: '', apiKey: '', timeoutMs: 600000, note: '' };
type Config = {
  failoverEnabled: boolean;
  activeModel: string;
  chainTimeoutMs: number;
  models: ModelCfg[];
  effectiveChain: Array<{ order: number; key: string; label: string; model: string; timeoutMs: number }>;
};
type Draft = { apiKey: string; baseUrl: string; keyDirty: boolean; baseDirty: boolean };
type TestResult = { key: string; label: string; model: string; ok: boolean; latencyMs: number; reply?: string; error?: string; status?: number | null; isActive: boolean };

export default function AIModelConfigPage() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [failover, setFailover] = useState(true);
  const [activeKey, setActiveKey] = useState<string>('');
  const [chainTimeoutMs, setChainTimeoutMs] = useState(1800000);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [nf, setNf] = useState<NewModelForm>(EMPTY_NEW);

  /** 生成稳定且不易与内置 key 冲突的标识 */
  function newKeyOf(model: string): string {
    const slug = String(model || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24);
    return `custom-${slug || 'model'}`;
  }

  function openAdd() {
    setNf(EMPTY_NEW);
    setAddOpen(true);
  }

  function addCustomModel() {
    if (!nf.model.trim()) { setMsg('请填写模型标识'); return; }
    if (!nf.baseUrl.trim()) { setMsg('请填写 Base URL'); return; }
    if (!nf.apiKey.trim()) { setMsg('请填写 API Key'); return; }
    if (!/^https?:\/\//i.test(nf.baseUrl.trim())) { setMsg('Base URL 需以 http:// 或 https:// 开头'); return; }
    if (!cfg) return;
    // key 冲突时追加序号，避免静默覆盖既有模型
    let key = newKeyOf(nf.model);
    let n = 2;
    while (cfg.models.some((m) => m.key === key)) { key = `${newKeyOf(nf.model)}-${n++}`; }
    setCfg({
      ...cfg,
      models: [...cfg.models, {
        key, label: nf.label.trim() || nf.model.trim(), model: nf.model.trim(),
        role: 'backup', enabled: true, timeoutMs: nf.timeoutMs || 600000,
        inChain: true, chainOrder: cfg.models.length + 1,
        supportsTools: true, supportsVision: false,
        freeQuota: '', note: nf.note.trim() || '用户自定义接入点',
        isCustom: true,
        hasCustomKey: true, usingEnvKey: false, hasKey: true, hasCustomBaseUrl: true,
      }],
    });
    setDrafts((d) => ({ ...d, [key]: { apiKey: nf.apiKey.trim(), baseUrl: nf.baseUrl.trim(), keyDirty: true, baseDirty: true } }));
    setAddOpen(false);
    setMsg('已添加自定义模型，点「保存配置」生效');
  }

  function removeModel(m: ModelCfg) {
    if (!cfg) return;
    if (m.key === activeKey) { setMsg('主模型不能删除，请先把主模型切到其他模型'); return; }
    if (!confirm(`确认删除模型「${m.label}」？`)) return;
    const models = cfg.models.filter((x) => x.key !== m.key);
    setCfg({ ...cfg, models });
    setTestResults((rs) => rs.filter((r) => r.key !== m.key));
    setMsg('已删除，点「保存配置」生效');
  }

  const load = useCallback(async () => {
    try {
      const c = await api.get<Config>('/audit/ai-config');
      setCfg(c);
      setFailover(c.failoverEnabled);
      setActiveKey(c.activeModel);
      setChainTimeoutMs(c.chainTimeoutMs);
      setDrafts({});
      setTestResults([]);
    } catch (e: any) { setMsg('加载失败：' + e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const draftBase: Draft = { apiKey: '', baseUrl: '', keyDirty: false, baseDirty: false };
  function setDraft(key: string, patch: Partial<Draft>) {
    setDrafts((d) => ({ ...d, [key]: { ...draftBase, ...(d[key] || {}), ...patch } }));
  }

  function move(idx: number, dir: -1 | 1) {
    if (!cfg) return;
    const arr = [...cfg.models];
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    setCfg({ ...cfg, models: arr });
  }

  async function save() {
    if (!cfg) return;
    setSaving(true); setMsg('');
    try {
      const models = cfg.models.map((m) => {
        const d = drafts[m.key] || {};
        return {
          key: m.key,
          label: m.label,
          model: m.model,
          enabled: m.enabled,
          timeoutMs: m.timeoutMs || 0,
          note: m.note,
          freeQuota: m.freeQuota,
          // 自定义模型必须带上 keyDirty/baseDirty：它的地址与密钥就是用户新填的，
          // 漏传会被后端判为「沿用原值」而拿不到。
          ...(d.keyDirty ? { apiKey: d.apiKey } : {}),
          ...(d.baseDirty ? { baseUrl: d.baseUrl } : {}),
        };
      });
      const r = await api.put('/audit/ai-config', {
        failoverEnabled: failover,
        activeModel: activeKey,
        chainTimeoutMs,
        models,
      });
      setCfg(r.config);
      setDrafts({});
      setMsg('模型链配置已保存');
    } catch (e: any) { setMsg('保存失败：' + e.message); }
    finally { setSaving(false); }
  }

  async function test() {
    if (!cfg) return;
    setTesting(true); setMsg(''); setTestResults([]);
    try {
      const r = await api.post('/audit/ai-config/test', { timeoutMs: 30000 });
      setTestResults(r.results || []);
      const okCount = (r.results || []).filter((x: TestResult) => x.ok).length;
      setMsg(`连通性测试完成：${okCount}/${(r.results || []).length} 个模型可用`);
    } catch (e: any) { setMsg('测试失败：' + e.message); }
    finally { setTesting(false); }
  }

  async function reload() {
    try { await api.post('/audit/ai-config/reload', {}); setMsg('已清缓存重载配置'); await load(); }
    catch (e: any) { setMsg('重载失败：' + e.message); }
  }

  if (!cfg) {
    return <div className="flex items-center gap-3 text-text-muted"><Spinner /> 加载模型配置…</div>;
  }

  const active = cfg.models.find((m) => m.key === activeKey);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold leading-tight tracking-tight text-text">模型配置</h1>
          <p className="mt-1 text-sm leading-relaxed text-text-secondary">审计大脑模型链：设置主模型（链首）、启用/禁用与降级优先级、超时与自定义密钥。</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={openAdd}>+ 自定义模型</Button>
          <Button variant="secondary" onClick={test} disabled={testing}>{testing ? '测试中…' : '连通性测试'}</Button>
          <Button variant="secondary" onClick={reload}>清缓存重载</Button>
          <Button onClick={save} disabled={saving}>{saving ? '保存中…' : '保存配置'}</Button>
        </div>
      </div>

      {msg && <div className="rounded-lg bg-bg px-3 py-2 text-sm text-text-secondary">{msg}</div>}

      {/* 全局策略 */}
      <Card className="p-4 flex flex-wrap items-center gap-6">
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input type="checkbox" checked={failover} onChange={(e) => setFailover(e.target.checked)} />
          启用故障转移（按列表顺序自动降级）
        </label>
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <span>链路总超时（毫秒）</span>
          <input type="number" className="w-36 px-2 py-1 rounded-lg border border-border bg-bg text-text" value={chainTimeoutMs} onChange={(e) => setChainTimeoutMs(Number(e.target.value))} />
        </div>
        <div className="text-sm text-text-muted">当前主模型：<span className="text-primary font-medium">{active?.label || activeKey}</span>（{active?.model}）</div>
      </Card>

      {/* 模型链 */}
      <div className="space-y-3">
        {cfg.models.map((m, i) => {
          const d = drafts[m.key] || { apiKey: '', baseUrl: '', keyDirty: false, baseDirty: false };
          return (
            <Card key={m.key} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                      m.inChain
                        ? 'border-primary/25 bg-primary/10 text-primary'
                        : 'border-border bg-surface2 text-text-muted'
                    }`}
                    title={m.inChain ? '已在故障转移链中' : '未加入故障转移链'}
                  >
                    {m.inChain ? <IconCheck size={15} /> : <IconClose size={15} />}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-text truncate">{m.label}</span>
                      {m.key === activeKey && <Badge color="danger">主模型</Badge>}
                      {m.isCustom && <Badge color="success">自定义</Badge>}
                      {m.supportsTools && <Badge color="primary">工具</Badge>}
                      {m.supportsVision && <Badge color="primary">视觉</Badge>}
                    </div>
                    <div className="text-xs text-text-muted truncate">{m.model}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0} title="上移（提升降级优先级）">
                    <IconChevronUp size={15} />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => move(i, 1)} disabled={i === cfg.models.length - 1} title="下移">
                    <IconChevronDown size={15} />
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setActiveKey(m.key)} disabled={!m.enabled} title="设为主模型">设为主</Button>
                  {m.isCustom && (
                    <Button size="sm" variant="ghost" className="text-danger" onClick={() => removeModel(m)} disabled={m.key === activeKey} title={m.key === activeKey ? '主模型不可删除' : '删除该自定义模型'}>删除</Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="flex items-center gap-2 text-sm text-text-secondary">
                  <input type="checkbox" checked={m.enabled} onChange={(e) => setCfg({ ...cfg, models: cfg.models.map((x) => x.key === m.key ? { ...x, enabled: e.target.checked } : x) })} />
                  启用此模型
                </label>
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <span>超时(ms)</span>
                  <input type="number" className="flex-1 px-2 py-1 rounded-lg border border-border bg-bg text-text" value={m.timeoutMs || 0} onChange={(e) => setCfg({ ...cfg, models: cfg.models.map((x) => x.key === m.key ? { ...x, timeoutMs: Number(e.target.value) } : x) })} />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-text-muted">自定义 API Key（留空且不改动则保持原值；清空并保存则回退环境变量）</label>
                  <input type="password" placeholder={m.hasKey ? (m.usingEnvKey ? '使用环境变量' : (d.keyDirty ? '' : '已设置自定义密钥（输入以修改，清空以清除）')) : '未设置'} className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text text-sm" value={d.apiKey} onChange={(e) => setDraft(m.key, { apiKey: e.target.value, keyDirty: true })} />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-text-muted">自定义 Base URL（留空且不改动则保持原值）</label>
                  <input placeholder={m.hasCustomBaseUrl ? (d.baseDirty ? '' : '已设置自定义地址（输入修改，清空清除）') : '使用默认地址'} className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text text-sm" value={d.baseUrl} onChange={(e) => setDraft(m.key, { baseUrl: e.target.value, baseDirty: true })} />
                </div>
              </div>

              {m.freeQuota && <div className="text-xs text-text-muted">免费额度：{m.freeQuota}</div>}
              {m.note && <div className="text-xs text-text-muted">{m.note}</div>}
            </Card>
          );
        })}
      </div>

      {/* 测试结果 */}
      {testResults.length > 0 && (
        <Card className="p-4 space-y-2">
          <h3 className="font-semibold text-text">连通性测试结果</h3>
          {testResults.map((t) => (
            <div key={t.key} className="flex items-center gap-3 text-sm border-t border-border pt-2">
              <span className="w-16 shrink-0">{t.ok ? <Badge color="success">可用</Badge> : <Badge color="danger">失败</Badge>}</span>
              <span className="text-text w-40 truncate">{t.label}</span>
              <span className="text-text-muted text-xs">{t.latencyMs}ms</span>
              {t.ok
                ? <span className="text-text-secondary truncate">↳ {t.reply}</span>
                : <span className="text-danger text-xs truncate">{t.error}{t.status ? ` (${t.status})` : ''}</span>}
            </div>
          ))}
        </Card>
      )}

      {/* 新增自定义模型 */}
      <Modal open={addOpen} title="新增自定义模型" onClose={() => setAddOpen(false)}
        footer={<><Button variant="secondary" onClick={() => setAddOpen(false)}>取消</Button><Button onClick={addCustomModel}>添加</Button></>}>
        <div className="space-y-3">
          <p className="text-xs text-text-muted">
            接入任意 OpenAI 兼容的 /chat/completions 服务（如自建推理、其他云厂商、本地部署）。
            添加后点「保存配置」生效，建议再用「连通性测试」确认可用。
          </p>
          <div>
            <label className="text-sm text-text-secondary">显示名称</label>
            <Input value={nf.label} onChange={(e) => setNf({ ...nf, label: e.target.value })} placeholder="如 公司内部推理服务" />
          </div>
          <div>
            <label className="text-sm text-text-secondary">模型标识 *</label>
            <Input value={nf.model} onChange={(e) => setNf({ ...nf, model: e.target.value })} placeholder="如 qwen2.5-72b-instruct / gpt-4o" />
            <p className="text-xs text-text-muted mt-1">服务端实际接受的 model 值，非显示名称。</p>
          </div>
          <div>
            <label className="text-sm text-text-secondary">Base URL *</label>
            <Input value={nf.baseUrl} onChange={(e) => setNf({ ...nf, baseUrl: e.target.value })} placeholder="如 https://ark.cn-beijing.volces.com/api/v3" />
            <p className="text-xs text-text-muted mt-1">需含协议、不含结尾 /chat/completions；系统会自动拼接该路径。</p>
          </div>
          <div>
            <label className="text-sm text-text-secondary">API Key *</label>
            <Input type="password" value={nf.apiKey} onChange={(e) => setNf({ ...nf, apiKey: e.target.value })} placeholder="该接入点的密钥" />
            <p className="text-xs text-text-muted mt-1">加密存储，保存后不再回显；留空可在模型卡片中清除。</p>
          </div>
          <div>
            <label className="text-sm text-text-secondary">超时(ms)</label>
            <Input type="number" value={nf.timeoutMs} onChange={(e) => setNf({ ...nf, timeoutMs: Number(e.target.value) })} />
          </div>
          <div>
            <label className="text-sm text-text-secondary">备注</label>
            <Textarea value={nf.note} onChange={(e) => setNf({ ...nf, note: e.target.value })} rows={2} placeholder="选填，说明用途" />
          </div>
        </div>
      </Modal>
    </div>
  );
}
