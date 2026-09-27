import { requireAuth } from '@/lib/auth';
import { ok, withHandler } from '@/lib/http';
import db from '@/lib/db';
import { parseDocument } from '@/lib/parse/parseService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

let parseChain: Promise<any> = Promise.resolve();
function enqueueParse(documentId: string | number, userId: string) {
  parseChain = parseChain
    .then(() => parseDocument(documentId, userId))
    .catch((err) => console.error('[audit] 批量解析异常:', err?.message));
}

const STALE_MS = Number(process.env.PARSE_STALE_MS || 15 * 60 * 1000);
function isStale(status: string, updatedAt: any): boolean {
  if (status !== 'processing') return false;
  const t = updatedAt ? new Date(updatedAt).getTime() : 0;
  return !Number.isFinite(t) || t === 0 || Date.now() - t > STALE_MS;
}

export const POST = withHandler(async (req, ctx) => {
  const auth = await requireAuth(req);
  const body = await req.json().catch(() => ({}));
  const ids: any[] = Array.isArray(body?.ids) ? body.ids : [];
  let count = 0;
  for (const id of ids.slice(0, 50)) {
    const [rows]: any = await db.query('SELECT parse_status, updated_at FROM audit_document WHERE id=? AND del_flag=0', [id]);
    if (rows.length !== 1) continue;
    if (rows[0].parse_status === 'processing' && !isStale(rows[0].parse_status, rows[0].updated_at)) continue;
    enqueueParse(id, auth.userId);
    count++;
  }
  return ok({ success: true, count, requested: ids.length });
});
