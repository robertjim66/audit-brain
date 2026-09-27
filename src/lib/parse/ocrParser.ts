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
      pageNo: pg.pageNo,
      anchorLabel: `第 ${pg.pageNo} 页·${labelCn(e.elementType)}`,
    })),
  }));
  // 顶层扁平要素：parseService 按此逐条入库（带 pageNo 与 bbox），证据锚点才能精确到块。
  // 不按内容空否过滤——图表/印章这类无文字块本身就是证据（findingScan 的「签章」校验就靠 seal 块计数）。
  const elements = pages.flatMap((pg: any) => pg.elements);
  // 全文：各页 markdown 顺序拼接，供 content.md 落盘与 summary_text 摘要使用
  const markdownText = pages
    .map((pg: any) => pg.markdown || '')
    .filter((t: string) => t.trim())
    .join('\n\n');
  return {
    result: {
      kind: 'ocr',
      docType: r.result.docType,
      numPages: r.result.numPages,
      jobId: r.result.jobId,
      pages,
      markdownText,
      elements,
    },
    jobId: r.jobId,
  };
}
