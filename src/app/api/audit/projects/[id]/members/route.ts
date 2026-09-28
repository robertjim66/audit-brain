import { requireAuth } from '@/lib/auth';
import { ok, withHandler, ApiError, readJson } from '@/lib/http';
import db from '@/lib/db';
import { assertProject, assertProjectOwner } from '@/lib/audit/guard';
import { addMember, listMembers, removeMember, PROJECT_ROLES, type ProjectRole } from '@/lib/audit/member';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET —— 成员列表。项目成员可读。 */
export const GET = withHandler(async (req, ctx) => {
  const auth = await requireAuth(req);
  const projectId = ctx.params.id;
  await assertProject(projectId, auth.userId);
  return ok(await listMembers(projectId));
});

/** POST —— 添加/调整成员。仅 owner。 */
export const POST = withHandler(async (req, ctx) => {
  const auth = await requireAuth(req);
  const projectId = ctx.params.id;
  await assertProjectOwner(projectId, auth.userId);

  const body = await readJson<{ user_id?: string; project_role?: string }>(req);
  const userId = String(body?.user_id || '').trim();
  if (!userId) throw new ApiError(400, '请选择用户');

  const role = String(body?.project_role || 'reviewer') as ProjectRole;
  if (!PROJECT_ROLES.includes(role)) {
    throw new ApiError(400, `项目角色只能是 ${PROJECT_ROLES.join(' / ')}`);
  }
  // 一个项目只允许一个 owner，避免出现「无主项目」或权限歧义
  if (role === 'owner') {
    const [existing]: any = await db.query(
      "SELECT user_id FROM audit_project_member WHERE project_id=? AND project_role='owner' AND del_flag=0 AND user_id<>?",
      [projectId, userId]
    );
    if (existing.length) {
      throw new ApiError(400, '该项目已有归属人，如需移交请先移除原 owner 再添加');
    }
  }

  const [users]: any = await db.query('SELECT id, username, nickname FROM sl_sys_user WHERE id=? AND del_flag=0', [userId]);
  if (users.length === 0) throw new ApiError(404, '用户不存在');
  if (userId === String(auth.userId)) throw new ApiError(400, '不能调整自己的项目角色');

  await addMember(projectId, userId, role, auth.userId);
  return ok({ success: true, members: await listMembers(projectId) });
});

/** DELETE —— 移除成员。仅 owner，且不能移除 owner 本人。 */
export const DELETE = withHandler(async (req, ctx) => {
  const auth = await requireAuth(req);
  const projectId = ctx.params.id;
  await assertProjectOwner(projectId, auth.userId);

  const memberId = String(req.nextUrl.searchParams.get('member_id') || '').trim();
  if (!memberId) throw new ApiError(400, '缺少 member_id');
  if (memberId === String(auth.userId)) throw new ApiError(400, '不能移除自己的项目角色');

  await removeMember(projectId, memberId);
  return ok({ success: true, members: await listMembers(projectId) });
});
