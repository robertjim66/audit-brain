import { requireAuth } from '@/lib/auth';
import { withHandler, ApiError } from '@/lib/http';
import { assertDocument } from '@/lib/audit/guard';
import storage from '@/lib/storage';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIME: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.bmp': 'image/bmp', '.tif': 'image/tiff', '.tiff': 'image/tiff',
  '.json': 'application/json', '.md': 'text/markdown', '.txt': 'text/plain',
};

export const GET = withHandler(async (req, ctx) => {
  const auth = await requireAuth(req);
  await assertDocument(ctx.params.id, auth.userId);
  const rel = String(req.nextUrl.searchParams.get('path') || '');
  if (!rel || rel.includes('\0') || rel.includes('..')) throw new ApiError(400, '非法路径');

  // 解析产物统一存放于 audit-parse/{documentId}/ 前缀下
  const data = await storage.get(`audit-parse/${ctx.params.id}/${rel.replace(/^[/\\]+/, '')}`);
  if (!data) throw new ApiError(404, '资源不存在');

  const ext = path.extname(rel).toLowerCase();
  return new Response(new Uint8Array(data), { headers: { 'Content-Type': MIME[ext] || 'application/octet-stream' } });
});