import { requireAuth } from '@/lib/auth';
import { withHandler, ApiError } from '@/lib/http';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROOT = path.join(process.cwd(), 'public', 'uploads');
const MIME: Record<string, string> = {
  '.pdf': 'application/pdf', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.bmp': 'image/bmp', '.tif': 'image/tiff', '.tiff': 'image/tiff',
};

// 上传原件的通用文件服务（兼顾生产 build 后 public 快照不含运行时新增文件的情况）
export const GET = withHandler(async (req, ctx) => {
  await requireAuth(req);
  const rel = ctx.params.path as string[];
  const target = path.normalize(path.join(ROOT, ...rel));
  if (!target.startsWith(ROOT) || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
    throw new ApiError(404, '资源不存在');
  }
  const ext = path.extname(target).toLowerCase();
  const data = fs.readFileSync(target);
  return new Response(data, { headers: { 'Content-Type': MIME[ext] || 'application/octet-stream' } });
});
