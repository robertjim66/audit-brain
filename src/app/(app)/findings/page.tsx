'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useProject } from '@/components/layout/Providers';
import { api } from '@/lib/apiClient';
import {
  PageHeader, Section, Button, Badge, Table, Tr, Td, Segmented, Textarea, EmptyState, Spinner, Field,
} from '@/components/ui/primitives';
import { IconPlay, IconFindings, IconInfo, IconProjects, IconLink } from '@/components/ui/icons';

type DisposeEntry = {
  id: string;
  from_status: string | null;
  to_status: string;
  remark: string | null;
  created_at: string;
  operator_id: string;
  username: string | null;
  nickname: string | null;
};

type Finding = {
  id: string;
  finding_type: string;
  type_label: string;
  title: string;
  description?: string | null;
  suggestion?: string | null;
  risk_level: string;
  status: string;
  amount: number | null;
  evidence: any;
  created_at: string;
  remark?: string;
  /** 最近一次处置的处理人；未处置为 null */
  handler?: DisposeEntry | null;
};

type Summary = {
  total: number; high: number; mid: number; low: number;
  open: number; confirmed: number; misreport: number; closed: number;
  byType: Record<string, number>;
};

const RISK_LABEL: Record<string, string> = { high: '高风险', mid: '中风险', low: '低风险' };
const RISK_COLOR: Record<string, 'danger' | 'warning' | 'muted'> = {
  high: 'danger', mid: 'warning', low: 'muted',
};
const STATUS_LABEL: Record<string, string> = { open: '待处理', confirmed: '已确认', misreport: '误报', closed: '已关闭' };
const STATUS_COLOR: Record<string, 'primary' | 'danger' | 'muted' | 'success'> = {
  open: 'primary', confirmed: 'danger', misreport: 'muted', closed: 'success',
};
const STATUS_ORDER = ['open', 'confirmed', 'misreport', 'closed'] as const;

/** datetime(3) 或 ISO 串 → "09-29 10:15" */
function formatTime(v?: string | null): string {
  const s = String(v || '');
  if (!s) return '';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s.slice(0, 16).replace('T', ' ');
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function money(v: number | null | undefined): string {
  if (v == null) return '—';
  return `¥${Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function FindingsPage() {
  const { currentProjectId } = useProject();
  const [list, setList] = useState<Finding[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [typeLabel, setTypeLabel] = useState<Record<string, string>>({});
  const [riskFilter, setRiskFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState('');
  const [active, setActive] = useState<Finding | null>(null);
  const [remarkDraft, setRemarkDraft] = useState('');
  const [disposeLog, setDisposeLog] = useState<DisposeEntry[] | null>(null);
  const [showLog, setShowLog] = useState(false);

  function openFinding(f: Finding) {
    setActive(f);
    setRemarkDraft(f.remark || '');
    setDisposeLog(null);
    setShowLog(false);
  }

  /** 处置历史按需加载：点开才请求，避免打开详情面板就多打一次接口 */
  async function toggleLog() {
    if (showLog) { setShowLog(false); return; }
    setShowLog(true);
    if (disposeLog) return;
    if (!active) return;
    try {
      const rows = await api.get<DisposeEntry[]>(`/audit/findings/${active.id}/dispose`);
      setDisposeLog(rows || []);
    } catch (e: any) {
      setDisposeLog([]);
      setMsg('处置历史加载失败：' + e.message);
    }
  }

  const load = useCallback(async () => {
    if (!currentProjectId) return;
    const q = new URLSearchParams({ project_id: currentProjectId });
    if (riskFilter !== 'all') q.set('risk_level', riskFilter);
    if (statusFilter !== 'all') q.set('status', statusFilter);
    try {
      const data = await api.get<{ summary: Summary; typeLabel: Record<string, string>; total: number; list: Finding[] }>(
        `/audit/findings?${q.toString()}`
      );
      setList(data.list); setSummary(data.summary); setTypeLabel(data.typeLabel);
      setActive((cur) => (cur && !data.list.some((x) => x.id === cur.id) ? null : cur));
    } catch (e: any) { setMsg(e.message); }
  }, [currentProjectId, riskFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function scan() {
    if (!currentProjectId) return;
    setRunning(true); setMsg('正在规则扫描（5 类规则 + 核对差异汇入）…');
    try {
      const r = await api.post('/audit/findings/scan', { project_id: currentProjectId });
      const s = r.summary || {};
      setMsg(`扫描完成：新增/更新 ${s.total ?? 0} 条（高 ${s.high ?? 0} / 中 ${s.mid ?? 0} / 低 ${s.low ?? 0}）`);
      await load();
    } catch (e: any) { setMsg('扫描失败：' + e.message); }
    finally { setRunning(false); }
  }

  async function setStatus(id: string, status: string, remark?: string) {
    try {
      // 备注只在显式传入时更新，避免改状态把已有处置意见抹掉
      const body: { status: string; remark?: string } = { status };
      if (remark !== undefined) body.remark = remark;
      const r = await api.patch<Finding>(`/audit/findings/${id}/status`, body);
      setMsg(`已标记为「${STATUS_LABEL[status]}」`);
      await load();
      if (active?.id === id) setActive({ ...active, ...r, status });
      // 状态变了，处置历史需要重新取
      if (showLog && active?.id === id) {
        try {
          setDisposeLog(await api.get<DisposeEntry[]>(`/audit/findings/${id}/dispose`));
        } catch { setDisposeLog([]); }
      }
    } catch (e: any) { setMsg('更新失败：' + e.message); }
  }

  async function saveRemark(id: string, remark: string) {
    const cur = list.find((x) => x.id === id) || active;
    if (!cur) return;
    await setStatus(id, cur.status, remark);
  }

  if (!currentProjectId) {
    return (
      <EmptyState
        icon={IconProjects}
        title="请先选择一个审计项目"
        hint="疑点按项目归属。用顶栏项目切换器选中项目后，即可查看与处置该项目的疑点。"
        action={
          <Link href="/projects">
            <Button>前往项目管理</Button>
          </Link>
        }
        className="rounded-xl border border-border bg-card shadow-card"
      />
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="疑点台账"
        description="规则扫描发现 + 核对程序差异汇入。系统只指出可疑之处与证据位置，是否构成问题由你判断。"
        actions={
          <Button onClick={scan} disabled={running}>
            {running ? <Spinner size={14} /> : <IconPlay size={14} />}
            {running ? '扫描中…' : '运行疑点扫描'}
          </Button>
        }
      />

      {msg && (
        <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/[0.06] px-3 py-2 text-sm text-text-secondary">
          <IconInfo size={15} className="mt-0.5 shrink-0 text-primary" />
          <span className="leading-relaxed">{msg}</span>
        </div>
      )}

      {/* ============ 筛选 ============ */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-border bg-card px-4 py-2.5 shadow-card">
        <div className="flex items-center gap-2">
          <span className="eyebrow">风险</span>
          <Segmented
            size="sm"
            value={riskFilter}
            onChange={setRiskFilter}
            options={[
              { value: 'all', label: '全部' },
              { value: 'high', label: '高' },
              { value: 'mid', label: '中' },
              { value: 'low', label: '低' },
            ]}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="eyebrow">状态</span>
          <Segmented
            size="sm"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'all', label: '全部' },
              { value: 'open', label: '待处理' },
              { value: 'confirmed', label: '已确认' },
              { value: 'misreport', label: '误报' },
              { value: 'closed', label: '已关闭' },
            ]}
          />
        </div>
      </div>

      {/* ============ 汇总条 ============ */}
      {summary && (
        <div className="flex flex-wrap divide-x divide-border overflow-hidden rounded-xl border border-border bg-card shadow-card">
          {[
            { k: '疑点总数', v: summary.total, tone: 'text-text' },
            { k: '高风险', v: summary.high, tone: 'text-danger' },
            { k: '中风险', v: summary.mid, tone: 'text-warning' },
            { k: '低风险', v: summary.low, tone: 'text-text-secondary' },
            { k: '待处理', v: summary.open, tone: 'text-primary' },
            { k: '已确认', v: summary.confirmed, tone: 'text-danger' },
            { k: '已关闭', v: summary.closed, tone: 'text-success' },
          ].map((s) => (
            <div key={s.k} className="min-w-[92px] flex-1 px-4 py-2.5">
              <div className={`num text-xl font-semibold leading-none ${s.tone}`}>{s.v ?? 0}</div>
              <div className="mt-1 text-2xs text-text-muted">{s.k}</div>
            </div>
          ))}
        </div>
      )}

      {/* ============ 主体 ============ */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Section
          className="lg:col-span-2"
          bodyClassName="p-0"
          title="疑点清单"
          description={list.length ? `共 ${list.length} 条，点击一行查看详情` : undefined}
        >
          {list.length === 0 ? (
            <EmptyState
              icon={IconFindings}
              title="暂无疑点"
              hint="先运行「疑点扫描」，或到核对程序跑一次勾稽 —— 核对差异会自动汇入这里。"
            />
          ) : (
            <div className="max-h-[620px] overflow-auto">
              <Table
                sticky
                className="rounded-none border-0"
                align={['left', 'left', 'left', 'left', 'right']}
                headers={['类型', '疑点', '风险', '状态', '金额']}
              >
                {list.map((f) => (
                  <Tr key={f.id} onClick={() => openFinding(f)} active={active?.id === f.id}>
                    <Td className="whitespace-nowrap text-text-secondary">{f.type_label}</Td>
                    <Td className="max-w-[280px]">
                      <div className="text-text">{f.title}</div>
                      {f.description && (
                        <div className="mt-0.5 truncate text-xs text-text-muted">{f.description}</div>
                      )}
                    </Td>
                    <Td>
                      <Badge dot color={RISK_COLOR[f.risk_level] || 'muted'}>
                        {RISK_LABEL[f.risk_level] || f.risk_level}
                      </Badge>
                    </Td>
                    <Td>
                      <Badge color={STATUS_COLOR[f.status] || 'primary'}>
                        {STATUS_LABEL[f.status] || f.status}
                      </Badge>
                    </Td>
                    <Td align="right" className="num whitespace-nowrap text-text-secondary">
                      {money(f.amount)}
                    </Td>
                  </Tr>
                ))}
              </Table>
            </div>
          )}
        </Section>

        {/* ============ 详情 ============ */}
        <Section
          title="疑点详情"
          description={active ? '判断后处置，处置全程留痕' : '选择左侧一条疑点'}
          bodyClassName="p-4"
        >
          {!active ? (
            <EmptyState icon={IconFindings} title="未选中疑点" hint="点击左侧任意一行，查看证据、填写处置意见。" />
          ) : (
            <div className="space-y-4">
              {/* 徽章 + 标题 */}
              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge dot color={RISK_COLOR[active.risk_level] || 'muted'}>
                    {RISK_LABEL[active.risk_level] || active.risk_level}
                  </Badge>
                  <Badge color={STATUS_COLOR[active.status] || 'primary'}>
                    {STATUS_LABEL[active.status] || active.status}
                  </Badge>
                  <span className="text-xs text-text-muted">{active.type_label}</span>
                </div>
                <h3 className="mt-2 text-[15px] font-semibold leading-snug text-text">{active.title}</h3>
                {active.status !== 'open' && (
                  <p className="mt-1 text-xs text-text-muted">
                    最近处理人：
                    <span className="text-text-secondary">
                      {active.handler?.nickname || active.handler?.username || '—'}
                    </span>
                    {active.handler?.created_at ? (
                      <span className="num"> · {formatTime(active.handler.created_at)}</span>
                    ) : null}
                  </p>
                )}
              </div>

              {/* 描述 */}
              <p className="text-sm leading-relaxed text-text-secondary">{active.description || '—'}</p>

              {/* 审计建议 */}
              {active.suggestion && (
                <div className="rounded-lg border-l-2 border-accent bg-accent/[0.07] px-3 py-2">
                  <div className="eyebrow mb-0.5 text-accent">审计建议</div>
                  <p className="text-xs leading-relaxed text-text-secondary">{active.suggestion}</p>
                </div>
              )}

              {/* 金额 */}
              {active.amount != null && (
                <div className="flex items-baseline justify-between border-y border-border py-2">
                  <span className="eyebrow">涉及金额</span>
                  <span className="num text-[15px] font-semibold text-text">{money(active.amount)}</span>
                </div>
              )}

              {/* 处置 */}
              <Field label="处置结论">
                <Segmented
                  className="w-full"
                  value={active.status}
                  onChange={(s) => setStatus(active.id, s)}
                  options={STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
                />
              </Field>

              {/* 备注 */}
              <Field label="处置备注" hint="记录核实过程、沟通结论或整改要求">
                <Textarea
                  rows={3}
                  value={remarkDraft}
                  onChange={(e) => setRemarkDraft(e.target.value)}
                  placeholder="如：已与施工单位核对，属实"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-2"
                  onClick={() => saveRemark(active.id, remarkDraft)}
                  disabled={remarkDraft === (active.remark || '')}
                >
                  保存备注
                </Button>
              </Field>

              {/* 处置历史（时间线） */}
              <div className="border-t border-border pt-3">
                <button
                  onClick={toggleLog}
                  className="flex items-center gap-1.5 text-xs text-text-secondary transition-colors hover:text-text"
                >
                  <IconLink size={13} />
                  处置历史{disposeLog && disposeLog.length > 0 ? `（${disposeLog.length}）` : ''}
                  <span className={`transition-transform duration-150 ${showLog ? 'rotate-90' : ''}`}>›</span>
                </button>

                {showLog && (
                  <div className="mt-3">
                    {disposeLog === null && <p className="text-xs text-text-muted">加载中…</p>}
                    {disposeLog && disposeLog.length === 0 && (
                      <p className="text-xs text-text-muted">尚无处置记录</p>
                    )}
                    {disposeLog && disposeLog.length > 0 && (
                      <ol className="relative ml-1 border-l border-border pl-4">
                        {disposeLog.map((d) => (
                          <li key={d.id} className="relative pb-3.5 last:pb-0">
                            <span
                              className={`absolute -left-[21px] top-1 h-[7px] w-[7px] rounded-full ring-2 ring-card ${
                                STATUS_COLOR[d.to_status] === 'danger'
                                  ? 'bg-danger'
                                  : STATUS_COLOR[d.to_status] === 'success'
                                  ? 'bg-success'
                                  : STATUS_COLOR[d.to_status] === 'primary'
                                  ? 'bg-primary'
                                  : 'bg-text-muted'
                              }`}
                            />
                            <div className="text-xs leading-relaxed text-text-secondary">
                              <span className="font-medium text-text">
                                {d.nickname || d.username || '未知用户'}
                              </span>
                              <span className="text-text-muted">
                                {d.from_status && d.from_status !== d.to_status
                                  ? ` 将状态从「${STATUS_LABEL[d.from_status] || d.from_status}」改为「${STATUS_LABEL[d.to_status] || d.to_status}」`
                                  : ` 保存了「${STATUS_LABEL[d.to_status] || d.to_status}」的处置备注`}
                              </span>
                            </div>
                            <div className="num mt-0.5 text-2xs text-text-muted">{formatTime(d.created_at)}</div>
                            {d.remark && (
                              <div className="mt-1 rounded-md bg-surface2 px-2 py-1 text-xs leading-relaxed text-text-secondary">
                                备注：{d.remark}
                              </div>
                            )}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
