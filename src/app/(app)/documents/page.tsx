'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useProject } from '@/components/layout/Providers';
import { api } from '@/lib/apiClient';

const BIZ = ['contract', 'boq', 'control_price', 'settlement', 'payment', 'visa', 'photo', 'invoice', 'other'];
const DOCTYPE = ['pdf_text', 'pdf_mixed', 'pdf_scan', 'excel', 'word', 'photo', 'other'];

function fmtSize(n: number) {
  if (!n) return '—';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(1) + ' MB';
}
function StatusBadge({ s, progress }: { s: string; progress?: number }) {
  const map: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    processing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    done: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    failed: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${map[s] || ''}`}>
      {s === 'processing' ? `解析中 ${progress || 0}%` : s}
    </span>
  );
}

export default function DocumentsPage() {
  const { currentProjectId } = useProject();
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [cat, setCat] = useState('');
  const [docType, setDocType] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [resultDoc, setResultDoc] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [activeSheet, setActiveSheet] = useState(0);
  const pollRef = useRef<number>();

  const load = useCallback(async () => {
    if (!currentProjectId) return;
    setLoading(true);
    try {
      const data = await api.get<any[]>(`/audit/documents/project/${currentProjectId}`);
      setDocs(data);
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }, [currentProjectId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const hasPending = docs.some((d) => d.parse_status === 'pending' || d.parse_status === 'processing');
    if (hasPending) pollRef.current = window.setTimeout(load, 3000);
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  }, [docs, load]);

  async function onUpload() {
    if (!file) { setMsg('请选择文件'); return; }
    const fd = new FormData();
    fd.append('files', file);
    fd.append('project_id', currentProjectId || '');
    if (cat) fd.append('biz_category', cat);
    if (docType) fd.append('doc_type', docType);
    try {
      await api.upload('/audit/documents/upload', fd);
      setMsg('上传成功，已加入解析队列');
      setFile(null);
      (document.getElementById('fileInput') as HTMLInputElement).value = '';
      load();
    } catch (e: any) { setMsg(e.message); }
  }
  async function onParse(id: string) {
    try { await api.post(`/audit/documents/${id}/parse`, {}); setMsg('已加入解析队列'); load(); }
    catch (e: any) { setMsg(e.message); }
  }
  async function onDelete(id: string) {
    if (!confirm('确认删除该资料？（软删，原件留存）')) return;
    try { await api.del(`/audit/documents/${id}`); load(); } catch (e: any) { setMsg(e.message); }
  }
  async function openResult(id: string) {
    try {
      const data = await api.get<any>(`/audit/documents/${id}/result`);
      setResultDoc(data.document); setResult(data.result); setActiveSheet(0);
    } catch (e: any) { setMsg('查看失败：' + e.message); }
  }

  if (!currentProjectId) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-800">
        <p className="text-slate-600 dark:text-slate-300">请先选择一个审计项目，再进入资料舱。</p>
        <Link href="/projects" className="mt-3 inline-block rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white">前往项目</Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">资料舱</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">上传工程资料（合同/清单/结算/签证/发票等），系统自动解析并建立证据锚点</p>
        </div>
      </div>

      {msg && <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:bg-slate-700/40 dark:text-slate-200">{msg}</div>}

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-slate-500">业务类别</label>
            <select value={cat} onChange={(e) => setCat(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700">
              <option value="">自动识别</option>
              {BIZ.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">文档类型</label>
            <select value={docType} onChange={(e) => setDocType(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700">
              <option value="">自动识别</option>
              {DOCTYPE.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">选择文件</label>
            <input id="fileInput" type="file" accept=".pdf,.docx,.xlsx,.xls,.png,.jpg,.jpeg,.webp" onChange={(e) => setFile(e.target.files?.[0] || null)} className="block text-sm" />
          </div>
          <button onClick={onUpload} disabled={!file} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">上传并解析</button>
        </div>
        <p className="mt-2 text-xs text-slate-400">支持 PDF / Word(.docx) / Excel(.xlsx,.xls) / 图片；Excel 与 Word 可在无外部密钥下本地解析，PDF/图片识别需配置 OCR_KEY。</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-700/40 dark:text-slate-300">
            <tr>
              <th className="px-4 py-2">文件名</th><th className="px-3 py-2">类别</th><th className="px-3 py-2">类型</th>
              <th className="px-3 py-2">大小</th><th className="px-3 py-2">页/表</th><th className="px-3 py-2">解析</th><th className="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {docs.map((d) => (
              <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                <td className="max-w-xs truncate px-4 py-2 text-slate-900 dark:text-slate-100">{d.file_name}</td>
                <td className="px-3 py-2 text-slate-500">{d.biz_category}</td>
                <td className="px-3 py-2 text-slate-500">{d.doc_type}</td>
                <td className="px-3 py-2 text-slate-500">{fmtSize(d.file_size)}</td>
                <td className="px-3 py-2 text-slate-500">{d.page_count || 0}/{d.sheet_count || 0}</td>
                <td className="px-3 py-2"><StatusBadge s={d.parse_status} progress={d.parse_progress} /></td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => openResult(d.id)} className="text-sky-600 hover:underline">查看</button>
                    {(d.parse_status === 'failed' || d.parse_status === 'pending') && <button onClick={() => onParse(d.id)} className="text-amber-600 hover:underline">重试</button>}
                    <a href={d.file_url} target="_blank" rel="noreferrer" className="text-slate-500 hover:underline">原件</a>
                    <button onClick={() => onDelete(d.id)} className="text-rose-600 hover:underline">删除</button>
                  </div>
                  {d.parse_status === 'failed' && <div className="mt-1 max-w-xs truncate text-xs text-rose-500" title={d.parse_error}>{d.parse_error}</div>}
                </td>
              </tr>
            ))}
            {!docs.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">暂无资料</td></tr>}
          </tbody>
        </table>
      </div>

      {result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setResult(null)}>
          <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-xl bg-white p-5 dark:bg-slate-800" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">{resultDoc?.file_name} · 解析结果</h3>
              <button onClick={() => setResult(null)} className="text-slate-400 hover:text-slate-600">关闭</button>
            </div>
            {result.kind === 'excel' && (
              <div>
                <div className="mb-2 flex gap-2">
                  {result.sheets.map((s: any, i: number) => (
                    <button key={i} onClick={() => setActiveSheet(i)} className={`rounded px-3 py-1 text-sm ${i === activeSheet ? 'bg-sky-600 text-white' : 'bg-slate-100 dark:bg-slate-700'}`}>{s.name}</button>
                  ))}
                </div>
                <div className="overflow-auto text-sm [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-slate-300 [&_th]:border [&_th]:border-slate-300 [&_th]:bg-slate-100 [&_td]:p-1 [&_th]:p-1 dark:[&_td]:border-slate-600 dark:[&_th]:bg-slate-700" dangerouslySetInnerHTML={{ __html: result.sheets[activeSheet]?.html || '' }} />
              </div>
            )}
            {result.kind === 'word' && (
              <div className="overflow-auto text-sm [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-slate-300 [&_th]:border [&_th]:border-slate-300 [&_th]:bg-slate-100 [&_td]:p-1 [&_th]:p-1 dark:[&_td]:border-slate-600 dark:[&_th]:bg-slate-700" dangerouslySetInnerHTML={{ __html: result.html || '' }} />
            )}
            {result.kind === 'ocr' && (
              <div className="space-y-6">
                {result.pages.map((p: any) => (
                  <div key={p.pageNo}>
                    <div className="mb-1 text-xs text-slate-500">第 {p.pageNo} 页</div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="relative overflow-hidden rounded border border-slate-200 dark:border-slate-600">
                        {p.localImage
                          ? <img src={`/api/audit/documents/${resultDoc.id}/asset?path=${encodeURIComponent(p.localImage)}`} alt={`page ${p.pageNo}`} className="w-full" />
                          : p.inputImage
                            ? <img src={p.inputImage} alt={`page ${p.pageNo}`} className="w-full" />
                            : <div className="p-4 text-xs text-slate-400">无底图（未配置 OCR_KEY 或未返回）</div>}
                      </div>
                      <div className="overflow-auto text-sm">
                        <div className="mb-1 font-medium text-slate-600 dark:text-slate-300">识别内容</div>
                        <pre className="whitespace-pre-wrap text-xs text-slate-700 dark:text-slate-200">{p.markdown || '（无）'}</pre>
                        {p.elements?.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {p.elements.filter((e: any) => e.content).slice(0, 12).map((e: any, i: number) => (
                              <li key={i} className="text-xs"><span className="text-sky-600">{e.elementType}</span>：{String(e.content).slice(0, 120)}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
