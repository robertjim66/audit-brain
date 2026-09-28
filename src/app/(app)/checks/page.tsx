'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useProject } from '@/components/layout/Providers';
import { api } from '@/lib/apiClient';

type Prog = { id: string; program_type: string; program_name: string; status: string; summary: any };
type Item = { id: string; item_code: string; item_name: string; qty_left: any; qty_right: any; amount_left: any; amount_right: any; diff_amount: any; conclusion: string; diff_desc: string; evidence: any };

export default function ChecksPage() {
  const { currentProjectId } = useProject();
  const [programs, setPrograms] = useState<Prog[]>([]);
  const [active, setActive] = useState<Prog | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [filter, setFilter] = useState('all');
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState('');
  // select 需要读到最新 programs（核对后立即选中新记录），闭包里的旧数组会选中已被软删的记录
  const programsRef = useRef<Prog[]>([]);

  const loadPrograms = useCallback(async () => {
    if (!currentProjectId) return;
    try {
      const data = await api.get<Prog[]>(`/audit/checks/programs?project_id=${currentProjectId}`);
      programsRef.current = data;
      setPrograms(data);
    } catch (e: any) { setMsg(e.message); }
  }, [currentProjectId]);

  useEffect(() => { loadPrograms(); }, [loadPrograms]);

  async function run(type: string) {
    if (!currentProjectId) return;
    setRunning(true); setMsg('正在核对（纯算法，无需外部密钥）…');
    try {
      const r = await api.post<{ programId: string; summary: any; findings: any }>('/audit/checks/run', { project_id: currentProjectId, program_type: type });
      setMsg(`核对完成：${type === 'boq_settlement' ? '清单↔结算' : '三方签章'}。差异 ${r.summary?.diff ?? 0}，疑点扫描 ${r.findings?.total ?? 0} 条`);
      await loadPrograms();
      // 用 run 返回的 programId 选中新记录：programs 是刷新前的旧数组，取 [0] 会选中刚被软删的那条
      if (r.programId) await select(r.programId);
    } catch (e: any) { setMsg('核对失败：' + e.message); }
    finally { setRunning(false); }
  }

  async function select(id: string, conclFilter = filter) {
    const p = programsRef.current.find((x) => x.id === id);
    setActive(p || null);
    setItems([]);
    if (p) {
      try {
        const its = await api.get<Item[]>(`/audit/checks/programs/${id}/items?conclusion=${conclFilter}`);
        setItems(its);
      } catch (e: any) { setMsg(e.message); }
    }
  }

  async function download(path: string, name: string) {
    if (!currentProjectId) return;
    try {
      await api.download(`/audit/checks/${path}?project_id=${currentProjectId}`, name);
    } catch (e: any) { setMsg('导出失败：' + e.message); }
  }

  if (!currentProjectId) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-800">
        <p className="text-slate-600 dark:text-slate-300">请先选择一个审计项目，再使用核对程序。</p>
        <Link href="/projects" className="mt-3 inline-block rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white">前往项目</Link>
      </div>
    );
  }

  const sum = active?.summary || {};
  const conclLabel: Record<string, string> = { match: '一致', diff: '差异', unconfirmed: '无法确认' };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">核对程序</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">确定性勾稽：清单↔结算跨页表比对、签证/合同三方签章证据链。</p>
      </div>
      {msg && <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:bg-slate-700/40 dark:text-slate-200">{msg}</div>}

      <div className="flex flex-wrap gap-3">
        <button onClick={() => run('boq_settlement')} disabled={running} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">▶ 清单↔结算勾稽</button>
        <button onClick={() => run('visa_evidence')} disabled={running} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">▶ 三方签章核对</button>
        <select value={active?.id || ''} onChange={(e) => select(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700">
          <option value="">历史核对记录…</option>
          {programs.map((p) => <option key={p.id} value={p.id}>{p.program_name}（{p.status}）</option>)}
        </select>
        <button onClick={() => download('export', `核对台账_${currentProjectId}.xlsx`)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600">⬇ 导出 Excel 台账</button>
        <button onClick={() => download('export-word', `疑点发现清单_${currentProjectId}.docx`)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600">⬇ 导出 Word 清单</button>
      </div>

      {active && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[['总项', sum.total], ['一致', sum.match], ['差异', sum.diff], ['无法确认', sum.unconfirmed]].map(([k, v]) => (
              <div key={k as string} className="rounded-xl border border-slate-200 bg-white p-3 text-center dark:border-slate-700 dark:bg-slate-800">
                <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{v ?? 0}</div>
                <div className="text-xs text-slate-500">{k as string}</div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            {['all', 'diff', 'unconfirmed', 'match'].map((c) => (
              <button key={c} onClick={() => { setFilter(c); if (active) select(active.id, c); }} className={`rounded px-3 py-1 text-sm ${filter === c ? 'bg-sky-600 text-white' : 'bg-slate-100 dark:bg-slate-700'}`}>{c === 'all' ? '全部' : conclLabel[c]}</button>
            ))}
          </div>

          <div className="overflow-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-700/40 dark:text-slate-300">
                <tr>
                  <th className="px-3 py-2">编码/编号</th><th className="px-3 py-2">名称</th>
                  <th className="px-3 py-2">左工程量</th><th className="px-3 py-2">右工程量</th>
                  <th className="px-3 py-2">左合价</th><th className="px-3 py-2">右合价</th>
                  <th className="px-3 py-2">结论</th><th className="px-3 py-2">说明</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {items.map((it) => (
                  <tr key={it.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="px-3 py-2 text-slate-900 dark:text-slate-100">{it.item_code}</td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{it.item_name}</td>
                    <td className="px-3 py-2 text-slate-500">{it.qty_left ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-500">{it.qty_right ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-500">{it.amount_left ?? '—'}</td>
                    <td className={`px-3 py-2 ${it.conclusion === 'diff' ? 'font-medium text-rose-600' : 'text-slate-500'}`}>{it.amount_right ?? '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${it.conclusion === 'diff' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' : it.conclusion === 'match' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}>{conclLabel[it.conclusion]}</span>
                    </td>
                    <td className="max-w-xs px-3 py-2 text-xs text-slate-500">{it.diff_desc || '—'}</td>
                  </tr>
                ))}
                {!items.length && <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-400">请先运行核对，或选择历史记录</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
