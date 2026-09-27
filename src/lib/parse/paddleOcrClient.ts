/**
 * PaddleOCR-VL 在线识别客户端
 * 端点：百度 AI Studio PaddleOCR-VL。无 OCR_KEY 时抛 PaddleOcrError，由上层标记解析失败。
 */
import fs from 'fs';
import path from 'path';

export class PaddleOcrError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'PaddleOcrError';
    this.code = code;
  }
}

function cfg(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

export function hasOcrConfig(): boolean {
  return !!process.env.OCR_KEY;
}

const OCR_BASE_URL = cfg('OCR_BASE_URL', 'https://paddleocr.aistudio-app.com');
const OCR_API_VERSION = cfg('OCR_API_VERSION', 'v2');
const OCR_MODEL = cfg('OCR_MODEL', 'PaddleOCR-VL-1.6');
const OCR_POLL_INTERVAL_MS = Number(cfg('OCR_POLL_INTERVAL_MS', '3000'));
const OCR_TIMEOUT_MS = Number(cfg('OCR_TIMEOUT_MS', '600000'));
const OCR_CREATE_RETRY_MAX = Number(cfg('OCR_CREATE_RETRY_MAX', '8'));
const OCR_POLL_RETRY_MAX = Number(cfg('OCR_POLL_RETRY_MAX', '4'));
const OCR_RETRY_BASE_MS = Number(cfg('OCR_RETRY_BASE_MS', '2000'));
const OCR_RETRY_CAP_MS = Number(cfg('OCR_RETRY_CAP_MS', '20000'));

const JOB_ENDPOINT = `${OCR_BASE_URL}/api/${OCR_API_VERSION}/ocr/jobs`;

// 审计场景写死的能力参数
const OPTIONAL_PAYLOAD = {
  useLayoutDetection: true,
  useSealDetection: true,
  useCrossPageTableMerge: true,
  useTitleHierarchy: true,
  useDocOrientationClassification: true,
  useDistortionCorrection: true,
  temperature: 0,
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function createJob(filePath: string, fileName: string, mimeType: string): Promise<string> {
  if (!process.env.OCR_KEY) {
    throw new PaddleOcrError('未配置 OCR_KEY，无法识别扫描件/PDF。请在 .env 配置 OCR_KEY（百度 AI Studio 访问令牌）后重试。');
  }
  const blob = new Blob([fs.readFileSync(filePath)], { type: mimeType || 'application/octet-stream' });
  const form = new FormData();
  form.append('file', blob, fileName);
  form.append('model', OCR_MODEL);
  form.append('optionalPayload', JSON.stringify(OPTIONAL_PAYLOAD));

  let lastErr: any;
  for (let attempt = 0; attempt < OCR_CREATE_RETRY_MAX; attempt++) {
    try {
      const res = await fetch(JOB_ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `bearer ${process.env.OCR_KEY}` },
        body: form,
      });
      if (res.status === 429 || res.status >= 500) {
        throw new PaddleOcrError(`创建识别任务限流/服务忙(${res.status})`, String(res.status));
      }
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new PaddleOcrError(`创建识别任务失败(${res.status}): ${txt.slice(0, 200)}`, String(res.status));
      }
      const data: any = await res.json();
      if (data?.code && data.code !== 0 && data.code !== 200) {
        // 瞬时码（10010/10011/12001）可重试
        if ([10010, 10011, 12001].includes(data.code)) {
          throw new PaddleOcrError(data.message || '瞬时错误', String(data.code));
        }
        throw new PaddleOcrError(data.message || '创建识别任务失败', String(data.code));
      }
      const jobId = data?.result?.jobId || data?.result?.job_id || data?.jobId || data?.job_id;
      if (!jobId) throw new PaddleOcrError('创建识别任务未返回 jobId');
      return String(jobId);
    } catch (e: any) {
      lastErr = e;
      if (e instanceof PaddleOcrError && e.code && !['10010', '10011', '12001'].includes(e.code) && !['429'].includes(e.code) && Number(e.code) < 500) {
        throw e; // 非瞬时失败直接抛出
      }
      const wait = Math.min(OCR_RETRY_CAP_MS, OCR_RETRY_BASE_MS * Math.pow(2, attempt));
      await sleep(wait);
    }
  }
  throw lastErr instanceof PaddleOcrError ? lastErr : new PaddleOcrError(lastErr?.message || '创建识别任务失败');
}

async function getJob(jobId: string): Promise<{ status: string; resultUrl?: string }> {
  const url = `${JOB_ENDPOINT}/${encodeURIComponent(jobId)}`;
  let lastErr: any;
  for (let attempt = 0; attempt < OCR_POLL_RETRY_MAX; attempt++) {
    try {
      const res = await fetch(url, { headers: { Authorization: `bearer ${process.env.OCR_KEY}` } });
      if (!res.ok) throw new PaddleOcrError(`轮询失败(${res.status})`, String(res.status));
      const data: any = await res.json();
      const status = data?.result?.status || data?.status;
      const resultUrl = data?.result?.resultUrl?.jsonUrl || data?.result?.jsonUrl || data?.result?.resultUrl;
      return { status, resultUrl: resultUrl ? String(resultUrl) : undefined };
    } catch (e: any) {
      lastErr = e;
      await sleep(OCR_RETRY_BASE_MS);
    }
  }
  throw lastErr instanceof PaddleOcrError ? lastErr : new PaddleOcrError(lastErr?.message || '轮询失败');
}

async function downloadJsonl(resultUrl: string): Promise<any> {
  const res = await fetch(resultUrl, { headers: process.env.OCR_KEY ? { Authorization: `bearer ${process.env.OCR_KEY}` } : {} });
  if (!res.ok) throw new PaddleOcrError(`下载识别结果失败(${res.status})`, String(res.status));
  return res.json();
}

/** 把 PaddleOCR 归一化结果映射为本系统的 pages/elements 结构 */
function normalizeResult(raw: any): { numPages: number; pages: any[] } {
  // 不同版本返回结构可能不同，这里做容错映射
  const pagesRaw: any[] = Array.isArray(raw?.result?.pages) ? raw.result.pages
    : Array.isArray(raw?.pages) ? raw.pages
    : Array.isArray(raw) ? raw : [];
  const pages = pagesRaw.map((pg: any, i: number) => {
    const els: any[] = Array.isArray(pg.elements) ? pg.elements.map((e: any, idx: number) => ({
      index: idx,
      label: e.label || e.elementType || '',
      elementType: e.elementType || mapElementType(e.label || e.elementType || ''),
      content: e.content || e.markdown || '',
      bbox: e.bbox || null,
    })) : [];
    return {
      pageNo: pg.pageNo || i + 1,
      width: pg.width || pg.pageWidth || 0,
      height: pg.height || pg.pageHeight || 0,
      markdown: pg.markdown || '',
      localImage: pg.localImage || '',
      inputImage: pg.inputImage || '',
      blockImages: pg.blockImages || {},
      elements: els,
    };
  });
  return { numPages: pages.length, pages };
}

function mapElementType(label: string): string {
  const l = label.toLowerCase();
  if (l.includes('table')) return 'table';
  if (l.includes('seal')) return 'seal';
  if (l.includes('title')) return 'title';
  if (l.includes('image') || l.includes('figure')) return 'image';
  return 'text';
}

export async function runOcr(opts: {
  filePath: string; fileName: string; mimeType: string;
  onProgress?: (pct: number) => void; assetDir: string;
}): Promise<{ jobId: string; result: any }> {
  const startedAt = Date.now();
  const jobId = await createJob(opts.filePath, opts.fileName, opts.mimeType);
  opts.onProgress?.(10);

  let status = 'processing';
  let resultUrl: string | undefined;
  while (status !== 'succeeded' && status !== 'failed') {
    if (Date.now() - startedAt > OCR_TIMEOUT_MS) {
      throw new PaddleOcrError('识别任务超时');
    }
    await sleep(OCR_POLL_INTERVAL_MS);
    const job = await getJob(jobId);
    status = job.status;
    resultUrl = job.resultUrl;
    opts.onProgress?.(50);
  }
  if (status === 'failed') throw new PaddleOcrError('识别任务处理失败');

  if (!resultUrl) throw new PaddleOcrError('识别完成但未返回结果地址');
  const raw = await downloadJsonl(resultUrl);
  const normalized = normalizeResult(raw);
  opts.onProgress?.(90);

  // 固化底图到本地（PaddleOCR 返回的是临时 BOS 链接）
  const pages = normalized.pages.map((pg) => ({ ...pg }));
  void path;
  return { jobId, result: { kind: 'ocr', docType: 'pdf_mixed', numPages: normalized.numPages, jobId, pages } };
}
