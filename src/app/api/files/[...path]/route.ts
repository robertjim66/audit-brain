import { requireAuth } from '@/lib/auth';
import { withHandler, ApiError } from '@/lib/http';
import db from '@/lib/db';
import { assertDocument } from '@/lib/audit/guard';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROOT = path.join(process.cwd(), 'public', 'uploads');
// 解析产物目录与原件同级，同样可能含敏感全文，必须一并做归属校验
const PARSE_ROOT = path.join(ROOT, 'audit-parse');
const MIME: Record<string, string> = {
  '.pdf': 'application/pdf', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.bmp': 'image/bmp', '.tif': 'image/tiff', '.tiff': 'image/tiff',
};

/**
 * 把请求路径映射回它所属的资料，用于做归属校验。
 * 原件走 file_path 精确匹配；解析产物走 audit-parse/{documentId}/ 前缀。
 */
async function resolveOwnerDocument(target: string, relPath: string): Promise<string> {
  const [byPath]: any = await db.query('SELECT id FROM audit_document WHERE file_path=? AND del_flag=0 LIMIT 1', [target]);
  if (byPath.length) return String(byPath[0].id);

  const inParse = path.relative(PARSE_ROOT, target);
  if (inParse && !inParse.startsWith('..') && !path.isAbsolute(inParse)) {
    const docId = inParse.split(path.sep)[0];
    if (/^\d+$/.test(docId)) return docId;
  }
  throw new ApiError(404, '资源不存在');
}

// 上传原件的通用文件服务（兼顾生产 build 后 public 快照不含运行时新增文件的情况）
export const GET = withHandler(async (req, ctx) => {
  const auth = await requireAuth(req);
  const rel = ctx.params.path as string[];
  const target = path.normalize(path.join(ROOT, ...rel));
  if (!target.startsWith(ROOT) || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
    throw new ApiError(404, '资源不存在');
  }
  const docId = await resolveOwnerDocument(target, rel.join('/'));
  await assertDocument(docId, auth.userId);

  const ext = path.extname(target).toLowerCase();
  const data = fs.readFileSync(target);
  return new Response(data, { headers: { 'Content-Type': MIME[ext] || 'application/octet-stream' } });
});
