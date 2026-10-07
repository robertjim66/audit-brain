/**
 * 审计资料解析调度服务
 * 按文件类型分发：Excel → 本地 xlsx；Word(.docx) → 本地 mammoth；PDF/图片 → PaddleOCR-VL 在线 API
 * 结果经存储适配层落库/落盘（audit-parse/{documentId}/），要素（含证据锚点）写入 audit_element
 */
import path from 'path';
import db from '../db';
import snowflake from '../snowflake';
import storage, { keyFromFileUrl } from '../storage';
import { parseExcel } from './excelParser';
import { parseWord } from './wordParser';
import { parseOcr } from './ocrParser';
import { PaddleOcrError } from './paddleOcrClient';
import { invalidateProject } from '../audit/agent/projectStore';

const EXCEL_EXTS = ['.xlsx', '.xls'];
const WORD_EXTS = ['.docx'];
const OCR_EXTS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tif', '.tiff'];
const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tif', '.tiff'];

export async function loadResult(documentId: string | number): Promise<any | null> {
  const buf = await storage.get(`audit-parse/${documentId}/result.json`);
  if (!buf) return null;
  return JSON.parse(buf.toString('utf8'));
}

/** 还原资料原件的存储键：新数据优先取 file_url；历史数据回退到 file_path（可能是绝对路径） */
function resolveSourceKey(doc: any): string | null {
  const fromUrl = keyFromFileUrl(doc.file_url);
  if (fromUrl) return fromUrl;
  const normalized = String(doc.file_path || '').replace(/\\/g, '/');
  if (!normalized) return null;
  const marker = 'public/uploads/';
  const idx = normalized.indexOf(marker);
  return idx >= 0 ? normalized.slice(idx + marker.length) : normalized.replace(/^\/+/, '');
}

export function extOf(fileName: string): string {
  return path.extname(fileName || '').toLowerCase();
}

function makeSummary(text: string): string {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 400);
}

export async function parseDocument(documentId: string | number, operatorUserId?: string): Promise<{ ok: boolean; error?: string }> {
  return _runParse(documentId, operatorUserId);
}

async function _runParse(documentId: string | number, operatorUserId?: string): Promise<{ ok: boolean; error?: string }> {
  const [rows]: any = await db.query('SELECT * FROM audit_document WHERE id = ? AND del_flag = 0', [documentId]);
  const doc = rows[0];
  if (!doc) return { ok: false, error: '资料不存在' };

  try {
    await db.query("UPDATE audit_document SET parse_status='processing', parse_progress=1, parse_error=NULL WHERE id=?", [documentId]);

    const srcKey = resolveSourceKey(doc);
    const source = srcKey ? await storage.get(srcKey) : null;
    if (!source) throw new Error('源文件在服务器上不存在，请重新上传');
    const ext = extOf(doc.file_name);

    let parsed: any;
    let jobId: string | null = null;

    if (EXCEL_EXTS.includes(ext)) {
      parsed = parseExcel(source);
    } else if (WORD_EXTS.includes(ext)) {
      parsed = await parseWord(source);
    } else if (OCR_EXTS.includes(ext)) {
      const r = await parseOcr({
        buffer: source,
        fileName: doc.file_name,
        mimeType: doc.mime_type,
        onProgress: async (pct) => {
          await db.query('UPDATE audit_document SET parse_progress=? WHERE id=?', [pct, documentId]).catch(() => {});
        },
      });
      parsed = { kind: 'ocr', ...r.result, jobId: r.jobId };
      jobId = r.jobId;
    } else {
      throw new Error(`暂不支持的文件类型：${ext}`);
    }

    const { raw: _raw, ...parserLite } = parsed;
    const stored = {
      version: 1,
      documentId: String(documentId),
      fileName: doc.file_name,
      kind: parsed.kind,
      parsedAt: new Date().toISOString(),
      ocrJobId: jobId,
      parser: parserLite,
    };
    await storage.put(`audit-parse/${documentId}/result.json`, Buffer.from(JSON.stringify(stored)), {
      contentType: 'application/json', documentId,
    });
    await storage.put(`audit-parse/${documentId}/content.md`, Buffer.from(parsed.markdownText || ''), {
      contentType: 'text/markdown; charset=utf-8', documentId,
    });

    let elements: any[] = Array.isArray(parsed.elements) ? parsed.elements : [];
    if (parsed.kind === 'ocr') {
      parsed.pages.forEach((page: any) => {
        const has = elements.some((e: any) => e.pageNo === page.pageNo);
        if (!has && page.markdown) {
          elements.push({
            pageNo: page.pageNo,
            sheetName: null,
            elementType: 'text',
            content: page.markdown,
            anchorLabel: `第 ${page.pageNo} 页`,
            bbox: null,
          });
        }
      });
    }

    await db.query('DELETE FROM audit_element WHERE document_id = ?', [documentId]);
    if (elements.length > 0) {
      const values: string[] = [];
      const params: any[] = [];
      const uid = operatorUserId ? String(operatorUserId) : null;
      elements.slice(0, 3000).forEach((el) => {
        values.push('(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))');
        params.push(
          snowflake.nextId(), doc.project_id, documentId,
          el.pageNo || 0, el.sheetName || null, el.elementType || 'text',
          String(el.content || '').slice(0, 16 * 1024 * 1024 - 1),
          el.bbox ? JSON.stringify(el.bbox) : null,
          el.anchorLabel || null,
          uid, uid
        );
      });
      const sql = `INSERT INTO audit_element
        (id, project_id, document_id, page_no, sheet_name, element_type, content_md, bbox_json, anchor_label, created_by, updated_by, created_at, updated_at)
        VALUES ${values.join(',')}`;
      await db.query(sql, params);
    }

    const pageCount = parsed.kind === 'ocr' ? (parsed.numPages || (IMAGE_EXTS.includes(ext) ? 1 : 0)) : 0;
    const sheetCount = parsed.kind === 'excel' ? (parsed.sheetCount || 0) : 0;
    await db.query(
      `UPDATE audit_document SET parse_status='done', parse_progress=100, parse_error=NULL,
        ocr_job_id=?, result_path=?, page_count=?, sheet_count=?, summary_text=?, updated_at=NOW(3) WHERE id=?`,
      [jobId, `audit-parse/${documentId}`, pageCount, sheetCount, makeSummary(parsed.markdownText), documentId]
    );
    // 解析结果变了，Agent 的项目语料缓存必须失效，否则会按 3 分钟前的旧内容取证
    invalidateProject(doc.project_id);
    return { ok: true };
  } catch (err: any) {
    const msg = err instanceof PaddleOcrError ? `${err.message}${err.code ? '（' + err.code + '）' : ''}` : err.message;
    await db.query(
      "UPDATE audit_document SET parse_status='failed', parse_progress=0, parse_error=? WHERE id=?",
      [String(msg).slice(0, 1900), documentId]
    ).catch(() => {});
    invalidateProject(doc.project_id);
    return { ok: false, error: msg };
  }
}

export { EXCEL_EXTS, WORD_EXTS, OCR_EXTS };
