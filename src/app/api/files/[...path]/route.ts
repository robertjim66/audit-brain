import { requireAuth } from '@/lib/auth';
import { withHandler, ApiError } from '@/lib/http';
import db from '@/lib/db';
import { assertDocument } from '@/lib/audit/guard';
import storage from '@/lib/storage';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIME: Record<string, string> = {
  '.pdf': 'application/pdf', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.bmp': 'image/bmp', '.tif': 'image/tiff', '.tiff': 'image/tiff',
};

/**
 * 把请求的相对路径（即存储键）映射回它所属的资料，用于做归属校验。
 * 原件按 file_url / file_path 匹配；解析产物走 audit-parse/{documentId}/ 前缀。
 */
async function resolveOwnerDocument(relKey: string): Promise<string> {
  const [rows]: any = await db.query(
    `SELECT id FROM audit_document
      WHERE del_flag=0 AND (file_url=? OR file_path=? OR file_url=?)
      LIMIT 1`,
    ['/api/files/' + relKey, relKey, '/uploads/' + relKey]
  );
  if (rows.length) return String(rows[0].id);

  const parts = relKey.split('/');
  if (parts[0] === 'audit-parse' && /^\d+$/.test(parts[1] || '')) return parts[1];
  throw new ApiError(404, '资源不存在');
}

// 上传原件的通用文件服务（同样承接历史 /uploads/* 的 rewrite 转发）
export const GET = withHandler(async (req, ctx) => {
  const auth = await requireAuth(req);
  const relKey = (ctx.params.path as string[]).join('/');
  const docId = await resolveOwnerDocument(relKey);
  await assertDocument(docId, auth.userId);

  const data = await storage.get(relKey);
  if (!data) throw new ApiError(404, '资源不存在');

  const ext = path.extname(relKey).toLowerCase();
  // 转成纯 Uint8Array，避免 Node Buffer 泛型与 BodyInit 类型不兼容
  return new Response(new Uint8Array(data), { headers: { 'Content-Type': MIME[ext] || 'application/octet-stream' } });
});