/**
 * 解析串行队列（全局唯一）。
 * 上传、单份重解析、批量解析三条入口必须共用同一条链，否则并发调用在线 OCR 会触发限流。
 */
import { parseDocument } from '@/lib/parse/parseService';

let chain: Promise<any> = Promise.resolve();

/** 把一份资料排入解析队列；不阻塞请求返回 */
export function enqueueParse(documentId: string | number, userId: string, tag = '解析'): void {
  chain = chain
    .then(() => parseDocument(documentId, userId))
    .catch((err) => console.error(`[audit] ${tag}队列异常:`, err?.message));
}
