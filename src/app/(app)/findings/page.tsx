'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useProject } from '@/components/layout/Providers';
import { api } from '@/lib/apiClient';

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
};

type Summary = {
  total: number; high: number; mid: number; low: number;
  open: number; confirmed: number; misreport: number; closed: number;
  byType: Record<string, number>;
};

const RISK_LABEL: Record<string, string> = { high: '高风险', mid: '中风险', low: '低风险' };
const RISK_STYLE: Record<string, string> = {
  high: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  mid: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  low: 'bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300',
};
const STATUS_LABEL: Record<string, string> = { open: '待处理', confirmed: '已确认', misreport: '误报', closed: '已关闭' };
const STATUS_STYLE: Record<string, string> = {
  open: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  confirmed: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  misreport: 'bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300',
  closed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
};

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

  function openFinding(f: Finding) {
    setActive(f);
    setRemarkDraft(f.remark || '');
  }

  const load = useCallback(async () => {
    if (!currentProjectId) return;
    const q = new URLSearchParams({ project_id: currentProjectId });
    if (riskFilter !== 'all') q.set('risk_level', riskFilter);
    if (statusFilter !== 'all') q.set('status', statusFilter);
    try {
      const data = await api.get<{ summary: Summary; typeLabel: Record<string, string>; total: number; list: Finding[] }>(`/audit/findings?${q.toString()}`);
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
    } catch (e: any) { setMsg('更新失败：' + e.message); }
  }

  async function saveRemark(id: string, remark: string) {
    const cur = list.find((x) => x.id === id) || active;
    if (!cur) return;
    await setStatus(id, cur.status, remark);
  }

  if (!currentProjectId) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-800">
        <p className="text-slate-600 dark:text-slate-300">请先选择一个审计项目，再查看疑点台账。</p>
        <Link href="/projects" className="mt-3 inline-block rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white">前往项目</Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">疑点台账</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">规则扫描发现 + 核对程序差异汇入，按风险分级、可逐条处置与导出。</p>
      </div>
      {msg && <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:bg-slate-700/40 dark:text-slate-200">{msg}</div>}

      <div className="flex flex-wrap gap-3">
        <button onClick={scan} disabled={running} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">▶ 运行疑点扫描</button>
        <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700">
          <option value="all">全部风险</option>
          <option value="high">高风险</option>
          <option value="mid">中风险</option>
          <option value="low">低风险</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700">
          <option value="all">全部状态</option>
          <option value="open">待处理</option>
          <option value="confirmed">已确认</option>
          <option value="misreport">误报</option>
          <option value="closed">已关闭</option>
        </select>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {[['总数', summary.total], ['高', summary.high], ['中', summary.mid], ['低', summary.low], ['待处理', summary.open], ['已确认', summary.confirmed], ['已关闭', summary.closed]].map(([k, v]) => (
            <div key={k as string} className="rounded-xl border border-slate-200 bg-white p-3 text-center dark:border-slate-700 dark:bg-slate-800">
              <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{v ?? 0}</div>
              <div className="text-xs text-slate-500">{k as string}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="overflow-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 lg:col-span-2">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-700/40 dark:text-slate-300">
              <tr>
                <th className="px-3 py-2">类型</th><th className="px-3 py-2">疑点</th>
                <th className="px-3 py-2">风险</th><th className="px-3 py-2">状态</th><th className="px-3 py-2">金额</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {list.map((f) => (
                <tr key={f.id} onClick={() => openFinding(f)} className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30 ${active?.id === f.id ? 'bg-sky-50 dark:bg-sky-900/20' : ''}`}>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{f.type_label}</td>
                  <td className="max-w-xs px-3 py-2">
                    <div className="text-slate-900 dark:text-slate-100">{f.title}</div>
                    <div className="truncate text-xs text-slate-400">{f.description || '—'}</div>
                  </td>
                  <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs ${RISK_STYLE[f.risk_level] || RISK_STYLE.low}`}>{RISK_LABEL[f.risk_level] || f.risk_level}</span></td>
                  <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[f.status] || STATUS_STYLE.open}`}>{STATUS_LABEL[f.status] || f.status}</span></td>
                  <td className="px-3 py-2 text-slate-500">{f.amount != null ? `¥${Number(f.amount).toLocaleString()}` : '—'}</td>
                </tr>
              ))}
              {!list.length && <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400">暂无疑点，先运行「疑点扫描」或对账勾稽</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          {active ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs ${RISK_STYLE[active.risk_level] || RISK_STYLE.low}`}>{RISK_LABEL[active.risk_level]}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[active.status] || STATUS_STYLE.open}`}>{STATUS_LABEL[active.status]}</span>
                <span className="text-xs text-slate-400">{active.type_label}</span>
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">{active.title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">{active.description || '—'}</p>
              {active.suggestion && <p className="rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-700 dark:bg-sky-900/20 dark:text-sky-300">审计建议：{active.suggestion}</p>}
              {active.amount != null && <p className="text-sm text-slate-500">涉及金额：¥{Number(active.amount).toLocaleString()}</p>}
              <div>
                <div className="mb-1 text-xs text-slate-400">处置</div>
                <div className="flex flex-wrap gap-2">
                  {(['open', 'confirmed', 'misreport', 'closed'] as const).map((s) => (
                    <button key={s} onClick={() => setStatus(active.id, s)} className={`rounded-lg px-3 py-1.5 text-sm ${STATUS_STYLE[s]} ${active.status === s ? 'ring-2 ring-sky-500' : ''}`}>{STATUS_LABEL[s]}</button>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs text-slate-400">处置备注</div>
                <textarea
                  value={remarkDraft}
                  onChange={(e) => setRemarkDraft(e.target.value)}
                  rows={3}
                  placeholder="记录核实过程、沟通结论或整改要求"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                />
                <button
                  onClick={() => saveRemark(active.id, remarkDraft)}
                  disabled={remarkDraft === (active.remark || '')}
                  className="mt-2 rounded-lg bg-slate-600 px-3 py-1.5 text-sm text-white disabled:opacity-40"
                >
                  保存备注
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">选择左侧一条疑点查看详情并处置。</p>
          )}
        </div>
      </div>
    </div>
  );
}
