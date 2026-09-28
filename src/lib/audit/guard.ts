import db from '@/lib/db';
import { isAdmin } from '@/lib/auth';
import { ApiError } from '@/lib/http';
import { roleOf, type ProjectRole } from './member';

/**
 * 校验审计项目存在且当前用户有权访问。
 * 可见性：系统管理员可见全部；其余用户须为项目 owner 或 reviewer。
 */
export async function assertProject(projectId: string | number, userId: string, adminFallback = true): Promise<void> {
  const [proj]: any = await db.query('SELECT id, user_id FROM audit_project WHERE id=? AND del_flag=0', [projectId]);
  if (!proj.length) throw new ApiError(404, '项目不存在');
  if (adminFallback && (await isAdmin(userId))) return;
  // 成员表尚未建出时（老库未跑迁移）降级为「仅归属人可见」，保持既有行为
  const role = await roleOf(projectId, userId);
  if (role) return;
  if (String(proj[0].user_id) === String(userId)) return;
  throw new ApiError(403, '无权访问该项目');
}

/**
 * 校验项目归属人身份（owner）。仅 owner 可编辑项目、管理成员。
 * 系统管理员不自动视为 owner——跨项目改数据需显式授权，避免误删他人项目成员。
 */
export async function assertProjectOwner(projectId: string | number, userId: string, adminFallback = false): Promise<void> {
  const [proj]: any = await db.query('SELECT id, user_id FROM audit_project WHERE id=? AND del_flag=0', [projectId]);
  if (!proj.length) throw new ApiError(404, '项目不存在');
  const role = await roleOf(projectId, userId);
  if (role === 'owner') return;
  if (adminFallback && (await isAdmin(userId))) return;
  throw new ApiError(403, '仅项目归属人可执行此操作');
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

export type { ProjectRole };
