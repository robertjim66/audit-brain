'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useProject } from '@/components/layout/Providers';
import { api, openProtectedFile } from '@/lib/apiClient';
import { BIZ_CATEGORY_LABELS, DOC_TYPE_LABELS, PARSE_STATUS_LABELS } from '@/lib/constants';

const BIZ = ['contract', 'boq', 'control_price', 'settlement', 'payment', 'visa', 'photo', 'invoice', 'other'];
const DOCTYPE = ['pdf_text', 'pdf_mixed', 'pdf_scan', 'excel', 'word', 'photo', 'other'];
// 后端单次请求最多接收 20 个文件（route 里 files.slice(0, 20)），超出时前端分批发送
const MAX_BATCH = 20;

function fmtSize(n: number) {
  if (!n) return '—';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(1) + ' MB';
}
function StatusBadge({ s, progress }: { s: string; progress?: number }) {
  const map: Record<string, string> = {
    pending: 'bg-warning/10 text-warning  ',
    processing: 'bg-primary text-primary  ',
    done: 'bg-success/10 text-success  ',
    failed: 'bg-danger/10 text-danger  ',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${map[s] || ''}`}>
      {s === 'processing' ? `解析中 ${progress || 0}%` : (PARSE_STATUS_LABELS[s] || s)}
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
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
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
    if (!files.length) { setMsg('请选择文件'); return; }
    setUploading(true);
    let uploaded = 0;
    try {
      for (let i = 0; i < files.length; i += MAX_BATCH) {
        const chunk = files.slice(i, i + MAX_BATCH);
        const fd = new FormData();
        chunk.forEach((f) => fd.append('files', f));
        fd.append('project_id', currentProjectId || '');
        if (cat) fd.append('biz_category', cat);
        if (docType) fd.append('doc_type', docType);
        setMsg(`上传中 ${Math.min(i + chunk.length, files.length)}/${files.length}…`);
        const res = await api.upload<{ documents: any[] }>('/audit/documents/upload', fd);
        uploaded += res.documents?.length || 0;
      }
      setMsg(`已上传 ${uploaded} 个文件，已加入解析队列`);
      setFiles([]);
      const input = document.getElementById('fileInput') as HTMLInputElement | null;
      if (input) input.value = '';
    } catch (e: any) {
      setMsg(uploaded ? `已上传 ${uploaded} 个，后续失败：${e.message}` : `上传失败：${e.message}`);
    } finally {
      setUploading(false);
      load();
    }
  }
  async function onParse(id: string) {
    try { await api.post(`/audit/documents/${id}/parse`, {}); setMsg('已加入解析队列'); load(); }
    catch (e: any) { setMsg(e.message); }
  }
  async function onDelete(id: string) {
    if (!confirm('确认删除该资料？（软删，原件留存）')) return;
    try { await api.del(`/audit/documents/${id}`); load(); } catch (e: any) { setMsg(e.message); }
  }
  async function openOriginal(fileUrl: string) {
    // file_url 现为 /api/files/*（需鉴权）；历史数据可能是 /uploads/*，由 rewrite 转发
    try { await openProtectedFile(fileUrl); } catch (e: any) { setMsg('打开原件失败：' + e.message); }
  }

  async function openResult(id: string) {
    try {
      const data = await api.get<any>(`/audit/documents/${id}/result`);
      setResultDoc(data.document); setResult(data.result); setActiveSheet(0);
    } catch (e: any) { setMsg('查看失败：' + e.message); }
  }

  if (!currentProjectId) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-text-secondary">请先选择一个审计项目，再进入资料舱。</p>
        <Link href="/projects"className="mt-3 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white">前往项目</Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold leading-tight tracking-tight text-text">资料舱</h1>
          <p className="mt-1 text-sm leading-relaxed text-text-secondary">上传工程资料（合同/清单/结算/签证/发票等），系统自动解析并建立证据锚点</p>
        </div>
      </div>

      {msg && <div className="rounded-lg bg-surface2 px-3 py-2 text-sm text-text-secondary">{msg}</div>}

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-text-secondary">业务类别</label>
            <select value={cat} onChange={(e) => setCat(e.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
              <option value="">自动识别</option>
              {BIZ.map((b) => <option key={b} value={b}>{BIZ_CATEGORY_LABELS[b] || b}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-secondary">文档类型</label>
            <select value={docType} onChange={(e) => setDocType(e.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
              <option value="">自动识别</option>
              {DOCTYPE.map((d) => <option key={d} value={d}>{DOC_TYPE_LABELS[d] || d}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-secondary">选择文件（可多选）</label>
            <input id="fileInput"type="file"multiple accept=".pdf,.docx,.xlsx,.xls,.png,.jpg,.jpeg,.webp"onChange={(e) => setFiles(Array.from(e.target.files || []))} className="block text-sm"/>
          </div>
          <button onClick={onUpload} disabled={!files.length || uploading} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {uploading ? '上传中…' : files.length > 1 ? `上传并解析（${files.length} 个）` : '上传并解析'}
          </button>
        </div>
        {files.length > 0 && (
          <p className="mt-2 text-xs text-text-secondary">已选 {files.length} 个文件，合计 {fmtSize(files.reduce((s, f) => s + f.size, 0))}；解析为串行队列，会按顺序逐个处理。</p>
        )}
        <p className="mt-2 text-xs text-text-muted">支持 PDF / Word(.docx) / Excel(.xlsx,.xls) / 图片；Excel 与 Word 可在无外部密钥下本地解析，PDF/图片识别需配置 OCR_KEY。</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-surface2 text-left text-text-secondary">
            <tr>
              <th className="px-4 py-2">文件名</th><th className="px-3 py-2">类别</th><th className="px-3 py-2">类型</th>
              <th className="px-3 py-2">大小</th><th className="px-3 py-2">页/表</th><th className="px-3 py-2">解析</th><th className="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {docs.map((d) => (
              <tr key={d.id} className="hover:bg-surface2">
                <td className="max-w-xs truncate px-4 py-2 text-text">{d.file_name}</td>
                <td className="px-3 py-2 text-text-secondary"title={d.biz_category}>{BIZ_CATEGORY_LABELS[d.biz_category] || d.biz_category}</td>
                <td className="px-3 py-2 text-text-secondary"title={d.doc_type}>{DOC_TYPE_LABELS[d.doc_type] || d.doc_type}</td>
                <td className="px-3 py-2 text-text-secondary">{fmtSize(d.file_size)}</td>
                <td className="px-3 py-2 text-text-secondary">{d.page_count || 0}/{d.sheet_count || 0}</td>
                <td className="px-3 py-2"><StatusBadge s={d.parse_status} progress={d.parse_progress} /></td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => openResult(d.id)} className="text-primary hover:underline">查看</button>
                    {(d.parse_status === 'failed' || d.parse_status === 'pending') && <button onClick={() => onParse(d.id)} className="text-warning hover:underline">重试</button>}
                    <button onClick={() => openOriginal(d.file_url)} className="text-text-secondary hover:underline">原件</button>
                    <button onClick={() => onDelete(d.id)} className="text-danger hover:underline">删除</button>
                  </div>
                  {d.parse_status === 'failed' && <div className="mt-1 max-w-xs truncate text-xs text-danger"title={d.parse_error}>{d.parse_error}</div>}
                </td>
              </tr>
            ))}
            {!docs.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-text-muted">暂无资料</td></tr>}
          </tbody>
        </table>
      </div>

      {result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"onClick={() => setResult(null)}>
          <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-xl bg-card p-5"onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-text">{resultDoc?.file_name} · 解析结果</h3>
              <button onClick={() => setResult(null)} className="text-text-muted hover:text-text-secondary">关闭</button>
            </div>
            {result.kind === 'excel' && (
              <div>
                <div className="mb-2 flex gap-2">
                  {result.sheets.map((s: any, i: number) => (
                    <button key={i} onClick={() => setActiveSheet(i)} className={`rounded px-3 py-1 text-sm ${i === activeSheet ? 'bg-primary text-white' : 'bg-surface2 '}`}>{s.name}</button>
                  ))}
                </div>
                <div className="overflow-auto text-sm [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_th]:border [&_th]:border-border [&_th]:bg-surface2 [&_td]:p-1 [&_th]:p-1"dangerouslySetInnerHTML={{ __html: result.sheets[activeSheet]?.html || '' }} />
              </div>
            )}
            {result.kind === 'word' && (
              <div className="overflow-auto text-sm [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_th]:border [&_th]:border-border [&_th]:bg-surface2 [&_td]:p-1 [&_th]:p-1"dangerouslySetInnerHTML={{ __html: result.html || '' }} />
            )}
            {result.kind === 'ocr' && (
              <div className="space-y-6">
                {result.pages.map((p: any) => (
                  <div key={p.pageNo}>
                    <div className="mb-1 text-xs text-text-secondary">第 {p.pageNo} 页</div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="relative overflow-hidden rounded border border-border">
                        {p.localImage
                          ? <img src={`/api/audit/documents/${resultDoc.id}/asset?path=${encodeURIComponent(p.localImage)}`} alt={`page ${p.pageNo}`} className="w-full"/>
                          : p.inputImage
                            ? <img src={p.inputImage} alt={`page ${p.pageNo}`} className="w-full"/>
                            : <div className="p-4 text-xs text-text-muted">无底图（未配置 OCR_KEY 或未返回）</div>}
                      </div>
                      <div className="overflow-auto text-sm">
                        <div className="mb-1 font-medium text-text-secondary">识别内容</div>
                        <pre className="whitespace-pre-wrap text-xs text-text-secondary">{p.markdown || '（无）'}</pre>
                        {p.elements?.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {p.elements.filter((e: any) => e.content).slice(0, 12).map((e: any, i: number) => (
                              <li key={i} className="text-xs"><span className="text-primary">{e.elementType}</span>：{String(e.content).slice(0, 120)}</li>
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
