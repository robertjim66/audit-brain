/**
 * 审计 Agent 工具集（OpenAI function-calling 协议）
 * createToolContext(projectId) 产出：definitions（喂给模型）、execute（服务端执行）、bag（证据收集）。
 */
import * as store from './projectStore';

export function createToolContext(projectId: string | number) {
  const bag = new Map<string, any>();
  const byElement = new Map<string, string>();
  let seq = 0;
  let storeCache: any = null;

  function eidFor(el: any, snippet?: string): string {
    const exist = byElement.get(el.id);
    if (exist) return exist;
    const eid = 'e' + ++seq;
    const doc = storeCache ? storeCache.docMap.get(el.docId) : null;
    const ev = {
      eid,
      elementId: el.id,
      docId: el.docId,
      fileName: doc ? doc.fileName : el.docId,
      pageNo: el.pageNo || null,
      sheetName: el.sheetName || null,
      anchor: el.anchor || '',
      type: el.type,
      snippet: snippet || (el.type === 'table' ? '表格：' + el.anchor : el.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 120)),
      bbox: el.bbox || null,
    };
    bag.set(eid, ev);
    byElement.set(el.id, eid);
    return eid;
  }

  function loc(el: any): string {
    const where = el.sheetName ? `工作表「${el.sheetName}」` : el.pageNo ? `第${el.pageNo}页` : '';
    return `${where}${el.anchor ? '·' + el.anchor.replace(/^第?\s*\d+\s*页?·?/, '') : ''}`;
  }

  const definitions = [
    {
      type: 'function',
      function: {
        name: 'list_documents',
        description: '列出本审计项目下全部已解析资料文件，含文件类型、业务类别、页数或工作表数、内容摘要。开始回答前先用它了解资料范围。',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'search_evidence',
        description: '按关键词/清单编码/金额数字在项目全部资料中检索证据。核对具体数字、编码、名称时直接把编码或金额作为 query；可多次调用不同关键词交叉取证。',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: '检索词，可为名称、清单项目编码、金额、单位名称等' },
            doc_id: { type: 'string', description: '可选，限定在某个资料文件ID内检索（来自 list_documents）' },
            element_type: { type: 'string', enum: ['table', 'text', 'title', 'seal', 'image'], description: '可选，限定要素类型' },
            limit: { type: 'integer', description: '返回条数，默认12，最大20' },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_evidence_detail',
        description: '按证据编号 eid 获取该条证据的完整内容（表格为完整 HTML）。',
        parameters: { type: 'object', properties: { eid: { type: 'string', description: '证据编号，如 e1' } }, required: ['eid'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_seals',
        description: '列出项目资料中识别到的全部印章/签章/法人名章（含单位名称、统一社会信用代码、税号），用于核查签字盖章是否齐全、盖章单位是否一致。',
        parameters: { type: 'object', properties: { doc_id: { type: 'string', description: '可选，限定文件ID' } }, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_sheets',
        description: '列出 Excel 资料的工作表清单及每个表的行列规模。',
        parameters: { type: 'object', properties: { doc_id: { type: 'string', description: '可选，限定文件ID' } }, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_page',
        description: '获取指定文件某一页包含的全部要素（标题/表格/正文/印章）。',
        parameters: {
          type: 'object',
          properties: { doc_id: { type: 'string' }, page: { type: 'integer', description: '页码，从1开始' } },
          required: ['doc_id', 'page'],
        },
      },
    },
  ];

  async function execute(name: string, args: any = {}): Promise<string> {
    storeCache = await store.loadProject(projectId);
    switch (name) {
      case 'list_documents': {
        const list = storeCache.docs.map((d: any) => ({
          doc_id: d.id, file_name: d.fileName, doc_type: d.docType, biz_category: d.bizCategory,
          pages: d.pageCount || 0, sheets: d.sheetCount || 0, summary: d.summary.slice(0, 120),
        }));
        return JSON.stringify({ count: list.length, documents: list });
      }
      case 'search_evidence': {
        const opt: any = { limit: Math.min(Math.max(parseInt(args.limit, 10) || 12, 1), 20) };
        if (args.doc_id) opt.docIds = [String(args.doc_id)];
        if (args.element_type) opt.types = new Set([args.element_type]);
        const hits = store.search(storeCache, String(args.query || ''), opt);
        const out = hits.map((h: any) => {
          const eid = eidFor(h.el, h.snippet);
          return {
            eid, file: storeCache.docMap.get(h.el.docId)?.fileName,
            location: loc(h.el), type: h.el.type, score: h.score, snippet: h.snippet,
          };
        });
        return JSON.stringify({ query: args.query, count: out.length, evidence: out });
      }
      case 'get_evidence_detail': {
        const ev = bag.get(String(args.eid));
        if (!ev) return JSON.stringify({ error: `证据编号 ${args.eid} 不存在，请先用 search_evidence 获取` });
        const el = storeCache.elements.find((x: any) => x.id === ev.elementId);
        if (!el) return JSON.stringify({ error: '证据要素已不存在' });
        let content = el.content;
        const truncated = content.length > 30000;
        if (truncated) content = content.slice(0, 30000) + '\n…（内容过长已截断，可用 get_page 或更精确关键词）';
        return JSON.stringify({ eid: ev.eid, file: ev.fileName, location: loc(el), type: el.type, truncated, content });
      }
      case 'list_seals': {
        const docIds = args.doc_id ? new Set([String(args.doc_id)]) : null;
        const seals = storeCache.elements.filter((e: any) => e.type === 'seal' && (!docIds || docIds.has(e.docId))).slice(0, 120);
        const out = seals.map((el: any) => ({
          eid: eidFor(el), file: storeCache.docMap.get(el.docId)?.fileName,
          page: el.pageNo || null, seal_text: el.content.replace(/\s+/g, ' ').slice(0, 120),
        }));
        return JSON.stringify({ count: out.length, seals: out });
      }
      case 'list_sheets': {
        const docIds = args.doc_id ? new Set([String(args.doc_id)]) : null;
        const seen = new Set<string>();
        const out: any[] = [];
        for (const el of storeCache.elements) {
          if (el.type !== 'table' || !el.sheetName) continue;
          if (docIds && !docIds.has(el.docId)) continue;
          const key = el.docId + '||' + el.sheetName;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({ doc_id: el.docId, file: storeCache.docMap.get(el.docId)?.fileName, sheet: el.sheetName, anchor: el.anchor });
        }
        return JSON.stringify({ count: out.length, sheets: out });
      }
      case 'get_page': {
        const docId = String(args.doc_id);
        const page = parseInt(args.page, 10);
        const els = storeCache.elements.filter((e: any) => e.docId === docId && e.pageNo === page);
        if (!els.length) {
          const doc = storeCache.docMap.get(docId);
          return JSON.stringify({ error: `第${page}页无要素（文件共${doc ? doc.pageCount : '?'}页），或文件ID有误` });
        }
        const out = els.map((el: any) => ({
          eid: eidFor(el), type: el.type, anchor: el.anchor,
          snippet: el.type === 'table' ? '【表格】' + el.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 150)
            : el.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 200),
        }));
        return JSON.stringify({ doc_id: docId, file: storeCache.docMap.get(docId)?.fileName, page, count: out.length, elements: out });
      }
      default:
        return JSON.stringify({ error: `未知工具 ${name}` });
    }
  }

  return { projectId: String(projectId), definitions, execute, bag };
}
