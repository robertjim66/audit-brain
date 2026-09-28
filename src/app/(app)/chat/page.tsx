'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useProject } from '@/components/layout/Providers';
import { api, getToken } from '@/lib/apiClient';

type Session = { id: string; title: string; first_question?: string };
type Meta = { citations?: any[]; missing?: string[]; confidence?: string; model?: string; rounds?: number; usage?: any };
type Msg = { id: string; role: 'user' | 'assistant'; content: string; meta?: Meta | null };

const TOOL_CN: Record<string, string> = {
  list_documents: '浏览资料清单', search_evidence: '关键词检索证据', get_evidence_detail: '读取证据完整内容',
  list_seals: '核对印章签章', list_sheets: '列出工作表', get_page: '逐页核对',
};

interface Step { key: string; text: string; status: 'running' | 'ok' | 'fail'; extra: string; }

export default function ChatPage() {
  const { currentProjectId } = useProject();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  // 正在生成中的助手消息（临时态，done 后并入 messages）
  const [live, setLive] = useState<{ streamText: string; steps: Step[]; hasAnswer: boolean; final: Msg | null } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const renderTimer = useRef<any>(null);
  const liveRef = useRef<typeof live>(null);
  liveRef.current = live;

  const loadSessions = useCallback(async () => {
    if (!currentProjectId) return;
    try {
      const list = await api.get<Session[]>(`/audit/chat/sessions?project_id=${currentProjectId}`);
      setSessions(list);
      if (!activeId && list.length) select(list[0].id);
    } catch (e: any) { /* ignore */ }
  }, [currentProjectId, activeId]);

  const loadMessages = useCallback(async (id: string) => {
    try {
      const list = await api.get<Msg[]>(`/audit/chat/sessions/${id}/messages`);
      setMessages(list);
    } catch (e: any) { setMessages([]); }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);
  useEffect(() => { if (activeId) loadMessages(activeId); else setMessages([]); }, [activeId, loadMessages]);

  function autoScroll() {
    const box = scrollRef.current;
    if (box && box.scrollHeight - box.scrollTop - box.clientHeight < 200) {
      box.scrollTop = box.scrollHeight;
    }
  }

  async function newSession() {
    if (!currentProjectId) return;
    const s = await api.post<Session>('/audit/chat/sessions', { project_id: currentProjectId, title: '新会话' });
    setSessions((prev) => [s, ...prev]);
    setActiveId(s.id);
    setMessages([]);
  }

  async function removeSession(id: string) {
    await api.del(`/audit/chat/sessions/${id}`);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeId === id) { const next = sessions.find((s) => s.id !== id); setActiveId(next ? next.id : null); }
  }

  function select(id: string) { setActiveId(id); }

  // 解析 SSE 事件块（心跳注释行返回 null）
  function parseSseBlock(block: string): { event: string; data: any } | null {
    let event = 'message';
    const dataLines: string[] = [];
    for (const raw of block.split('\n')) {
      const line = raw.replace(/\r$/, '');
      if (!line || line.startsWith(':')) continue;
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
    }
    if (!dataLines.length) return null;
    try { return { event, data: JSON.parse(dataLines.join('\n')) }; } catch { return null; }
  }

  function upsertStep(steps: Step[], key: string, patch: Partial<Step>): Step[] {
    const idx = steps.findIndex((s) => s.key === key);
    if (idx < 0) return [...steps, { key, text: patch.text || '', status: patch.status || 'running', extra: patch.extra || '' }];
    const next = [...steps];
    next[idx] = { ...next[idx], ...patch };
    return next;
  }

  async function send() {
    const question = input.trim();
    if (!question || !activeId || busy) return;
    setBusy(true);
    setInput('');
    // 先把用户问题写进消息列表
    const userMsg: Msg = { id: 'u' + Date.now(), role: 'user', content: question };
    setMessages((prev) => [...prev, userMsg]);
    setLive({ streamText: '', steps: [], hasAnswer: false, final: null });

    const token = getToken();
    let buffer = '';
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    const decoder = new TextDecoder();

    const flushThrottled = (text: string) => {
      setLive((prev) => prev ? { ...prev, streamText: prev.streamText + text, hasAnswer: true } : prev);
      autoScroll();
    };

    try {
      const res = await fetch(`/api/audit/chat/sessions/${activeId}/ask-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ content: question }),
      });
      if (!res.ok || !res.body) throw new Error('流启动失败：' + res.status);
      reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sep: number;
        while ((sep = buffer.indexOf('\n\n')) >= 0) {
          const block = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const parsed = parseSseBlock(block);
          if (!parsed) continue;
          handleEvent(parsed.event, parsed.data);
        }
      }
    } catch (e: any) {
      setLive((prev) => prev ? { ...prev, steps: upsertStep(prev.steps, 'error', { text: '连接中断：' + (e.message || '未知错误'), status: 'fail' }) } : prev);
    } finally {
      if (renderTimer.current) clearTimeout(renderTimer.current);
    }

    function handleEvent(event: string, data: any) {
      if (event === 'start') {
        setLive((prev) => prev ? { ...prev, steps: upsertStep(prev.steps, 'start', { text: '已接收问题，启动取证', status: 'running' }) } : prev);
      } else if (event === 'progress') {
        const key = data.phase === 'finalize' ? 'finalize' : 'round-' + data.round;
        setLive((prev) => prev ? { ...prev, steps: upsertStep(prev.steps, key, { text: data.text || '取证中…', status: 'running' }) } : prev);
      } else if (event === 'tool') {
        if (data.status === 'running') {
          const label = (TOOL_CN[data.tool] || data.tool) + (data.args?.query ? `：${data.args.query}` : '');
          setLive((prev) => prev ? { ...prev, steps: upsertStep(prev.steps, `t-${data.round}-${data.tool}`, { text: label, status: 'running' }) } : prev);
        } else {
          const key = `t-${data.round}-${data.tool}`;
          const extra = data.status === 'ok'
            ? `${data.count != null ? data.count + ' 条' : '完成'}${data.ms != null ? ' · ' + (data.ms / 1000).toFixed(1) + 's' : ''}`
            : (data.error || '失败');
          setLive((prev) => prev ? { ...prev, steps: upsertStep(prev.steps, key, { status: data.status === 'ok' ? 'ok' : 'fail', extra }) } : prev);
        }
      } else if (event === 'answer') {
        if (data.reset) { setLive((prev) => prev ? { ...prev, streamText: '', hasAnswer: false } : prev); return; }
        if (data.text) flushThrottled(data.text);
      } else if (event === 'done') {
        const finalMsg: Msg = { id: String(data.id), role: 'assistant', content: data.content, meta: { citations: data.citations, missing: data.missing, confidence: data.confidence, model: data.model, rounds: data.rounds, usage: data.usage } };
        setMessages((prev) => [...prev, finalMsg]);
        setLive(null);
      } else if (event === 'error') {
        setLive((prev) => prev ? { ...prev, steps: upsertStep(prev.steps, 'error', { text: '错误：' + (data.message || '未知'), status: 'fail' }) } : prev);
      }
    }
    setBusy(false);
    loadSessions();
  }

  if (!currentProjectId) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-800">
        <p className="text-slate-600 dark:text-slate-300">请先选择一个审计项目，再使用智能问答。</p>
        <Link href="/projects" className="mt-3 inline-block rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white">前往项目</Link>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-9rem)] overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      {/* 会话侧栏 */}
      <aside className="flex w-60 flex-col border-r border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between p-3">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">会话</span>
          <button onClick={newSession} className="rounded-lg bg-sky-600 px-2 py-1 text-xs text-white">＋ 新会话</button>
        </div>
        <div className="flex-1 space-y-1 overflow-auto px-2 pb-2">
          {sessions.map((s) => (
            <div key={s.id} onClick={() => select(s.id)} className={`group flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm ${activeId === s.id ? 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-200' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700/40'}`}>
              <span className="truncate">{s.first_question || s.title || '新会话'}</span>
              <button onClick={(e) => { e.stopPropagation(); removeSession(s.id); }} className="ml-2 hidden text-xs text-slate-400 group-hover:block hover:text-rose-500">删</button>
            </div>
          ))}
          {!sessions.length && <p className="px-3 py-4 text-xs text-slate-400">暂无会话，点击「新会话」开始</p>}
        </div>
      </aside>

      {/* 对话区 */}
      <section className="flex flex-1 flex-col">
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-auto p-4">
          {messages.map((m) => (
            <MessageBubble key={m.id} msg={m} />
          ))}
          {live && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-600 text-xs font-medium text-white">AI</div>
              <div className="flex-1 rounded-xl bg-slate-50 p-3 dark:bg-slate-700/40">
                {!live.hasAnswer && (
                  <div className="mb-2 space-y-1">
                    {live.steps.map((s) => (
                      <div key={s.key} className="flex items-center gap-2 text-xs text-slate-500">
                        <span className={`inline-block h-2 w-2 rounded-full ${s.status === 'running' ? 'animate-pulse bg-sky-500' : s.status === 'ok' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        <span>{s.text}</span>
                        {s.extra && <span className="text-slate-400">{s.extra}</span>}
                      </div>
                    ))}
                  </div>
                )}
                {live.streamText && (
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{tidyMarkdown(live.streamText)}</ReactMarkdown>
                  </div>
                )}
                {!live.hasAnswer && !live.steps.length && <span className="text-sm text-slate-400">正在启动取证…</span>}
              </div>
            </div>
          )}
          {!messages.length && !live && (
            <div className="flex h-full items-center justify-center text-center text-sm text-slate-400">
              <div>
                <p>向审计助手提问，例如：</p>
                <p className="mt-1 text-slate-500">「对比中标清单与结算书，找出工程量差异较大的分部分项」</p>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-end gap-2 border-t border-slate-200 p-3 dark:border-slate-700">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={2}
            placeholder="输入问题，Enter 发送，Shift+Enter 换行"
            className="flex-1 resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700"
          />
          <button onClick={send} disabled={busy || !activeId} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {busy ? '回答中…' : '发送'}
          </button>
        </div>
      </section>
    </div>
  );
}

/**
 * 渲染前的排版兜底。
 * 只做两件安全的事：折叠连续空行、去掉行尾多余空格。
 * 表格列数的修复交给提示词约束——前端猜测列数反而容易把正常表格改坏。
 */
function tidyMarkdown(src: string): string {
  return String(src || '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+$/gm, '')
    .trim() + '\n';
}

function MessageBubble({ msg }: { msg: Msg }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-xl bg-sky-600 px-3 py-2 text-sm text-white">{msg.content}</div>
      </div>
    );
  }
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-600 text-xs font-medium text-white">AI</div>
      <div className="flex-1 rounded-xl bg-slate-50 p-3 dark:bg-slate-700/40">
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{tidyMarkdown(msg.content)}</ReactMarkdown>
        </div>
        {msg.meta?.citations && msg.meta.citations.length > 0 && (
          <div className="mt-3 border-t border-slate-200 pt-2 dark:border-slate-600">
            <div className="mb-1 text-xs font-medium text-slate-500">证据溯源（{msg.meta.citations.length}）</div>
            <div className="space-y-1">
              {msg.meta.citations.map((c: any) => (
                <div key={c.eid} className="rounded-lg bg-white px-2 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <span className="font-medium text-sky-600">〔{c.eid}〕</span> {c.fileName}
                  {c.pageNo ? ` · 第${c.pageNo}页` : ''}{c.sheetName ? ` · ${c.sheetName}` : ''}
                  {c.snippet ? <span className="text-slate-400"> — {String(c.snippet).slice(0, 80)}</span> : ''}
                </div>
              ))}
            </div>
          </div>
        )}
        {msg.meta?.missing && msg.meta.missing.length > 0 && (
          <div className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            需补充材料：{msg.meta.missing.join('；')}
          </div>
        )}
        {msg.meta?.model && (
          <div className="mt-2 text-[11px] text-slate-400">模型 {msg.meta.model} · {msg.meta.rounds} 轮取证</div>
        )}
      </div>
    </div>
  );
}
