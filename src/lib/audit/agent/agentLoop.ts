/**
 * 工程审计 Agent 取证循环（function-calling）
 * 眼睛＝PaddleOCR 已把资料结构化为 audit_element；大脑＝模型通过工具自行检索取证，
 * 最终成稿强约束：每个事实挂证据编号、无依据即答"未发现"并列应补清单，禁止编造数字。
 */
import * as ark from '@/lib/arkClient';
import { stripToolMarkup } from '@/lib/arkClient';
import { createToolContext } from './tools';
import { createJsonFieldStreamer } from './jsonFieldStream';

const MAX_TOOL_ROUNDS = 6;

const SYSTEM_PROMPT = `你是工程结算审计专家助手，服务于审计人员，对中标清单、控制价、结算书、合同、变更签证、发票、现场照片等工程资料进行核对与问答。

【工作方式】
1. 先用 list_documents 了解本项目已上传哪些资料及类型，再规划取证。
2. 用 search_evidence 按名称/清单编码/金额/单位检索，用 get_evidence_detail 取完整表格，用 list_seals 核签章，用 list_sheets/get_page 逐表逐页核对。可多次、多关键词交叉取证。
3. 做"左方 vs 右方"勾稽对比时（如中标清单 vs 结算书），必须分别取到两侧证据，不得只凭一侧下结论。

【铁律——违反即为错误】
- 只能依据工具返回的资料作答，严禁编造或推测任何数字、编码、金额、单位、日期、单位名称、签章。
- 答案中每个事实、数字、金额后必须用全角方括号标注证据编号，如〔e1〕；同一结论有多份证据时全部标注，如〔e2〕〔e5〕。同一段落内对同一事实只标一次，不要每个词都标。
- 资料中查不到依据的，明确写"在所提供资料中未发现"，不得含糊带过。
- 金额保留资料原始精度并注明单位；工程量、单价、合价区分清楚。
- 签章/签字以 list_seals 识别结果为准；"无盖章/无签字/无照片/无审批"必须有对应的检索过程支撑。
- 你是审计取证助手，不替被审计单位编造理由，不给出资料之外的法律定论。

【排版规范——直接影响可读性】
- 结构固定为：## 结论（2-4 句讲清能不能核、差在哪）→ ## 逐项核对（分节列依据）→ ## 建议（可执行动作）。资料不足时结论里直接点明缺什么。
- 每一行表格只放一个完整的记录/字段，一行说完一件事。禁止把多个字段串成一行，例如"校验码 447... 购买方名称 郎溪县公安局 〔e2〕"这种堆砌。
- 左右两侧勾稽用固定三列表格：| 项目 | 左方（依据来源） | 右方（依据来源） |，每行一个清单项或一个金额口径。
- 票面要素、单据字段这类"标签: 值"的数据，用二列表格 | 要素 | 内容 | 或逐行列表，不要塞进勾稽表。
- 一份资料有多个表格时，每个表格单独成节并写明来源文件名与页码/表名。
- 表格前后留空行；不要出现连续三个以上的空行；小标题用 ## 或 ###，不要用加粗代替标题。
- 超过 3 段的长答复，把最关键的金额与差额放在结论第一屏，不要埋在末尾。`;

const FINALIZE_PROMPT = `取证结束。请严格基于上方工具实际返回的资料，输出最终答复。只输出一个 JSON 对象（不要输出 markdown 代码块、不要任何 JSON 以外的文字），结构如下：
{
  "answer": "给审计人员的正式答复，使用 Markdown。固定三段结构：\\n## 结论\\n（2-4 句，直接回答能不能核、差在哪、缺什么）\\n\\n## 逐项核对\\n（分节列出，每行表格只写一个完整记录，左右勾稽用「| 项目 | 左方 | 右方 |」三列表）\\n\\n## 建议\\n（可执行动作）\\n每个事实/数字/金额后用全角方括号标注证据编号如〔e1〕；",
  "citationEids": ["e1"],
  "missing": ["资料中缺失、需被审计单位补充的材料，或因资料不足无法确认的事项；没有则为空数组"],
  "confidence": "high|mid|low"
}
规则：citationEids 只能填写工具结果中真实出现过的证据编号，且必须与 answer 中标注的编号一致；凡无证据支撑的内容，一律写入 missing，不得在 answer 中编造。
排版硬约束：必须按「## 结论 / ## 逐项核对 / ## 建议」三段组织；每行表格只写一个完整记录，禁止把多个字段串在同一行；对比表格固定三列「| 项目 | 左方 | 右方 |」。
字段顺序必须严格保持 answer 在第一位，不要调整顺序，也不要输出任何注释或说明文字；禁止调用工具、禁止输出任何工具调用语法或特殊标记；answer 字符串内部的双引号必须用 \\" 转义。`;

function extractEids(text: string): string[] {
  const set = new Set<string>();
  const re = /e\d+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(String(text || '')))) set.add(m[0]);
  return Array.from(set);
}

/**
 * 从不合规的 JSON 里宽容提取 answer 字段。
 * 模型偶尔会在 answer 值里写出未转义的双引号，导致整段 JSON.parse 失败；
 * 此时按「键名 → 收尾」切出值本身，避免正文被 JSON 外壳和截断吞掉。
 */
function salvageAnswerField(raw: string): string {
  const key = raw.search(/"answer"\s*:\s*"/);
  if (key < 0) return '';
  const open = raw.indexOf('"', raw.indexOf(':', key) + 1);
  if (open < 0) return '';
  const body = raw.slice(open + 1);

  // 收尾候选：JSON 正常收尾（"…"}），或下一个顶层键（"…" , "citationEids"）——
  // 后者是 answer 内部有未转义引号时最常见的形态，不能只认结尾引号，否则会把
  // citationEids/missing/confidence 和工具标记一起当成正文。
  const close = body.search(/"\s*(?:,\s*"[A-Za-z_]+\s*":|[}\]])/);
  const endQuote = body.search(/"\s*\}?\s*$/);
  let cut = -1;
  if (close >= 0 && endQuote >= 0) cut = Math.min(close, endQuote);
  else if (close >= 0) cut = close;
  else if (endQuote >= 0) cut = endQuote;
  const value = cut >= 0 ? body.slice(0, cut) : body;

  const ESC: Record<string, string> = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
  const decoded = value
    .replace(/\\u([0-9a-fA-F]{4})/g, (_m, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\(.)/g, (_m, c) => (ESC[c] !== undefined ? ESC[c] : c));
  // 宽容提取只负责切出正文，工具标记与未闭合的 JSON 残渣仍需清掉
  return stripToolMarkup(decoded).replace(/\n?[,;]?\s*$/, '').trim();
}

export interface AgentEvent {
  type: string;
  [k: string]: any;
}

export async function runAgent(p: {
  projectId: string | number;
  question: string;
  history?: Array<{ role: string; content: string }>;
  onEvent?: (ev: AgentEvent) => void;
  userId?: string | number | null;
}): Promise<any> {
  const aiLogCtx = { businessType: 'audit_chat', businessId: String(p.projectId), userId: p.userId };
  const emit = (type: string, data: any) => {
    if (!p.onEvent) return;
    try { p.onEvent({ type, ...data }); } catch { /* 忽略回调异常 */ }
  };
  const ctx = createToolContext(p.projectId);
  const trace: any[] = [];
  const messages: any[] = [{ role: 'system', content: SYSTEM_PROMPT }];
  for (const h of (p.history || []).slice(-6)) {
    if (h.role === 'user' || h.role === 'assistant') messages.push({ role: h.role, content: String(h.content || '') });
  }
  messages.push({ role: 'user', content: p.question });

  let totalUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  let lastModel: string | null = null;
  let lastModelKey: string | null = null;
  let rounds = 0;

  const accumulateUsage = (u: any) => {
    if (!u) return;
    totalUsage.prompt_tokens += u.prompt_tokens || 0;
    totalUsage.completion_tokens += u.completion_tokens || 0;
    totalUsage.total_tokens += u.total_tokens || 0;
  };

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    rounds = round + 1;
    emit('progress', { phase: 'evidence', round: rounds, maxRounds: MAX_TOOL_ROUNDS, text: `第 ${rounds} 轮取证：正在判断该调阅哪些资料…` });
    const resp = await ark.chatCompletion({
      ...aiLogCtx,
      messages,
      tools: ctx.definitions,
      toolChoice: 'auto',
      temperature: 0.1,
      maxTokens: 4096,
      timeoutMs: 120000,
    });
    accumulateUsage(resp.usage);
    lastModel = resp.model;
    lastModelKey = resp.modelKey;

    const toolCalls = resp.toolCalls || [];
    if (!toolCalls.length) {
      emit('progress', { phase: 'evidence', round: rounds, maxRounds: MAX_TOOL_ROUNDS, text: '资料梳理完成，准备成稿…' });
      messages.push({ role: 'assistant', content: resp.content || '' });
      break;
    }
    messages.push({
      role: 'assistant',
      content: resp.content || '',
      tool_calls: toolCalls.map((tc: any) => ({
        id: tc.id,
        type: 'function',
        function: { name: tc.function?.name, arguments: tc.function?.arguments || '{}' },
      })),
    });

    for (const tc of toolCalls) {
      const name = tc.function?.name;
      let args: any = {};
      try { args = JSON.parse(tc.function?.arguments || '{}'); } catch { args = {}; }
      const step: any = { round: round + 1, tool: name, args, ok: true };
      emit('tool', { round: step.round, tool: name, args, status: 'running' });
      const toolStarted = Date.now();
      let resultText: string;
      try {
        resultText = await ctx.execute(name, args);
        step.eids = extractEids(resultText);
        let parsed: any = null;
        try { parsed = JSON.parse(resultText); } catch {}
        if (parsed) {
          step.count = parsed.count ?? (parsed.evidence ? parsed.evidence.length : undefined);
          if (parsed.error) { step.ok = false; step.error = parsed.error; }
        }
      } catch (e: any) {
        step.ok = false;
        step.error = e.message;
        resultText = JSON.stringify({ error: e.message });
      }
      step.ms = Date.now() - toolStarted;
      trace.push(step);
      emit('tool', {
        round: step.round, tool: name, args,
        status: step.ok ? 'ok' : 'fail',
        count: step.count, eids: step.eids, error: step.error, ms: step.ms,
      });
      messages.push({ role: 'tool', tool_call_id: tc.id, name, content: resultText });
    }
  }

  messages.push({ role: 'system', content: FINALIZE_PROMPT });
  emit('progress', { phase: 'finalize', text: '取证完成，正在依据证据成稿…' });
  const answerStream = createJsonFieldStreamer('answer');
  const finalParams: any = { messages, json: true, temperature: 0.05, maxTokens: 4096, timeoutMs: 120000 };
  let finalResp: any = null;
  try {
    finalResp = await ark.chatCompletion({
      ...finalParams,
      ...aiLogCtx,
      stream: true,
      onReset: () => { answerStream.reset(); emit('answer', { reset: true }); },
      onDelta: (d: string) => {
        const delta = answerStream.push(d);
        if (delta) emit('answer', { text: delta });
      },
    });
    if (!finalResp || !String(finalResp.content || '').trim()) throw new Error('流式成稿未返回任何内容');
  } catch (e: any) {
    console.warn(`[agentLoop] 流式成稿失败，退回非流式：${e.message}`);
    emit('answer', { reset: true });
    emit('progress', { phase: 'finalize', text: '成稿重试中…' });
    finalResp = await ark.chatCompletion({ ...finalParams, ...aiLogCtx });
  }
  accumulateUsage(finalResp.usage);
  lastModel = finalResp.model || lastModel;
  lastModelKey = finalResp.modelKey || lastModelKey;

  const raw = String(finalResp.content || '');
  let parsedFinal: any = null;
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    parsedFinal = JSON.parse(m ? m[0] : raw);
  } catch { /* 落到下方宽容解析 */ }
  if (!parsedFinal || typeof parsedFinal !== 'object') {
    // 模型 JSON 偶发不合规（正文含未转义引号、或被截断）时，绝不能把 JSON 外壳当正文返回；
    // 先做字段级宽容提取，再退回流式解码器已吐出的正文。
    parsedFinal = {
      answer: salvageAnswerField(raw) || answerStream.value().trim() || '（模型返回格式异常，请重试）',
      citationEids: [], missing: [], confidence: 'low',
    };
  }

  let answer = String(parsedFinal.answer || '').trim();
  const validEids = new Set(ctx.bag.keys());
  let cited = Array.isArray(parsedFinal.citationEids) ? parsedFinal.citationEids.filter((e: string) => validEids.has(e)) : [];
  const inAnswer = extractEids(answer).filter((e) => validEids.has(e));
  inAnswer.forEach((e) => { if (!cited.includes(e)) cited.push(e); });
  answer = answer.replace(/〔(e\d+)〕/g, (whole, eid) => (validEids.has(eid) ? whole : ''));

  const citations = cited.map((eid: string) => ctx.bag.get(eid));
  const missing = Array.isArray(parsedFinal.missing) ? parsedFinal.missing.map(String) : [];

  return {
    answer,
    citations,
    missing,
    confidence: ['high', 'mid', 'low'].includes(parsedFinal.confidence) ? parsedFinal.confidence : 'mid',
    trace,
    model: lastModel,
    modelKey: lastModelKey,
    usage: totalUsage,
    rounds,
    evidenceCount: ctx.bag.size,
  };
}

export { SYSTEM_PROMPT, extractEids };
