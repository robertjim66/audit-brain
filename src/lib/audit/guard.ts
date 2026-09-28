import db from '@/lib/db';
import { isAdmin } from '@/lib/auth';
import { ApiError } from '@/lib/http';

/** 校验审计项目存在且当前用户有权访问（管理员可访问全部，普通用户仅自己创建的） */
export async function assertProject(projectId: string | number, userId: string, adminFallback = true): Promise<void> {
  const [proj]: any = await db.query('SELECT id, user_id FROM audit_project WHERE id=? AND del_flag=0', [projectId]);
  if (!proj.length) throw new ApiError(404, '项目不存在');
  if (adminFallback && (await isAdmin(userId))) return;
  if (String(proj[0].user_id) !== String(userId)) throw new ApiError(403, '无权访问该项目');
}

/**
 * 校验资料存在且当前用户有权访问。
 * 资料可能未绑定项目（project_id 为空），这类游离资料仅允许其上传者本人访问。
 */
export async function assertDocument(documentId: string | number, userId: string): Promise<any> {
  const [rows]: any = await db.query('SELECT id, project_id, created_by FROM audit_document WHERE id=? AND del_flag=0', [documentId]);
  if (!rows.length) throw new ApiError(404, '资料不存在');
  const doc = rows[0];
  if (doc.project_id != null && doc.project_id !== '') {
    await assertProject(doc.project_id, userId);
    return doc;
  }
  if (await isAdmin(userId)) return doc;
  if (String(doc.created_by) === String(userId)) return doc;
  throw new ApiError(403, '无权访问该资料');
}
