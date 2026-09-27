import { requireAuth } from '@/lib/auth';
import { ok, withHandler, ApiError } from '@/lib/http';
import db from '@/lib/db';
import { parseDocument } from '@/lib/parse/parseService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 解析串行队列（避免多文件并发触发在线 OCR 限流）
let parseChain: Promise<any> = Promise.resolve();
function enqueueParse(documentId: string | number, userId: string) {
  parseChain = parseChain
    .then(() => parseDocument(documentId, userId))
    .catch((err) => console.error('[audit] 解析队列异常:', err?.message));
}

const STALE_MS = Number(process.env.PARSE_STALE_MS || 15 * 60 * 1000);
function isStale(doc: any): boolean {
  if (!doc || doc.parse_status !== 'processing') return false;
  const t = doc.updated_at ? new Date(doc.updated_at).getTime() : 0;
  return !Number.isFinite(t) || t === 0 || Date.now() - t > STALE_MS;
}

export const POST = withHandler(async (req, ctx) => {
  const auth = await requireAuth(req);
  const id = ctx.params.id;
  const [rows]: any = await db.query('SELECT id, parse_status, updated_at FROM audit_document WHERE id=? AND del_flag=0', [id]);
  if (rows.length === 0) throw new ApiError(404, '资料不存在');
  const doc = rows[0];
  if (doc.parse_status === 'processing' && !isStale(doc)) {
    throw new ApiError(409, '该资料正在解析中');
  }
  const recovered = doc.parse_status === 'processing';
  enqueueParse(id, auth.userId);
  return ok({
    success: true,
    recovered,
    message: recovered ? '检测到解析任务已中断，已重新入队' : '已加入解析队列',
  });
});
