import { withHandler, readJson, ApiError } from '@/lib/http';
import { requireAuth, isAdmin } from '@/lib/auth';
import db from '@/lib/db';
import snowflake from '@/lib/snowflake';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/audit/projects —— 项目列表（当前用户；管理员可见全部）
export const GET = withHandler(async (req) => {
  const auth = await requireAuth(req);
  const keyword = new URL(req.url).searchParams.get('keyword')?.trim() || '';
  const admin = await isAdmin(auth.userId);

  const where = ['p.del_flag = 0'];
  const params: any[] = [];
  if (!admin) {
    where.push('p.user_id = ?');
    params.push(auth.userId);
  }
  if (keyword) {
    where.push('(p.project_name LIKE ? OR p.project_code LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  const [rows]: any = await db.query(
    `SELECT p.*,
       u.username AS owner_username, u.nickname AS owner_nickname,
       (SELECT COUNT(*) FROM audit_document d WHERE d.project_id=p.id AND d.del_flag=0) AS doc_count,
       (SELECT COUNT(*) FROM audit_document d WHERE d.project_id=p.id AND d.del_flag=0 AND d.parse_status='done') AS parsed_count,
       (SELECT COUNT(*) FROM audit_finding f WHERE f.project_id=p.id AND f.del_flag=0) AS finding_count
     FROM audit_project p
     LEFT JOIN sl_sys_user u ON u.id = p.user_id
     WHERE ${where.join(' AND ')}
     ORDER BY p.updated_at DESC, p.id DESC LIMIT 200`,
    params
  );
  return Response.json(rows.map((r: any) => ({ ...r, id: String(r.id), user_id: String(r.user_id) })));
});

// POST /api/audit/projects —— 新建项目
export const POST = withHandler(async (req) => {
  const auth = await requireAuth(req);
  const { project_name, project_code, audit_type, audit_period, description } =
    await readJson<{ project_name?: string; project_code?: string; audit_type?: string; audit_period?: string; description?: string }>(req);

  if (!project_name || !String(project_name).trim()) {
    throw new ApiError(400, '项目名称不能为空');
  }
  const id = snowflake.nextId();
  await db.query(
    `INSERT INTO audit_project
      (id, project_name, project_code, audit_type, audit_period, description, status, user_id, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    [
      id,
      String(project_name).trim().slice(0, 200),
      project_code || null,
      audit_type || 'cost',
      audit_period || null,
      description || null,
      auth.userId,
      auth.userId,
      auth.userId,
    ]
  );
  const [rows]: any = await db.query('SELECT * FROM audit_project WHERE id = ?', [id]);
  return Response.json({ ...rows[0], id: String(rows[0].id), user_id: String(rows[0].user_id) });
});
