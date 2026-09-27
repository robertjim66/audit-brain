import { withHandler, readJson, ApiError } from '@/lib/http';
import { requireAuth } from '@/lib/auth';
import db from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/audit/projects/:id —— 详情（含统计）
export const GET = withHandler(async (req, ctx) => {
  await requireAuth(req);
  const id = ctx.params.id;
  const [rows]: any = await db.query(
    `SELECT p.*,
       (SELECT COUNT(*) FROM audit_document d WHERE d.project_id=p.id AND d.del_flag=0) AS doc_count,
       (SELECT COUNT(*) FROM audit_document d WHERE d.project_id=p.id AND d.del_flag=0 AND d.parse_status='done') AS parsed_count,
       (SELECT COUNT(*) FROM audit_document d WHERE d.project_id=p.id AND d.del_flag=0 AND d.parse_status='failed') AS failed_count,
       (SELECT COUNT(*) FROM audit_finding f WHERE f.project_id=p.id AND f.del_flag=0) AS finding_count
     FROM audit_project p WHERE p.id=? AND p.del_flag=0`,
    [id]
  );
  if (rows.length === 0) throw new ApiError(404, '项目不存在');
  return Response.json({ ...rows[0], id: String(rows[0].id), user_id: String(rows[0].user_id) });
});

// PUT /api/audit/projects/:id —— 更新
export const PUT = withHandler(async (req, ctx) => {
  const auth = await requireAuth(req);
  const id = ctx.params.id;
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
  return Response.json({ ...rows[0], id: String(rows[0].id), user_id: String(rows[0].user_id) });
});

// DELETE /api/audit/projects/:id —— 软删（级联资料/要素）
export const DELETE = withHandler(async (req, ctx) => {
  const auth = await requireAuth(req);
  const id = ctx.params.id;
  await db.query('UPDATE audit_project SET del_flag=1, updated_by=? WHERE id=?', [auth.userId, id]);
  await db.query('UPDATE audit_document SET del_flag=1 WHERE project_id=?', [id]);
  await db.query('UPDATE audit_element SET del_flag=1 WHERE project_id=?', [id]);
  return Response.json({ success: true });
});
