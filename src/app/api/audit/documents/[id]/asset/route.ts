import { requireAuth } from '@/lib/auth';
import { withHandler, ApiError } from '@/lib/http';
import db from '@/lib/db';
import { assertDocument } from '@/lib/audit/guard';
import fs from 'fs';
import path from 'path';
import { resultDir } from '@/lib/parse/parseService';

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
  if (!rel || rel.includes('\0')) throw new ApiError(400, '非法路径');
  const base = resultDir(ctx.params.id);
  const target = path.normalize(path.join(base, rel));
  if (!target.startsWith(base) || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
    throw new ApiError(404, '资源不存在');
  }
  const ext = path.extname(target).toLowerCase();
  const data = fs.readFileSync(target);
  return new Response(data, { headers: { 'Content-Type': MIME[ext] || 'application/octet-stream' } });
});
