import { requireAuth } from '@/lib/auth';
import { ok, withHandler, ApiError } from '@/lib/http';
import db from '@/lib/db';
import snowflake from '@/lib/snowflake';
import { assertProject } from '@/lib/audit/guard';
import { enqueueParse } from '@/lib/parse/parseQueue';
import { invalidateProject } from '@/lib/audit/agent/projectStore';
import storage from '@/lib/storage';
import path from 'path';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOW_EXT: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

// 存储键按 YYYY/MM/DD 分层（统一用 / 分隔，作为 URL 与 DB key 均适用）
function dateDir(): string {
  const now = new Date();
  return `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
}
function inferDocType(fileName: string, hint?: string | null): string {
  const allow = ['pdf_text', 'pdf_mixed', 'pdf_scan', 'excel', 'word', 'photo', 'other'];
  if (hint && allow.includes(hint)) return hint;
  const ext = path.extname(fileName || '').toLowerCase();
  if (ext === '.pdf') return 'pdf_mixed';
  if (['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif', '.tif', '.tiff'].includes(ext)) return 'photo';
  if (['.xlsx', '.xls'].includes(ext)) return 'excel';
  if (['.docx', '.doc'].includes(ext)) return 'word';
  return 'other';
}
function inferBizCategory(fileName: string, hint?: string | null): string {
  const allow = ['contract', 'boq', 'control_price', 'settlement', 'payment', 'visa', 'photo', 'invoice', 'other'];
  if (hint && allow.includes(hint)) return hint;
  const n = String(fileName || '');
  if (/合同|协议/.test(n)) return 'contract';
  if (/签证|变更|洽商|联系单/.test(n)) return 'visa';
  if (/清单|招标|控制价/.test(n)) return /控制价/.test(n) ? 'control_price' : 'boq';
  if (/结算|决算|审核/.test(n)) return 'settlement';
  if (/付款|支付|进度款/.test(n)) return 'payment';
  if (/发票|票据/.test(n)) return 'invoice';
  if (/\.(png|jpe?g|webp|bmp|tif{1,2})$/i.test(n)) return 'photo';
  return 'other';
}

export const POST = withHandler(async (req) => {
  const auth = await requireAuth(req);
  const form = await req.formData();
  const projectId = (form.get('project_id') as string | null)?.toString().trim() || '';
  const docType = (form.get('doc_type') as string | null)?.toString() || null;
  const bizCategory = (form.get('biz_category') as string | null)?.toString() || null;

  let finalProjectId: string | null = null;
  if (projectId) {
    // 校验归属而非仅校验存在：否则任何登录用户都能往他人项目里塞文件
    await assertProject(projectId, auth.userId);
    finalProjectId = projectId;
  }

  const files = (form.getAll('files') as any[]).filter((f) => typeof f === 'object' && f && f.arrayBuffer);
  if (!files.length) throw new ApiError(400, '请选择文件');

  const created: any[] = [];
  for (const file of files.slice(0, 20)) {
    const id = snowflake.nextId();
    const ext = path.extname(file.name || '').toLowerCase();
    if (!ALLOW_EXT[ext]) throw new ApiError(400, `不支持的文件类型：${ext}`);
    const fname = crypto.randomBytes(16).toString('hex') + ext;
    // 存储键即相对路径；local 驱动落到 public/uploads，db 驱动落到 audit_document_blob
    const key = `${dateDir()}/${fname}`;
    const buf = Buffer.from(await file.arrayBuffer());
    await storage.put(key, buf, { contentType: file.type || ALLOW_EXT[ext], documentId: id });

    // file_url 一律走带鉴权的 /api/files/*；file_path 保存存储键（相对路径）
    const url = '/api/files/' + key;
    const dt = inferDocType(file.name, docType);
    const biz = inferBizCategory(file.name, bizCategory);
    await db.query(
      `INSERT INTO audit_document
        (id, project_id, file_name, file_url, file_path, file_size, mime_type, file_ext,
         doc_type, biz_category, parse_status, parse_progress, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?)`,
      [id, finalProjectId, file.name, url, key, file.size, file.type || ALLOW_EXT[ext],
       ext, dt, biz, auth.userId, auth.userId]
    );
    const [rows]: any = await db.query('SELECT * FROM audit_document WHERE id=?', [id]);
    created.push(rows[0]);
    enqueueParse(id, auth.userId);
  }
  // 新资料会改变 Agent 的取证语料，旧的 projectStore 缓存必须立即失效
  invalidateProject(finalProjectId);
  return ok({ success: true, documents: created });
});
