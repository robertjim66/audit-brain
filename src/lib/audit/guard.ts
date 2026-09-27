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
