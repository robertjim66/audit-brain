/**
 * 文件存储薄适配层
 * 把「审计原件 + 解析产物」的读写与具体介质解耦，业务代码只依赖本接口。
 *  - local：读写 public/uploads 下的本地文件（本地开发默认，历史数据亦在此）
 *  - db   ：读写 audit_document_blob 表 LONGBLOB（适配 EdgeOne 等无持久盘环境）
 * 由 env STORAGE_DRIVER 切换（'db' 启用数据库驱动，其余一律 local）。
 *
 * key 为相对路径，沿用原有目录布局，使 local 与 db 两套驱动共用同一套键：
 *   2026/10/07/<16字节hex>.pdf          原件
 *   audit-parse/{documentId}/result.json  解析结果
 *   audit-parse/{documentId}/content.md   解析全文
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import db from './db';

export interface PutMeta {
  contentType?: string | null;
  documentId?: string | number | null;
}

export interface StorageDriver {
  put(key: string, data: Buffer, meta?: PutMeta): Promise<void>;
  /** 命中返回内容，缺失返回 null（不抛异常，交由调用方决定 404 或重新上传） */
  get(key: string): Promise<Buffer | null>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
}

const LOCAL_ROOT = path.join(process.cwd(), 'public', 'uploads');

/** 把相对 key 安全地映射到本地磁盘路径，拒绝越出 UPLOAD_ROOT */
function localPathOf(key: string): string {
  const cleaned = String(key || '').replace(/^[/\\]+/, '');
  const target = path.normalize(path.join(LOCAL_ROOT, cleaned));
  if (target !== LOCAL_ROOT && !target.startsWith(LOCAL_ROOT + path.sep)) {
    throw new Error('非法存储键');
  }
  return target;
}

/** 从 file_url（/api/files/<key> 或历史 /uploads/<key>）还原存储键 */
export function keyFromFileUrl(fileUrl?: string | null): string | null {
  const m = String(fileUrl || '').match(/^\/(?:api\/files|uploads)\/(.+)$/);
  return m ? m[1] : null;
}

const localDriver: StorageDriver = {
  async put(key, data) {
    const fp = localPathOf(key);
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    fs.writeFileSync(fp, data);
  },
  async get(key) {
    const fp = localPathOf(key);
    return fs.existsSync(fp) && fs.statSync(fp).isFile() ? fs.readFileSync(fp) : null;
  },
  async exists(key) {
    const fp = localPathOf(key);
    return fs.existsSync(fp) && fs.statSync(fp).isFile();
  },
  async delete(key) {
    const fp = localPathOf(key);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  },
};

const dbDriver: StorageDriver = {
  async put(key, data, meta) {
    const sha = crypto.createHash('sha256').update(data).digest('hex');
    await db.query(
      `INSERT INTO audit_document_blob (storage_key, document_id, content, size, sha256, content_type)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE content=VALUES(content), size=VALUES(size), sha256=VALUES(sha256),
         content_type=VALUES(content_type), document_id=VALUES(document_id), updated_at=NOW(3)`,
      [key, meta?.documentId ?? null, data, data.length, sha, meta?.contentType ?? null]
    );
  },
  async get(key) {
    const [rows]: any = await db.query('SELECT content FROM audit_document_blob WHERE storage_key=? LIMIT 1', [key]);
    if (!rows.length || rows[0].content == null) return null;
    return Buffer.isBuffer(rows[0].content) ? rows[0].content : Buffer.from(rows[0].content);
  },
  async exists(key) {
    const [rows]: any = await db.query('SELECT 1 FROM audit_document_blob WHERE storage_key=? LIMIT 1', [key]);
    return rows.length > 0;
  },
  async delete(key) {
    await db.query('DELETE FROM audit_document_blob WHERE storage_key=?', [key]);
  },
};

export const STORAGE_DRIVER: 'local' | 'db' = process.env.STORAGE_DRIVER === 'db' ? 'db' : 'local';

const storage: StorageDriver = STORAGE_DRIVER === 'db' ? dbDriver : localDriver;

export default storage;