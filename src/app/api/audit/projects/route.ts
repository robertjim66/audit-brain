import { withHandler, readJson, ApiError } from '@/lib/http';
import { requireAuth, isAdmin } from '@/lib/auth';
import db from '@/lib/db';
import snowflake from '@/lib/snowflake';
import { addMember, ensureMemberTable } from '@/lib/audit/member';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/audit/projects —— 项目列表（我参与的：owner + reviewer；管理员可见全部）
export const GET = withHandler(async (req) => {
  const auth = await requireAuth(req);
  const keyword = new URL(req.url).searchParams.get('keyword')?.trim() || '';
  const admin = await isAdmin(auth.userId);
  // 幂等建表 + 存量项目 owner 回填；本列表不经过 roleOf，需显式触发
  await ensureMemberTable();

  const where = ['p.del_flag = 0'];
  const params: any[] = [];
  if (!admin) {
    // 归属人 + 成员表两种来源都要算「我参与的」；成员表可能尚未建出，
    // 用 NOT EXISTS 判存在而不是 LEFT JOIN，避免建表前整个列表查不到数据。
    where.push(`(
      p.user_id = ?
      OR EXISTS (
        SELECT 1 FROM audit_project_member m
        WHERE m.project_id = p.id AND m.user_id = ? AND m.del_flag = 0
      )
    )`);
    params.push(auth.userId, auth.userId);
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
       (SELECT COUNT(*) FROM audit_finding f WHERE f.project_id=p.id AND f.del_flag=0) AS finding_count,
       (SELECT COUNT(*) FROM audit_project_member m WHERE m.project_id=p.id AND m.del_flag=0) AS member_count
     FROM audit_project p
     LEFT JOIN sl_sys_user u ON u.id = p.user_id
     WHERE ${where.join(' AND ')}
     ORDER BY p.updated_at DESC, p.id DESC LIMIT 200`,
    params
  );

  // 标出当前用户在该项目中的角色，供列表页显示「我负责/参与」
  const ids = rows.map((r: any) => String(r.id));
  const myRole: Record<string, string> = {};
  if (ids.length) {
    const [ms]: any = await db.query(
      `SELECT project_id, project_role FROM audit_project_member
       WHERE user_id = ? AND del_flag = 0 AND project_id IN (${ids.map(() => '?').join(',')})`,
      [auth.userId, ...ids]
    );
    ms.forEach((m: any) => { myRole[String(m.project_id)] = m.project_role; });
  }

  return Response.json(rows.map((r: any) => ({
    ...r,
    id: String(r.id),
    user_id: String(r.user_id),
    my_role: myRole[String(r.id)] || (String(r.user_id) === String(auth.userId) ? 'owner' : null),
    can_manage: myRole[String(r.id)] === 'owner' || String(r.user_id) === String(auth.userId),
  })));
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
  // 创建人自动成为 owner 成员，保证成员表与 user_id 语义一致
  await addMember(id, auth.userId, 'owner', auth.userId);

  const [rows]: any = await db.query('SELECT * FROM audit_project WHERE id = ?', [id]);
  return Response.json({ ...rows[0], id: String(rows[0].id), user_id: String(rows[0].user_id), my_role: 'owner', can_manage: true });
});
