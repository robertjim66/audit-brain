import { requireAuth } from '@/lib/auth';
import { ok, withHandler, ApiError } from '@/lib/http';
import db from '@/lib/db';
import { assertDocument } from '@/lib/audit/guard';
import { enqueueParse } from '@/lib/parse/parseQueue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  const denied: string[] = [];
  for (const id of ids.slice(0, 50)) {
    let doc: any;
    try {
      doc = await assertDocument(id, auth.userId);
    } catch (e: any) {
      // 单份越权不应让整批失败，但必须如实回报哪些 id 没被受理
      if (e?.status === 403 || e?.status === 404) { denied.push(String(id)); continue; }
      throw e;
    }
    const [rows]: any = await db.query('SELECT parse_status, updated_at FROM audit_document WHERE id=? AND del_flag=0', [id]);
    if (rows.length !== 1) continue;
    if (rows[0].parse_status === 'processing' && !isStale(rows[0].parse_status, rows[0].updated_at)) continue;
    enqueueParse(id, auth.userId, '批量解析');
    count++;
  }
  if (denied.length && !count) throw new ApiError(403, `无权访问所选资料（${denied.length} 份）`);
  return ok({ success: true, count, requested: ids.length, denied });
});
