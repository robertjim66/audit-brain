/**
 * 审计资料解析调度服务
 * 按文件类型分发：Excel → 本地 xlsx；Word(.docx) → 本地 mammoth；PDF/图片 → PaddleOCR-VL 在线 API
 * 结果落盘 public/uploads/audit-parse/{documentId}/，要素（含证据锚点）写入 audit_element
 */
import fs from 'fs';
import path from 'path';
import db from '../db';
import snowflake from '../snowflake';
import { parseExcel } from './excelParser';
import { parseWord } from './wordParser';
import { parseOcr } from './ocrParser';
import { PaddleOcrError } from './paddleOcrClient';

const UPLOAD_ROOT = path.join(process.cwd(), 'public', 'uploads');
const DATA_ROOT = path.join(UPLOAD_ROOT, 'audit-parse');

const EXCEL_EXTS = ['.xlsx', '.xls'];
const WORD_EXTS = ['.docx'];
const OCR_EXTS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tif', '.tiff'];
const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tif', '.tiff'];

export function resultDir(documentId: string | number): string {
  return path.join(DATA_ROOT, String(documentId));
}

export function loadResult(documentId: string | number): any | null {
  const file = path.join(resultDir(documentId), 'result.json');
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function resolveLocalPath(doc: any): string | null {
  if (doc.file_path && fs.existsSync(doc.file_path)) return doc.file_path;
  if (doc.file_url && doc.file_url.startsWith('/uploads/')) {
    const candidate = path.join(UPLOAD_ROOT, doc.file_url.replace(/^\/uploads\//, ''));
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
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

  const dir = resultDir(documentId);
  fs.mkdirSync(dir, { recursive: true });

  try {
    await db.query("UPDATE audit_document SET parse_status='processing', parse_progress=1, parse_error=NULL WHERE id=?", [documentId]);

    const localPath = resolveLocalPath(doc);
    if (!localPath) throw new Error('源文件在服务器上不存在，请重新上传');
    const ext = extOf(doc.file_name);

    let parsed: any;
    let jobId: string | null = null;

    if (EXCEL_EXTS.includes(ext)) {
      parsed = parseExcel(localPath);
    } else if (WORD_EXTS.includes(ext)) {
      parsed = await parseWord(localPath);
    } else if (OCR_EXTS.includes(ext)) {
      const r = await parseOcr({
        filePath: localPath,
        fileName: doc.file_name,
        mimeType: doc.mime_type,
        assetDir: dir,
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
    fs.writeFileSync(path.join(dir, 'result.json'), JSON.stringify(stored), 'utf8');
    fs.writeFileSync(path.join(dir, 'content.md'), parsed.markdownText || '', 'utf8');

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
    return { ok: true };
  } catch (err: any) {
    const msg = err instanceof PaddleOcrError ? `${err.message}${err.code ? '（' + err.code + '）' : ''}` : err.message;
    await db.query(
      "UPDATE audit_document SET parse_status='failed', parse_progress=0, parse_error=? WHERE id=?",
      [String(msg).slice(0, 1900), documentId]
    ).catch(() => {});
    return { ok: false, error: msg };
  }
}

export { EXCEL_EXTS, WORD_EXTS, OCR_EXTS };
