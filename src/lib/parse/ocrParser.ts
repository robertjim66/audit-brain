/**
 * OCR 解析器封装
 * 调用 PaddleOCR-VL，组织 pages/elements 结构；无密钥时由 paddleOcrClient 抛出 PaddleOcrError。
 */
import { runOcr } from './paddleOcrClient';

function labelCn(t: string): string {
  switch (t) {
    case 'table': return '表格';
    case 'seal': return '印章';
    case 'title': return '标题';
    case 'image': return '图片';
    default: return '文本';
  }
}

export async function parseOcr(opts: {
  filePath: string; fileName: string; mimeType: string;
  assetDir: string; onProgress?: (pct: number) => void;
}): Promise<{ result: any; jobId: string }> {
  const r = await runOcr(opts);
  const pages = (r.result.pages || []).map((pg: any) => ({
    ...pg,
    elements: (pg.elements || []).map((e: any) => ({
      ...e,
      anchorLabel: `第 ${pg.pageNo} 页·${labelCn(e.elementType)}`,
    })),
  }));
  return {
    result: {
      kind: 'ocr',
      docType: r.result.docType,
      numPages: r.result.numPages,
      jobId: r.result.jobId,
      pages,
    },
    jobId: r.jobId,
  };
}
