import { requireAuth } from '@/lib/auth';
import { ok, withHandler, ApiError } from '@/lib/http';
import db from '@/lib/db';
import snowflake from '@/lib/snowflake';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { parseDocument } from '@/lib/parse/parseService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UPLOAD_ROOT = path.join(process.cwd(), 'public', 'uploads');
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

let parseChain: Promise<any> = Promise.resolve();
function enqueueParse(documentId: string | number, userId: string) {
  parseChain = parseChain
    .then(() => parseDocument(documentId, userId))
    .catch((err) => console.error('[audit] 解析队列异常:', err?.message));
}

function dateDir(): string {
  const now = new Date();
  return path.join(
    String(now.getFullYear()),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  );
}
function fileUrlOf(filePath: string): string {
  const rel = path.relative(UPLOAD_ROOT, filePath).split(path.sep).join('/');
  return '/uploads/' + rel;
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
    const [proj]: any = await db.query('SELECT id FROM audit_project WHERE id=? AND del_flag=0', [projectId]);
    if (proj.length === 0) throw new ApiError(404, '审计项目不存在');
    finalProjectId = projectId;
  }

  const files = (form.getAll('files') as any[]).filter((f) => typeof f === 'object' && f && f.arrayBuffer);
  if (!files.length) throw new ApiError(400, '请选择文件');

  const created: any[] = [];
  for (const file of files.slice(0, 20)) {
    const id = snowflake.nextId();
    const dir = path.join(UPLOAD_ROOT, dateDir());
    fs.mkdirSync(dir, { recursive: true });
    const ext = path.extname(file.name || '').toLowerCase();
    if (!ALLOW_EXT[ext]) throw new ApiError(400, `不支持的文件类型：${ext}`);
    const fname = crypto.randomBytes(16).toString('hex') + ext;
    const fp = path.join(dir, fname);
    const buf = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(fp, buf);

    const url = fileUrlOf(fp);
    const dt = inferDocType(file.name, docType);
    const biz = inferBizCategory(file.name, bizCategory);
    await db.query(
      `INSERT INTO audit_document
        (id, project_id, file_name, file_url, file_path, file_size, mime_type, file_ext,
         doc_type, biz_category, parse_status, parse_progress, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?)`,
      [id, finalProjectId, file.name, url, fp, file.size, file.type || ALLOW_EXT[ext],
       ext, dt, biz, auth.userId, auth.userId]
    );
    const [rows]: any = await db.query('SELECT * FROM audit_document WHERE id=?', [id]);
    created.push(rows[0]);
    enqueueParse(id, auth.userId);
  }
  return ok({ success: true, documents: created });
});
