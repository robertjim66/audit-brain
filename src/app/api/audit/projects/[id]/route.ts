import { withHandler, readJson, ApiError } from '@/lib/http';
import { requireAuth } from '@/lib/auth';
import db from '@/lib/db';
import { assertProject, assertProjectOwner } from '@/lib/audit/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/audit/projects/:id —— 详情（含统计）。成员可读。
export const GET = withHandler(async (req, ctx) => {
  const auth = await requireAuth(req);
  const id = ctx.params.id;
  await assertProject(id, auth.userId);
  const [rows]: any = await db.query(
    `SELECT p.*,
       u.username AS owner_username, u.nickname AS owner_nickname,
       (SELECT COUNT(*) FROM audit_document d WHERE d.project_id=p.id AND d.del_flag=0) AS doc_count,
       (SELECT COUNT(*) FROM audit_document d WHERE d.project_id=p.id AND d.del_flag=0 AND d.parse_status='done') AS parsed_count,
       (SELECT COUNT(*) FROM audit_document d WHERE d.project_id=p.id AND d.del_flag=0 AND d.parse_status='failed') AS failed_count,
       (SELECT COUNT(*) FROM audit_finding f WHERE f.project_id=p.id AND f.del_flag=0) AS finding_count
     FROM audit_project p
     LEFT JOIN sl_sys_user u ON u.id = p.user_id
     WHERE p.id=? AND p.del_flag=0`,
    [id]
  );
  if (rows.length === 0) throw new ApiError(404, '项目不存在');

  // 项目内角色：决定前端是否展示「编辑/成员管理」等 owner 专属操作
  const [m]: any = await db.query(
    'SELECT project_role FROM audit_project_member WHERE project_id=? AND user_id=? AND del_flag=0 LIMIT 1',
    [id, auth.userId]
  );
  const myRole = m.length ? m[0].project_role : (String(rows[0].user_id) === String(auth.userId) ? 'owner' : null);
  return Response.json({
    ...rows[0],
    id: String(rows[0].id),
    user_id: String(rows[0].user_id),
    my_role: myRole,
    can_manage: myRole === 'owner',
  });
});

// PUT /api/audit/projects/:id —— 更新。仅 owner。
export const PUT = withHandler(async (req, ctx) => {
  const auth = await requireAuth(req);
  const id = ctx.params.id;
  await assertProjectOwner(id, auth.userId);
  const fields = ['project_name', 'project_code', 'audit_type', 'audit_period', 'description', 'status', 'remark'];
  const sets: string[] = [];
  const params: any[] = [];
  const body = await readJson(req);
  fields.forEach((f) => {
    if (body && Object.prototype.hasOwnProperty.call(body, f)) {
      sets.push(`${f} = ?`);
      params.push(body[f]);
    }
  });
  if (sets.length === 0) throw new ApiError(400, '没有可更新字段');
  sets.push('updated_by = ?');
  params.push(auth.userId);
  params.push(id);
  await db.query(`UPDATE audit_project SET ${sets.join(', ')} WHERE id=?`, params);
  const [rows]: any = await db.query('SELECT * FROM audit_project WHERE id=?', [id]);
  return Response.json({ ...rows[0], id: String(rows[0].id), user_id: String(rows[0].user_id), my_role: 'owner', can_manage: true });
});

// DELETE /api/audit/projects/:id —— 软删（级联资料/要素）。仅 owner。
export const DELETE = withHandler(async (req, ctx) => {
  const auth = await requireAuth(req);
  const id = ctx.params.id;
  await assertProjectOwner(id, auth.userId);
  await db.query('UPDATE audit_project SET del_flag=1, updated_by=? WHERE id=?', [auth.userId, id]);
  await db.query('UPDATE audit_document SET del_flag=1 WHERE project_id=?', [id]);
  await db.query('UPDATE audit_element SET del_flag=1 WHERE project_id=?', [id]);
  return Response.json({ success: true });
});
