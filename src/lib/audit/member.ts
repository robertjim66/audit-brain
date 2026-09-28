/**
 * 项目成员服务（owner / reviewer）。
 *
 * 背景：audit_project.user_id 是单值字段，一个项目原本只能有一个归属人，
 * 导致「管理员建的项目，审计员看不到」——项目列表按 user_id 过滤，
 * assertProject 也只认归属人。现引入 audit_project_member 承载协作关系：
 *   owner    项目归属人，可编辑项目、管理成员
 *   reviewer 复核人，可参与资料/问答/核对/疑点等业务，但不能管理成员
 *
 * 可见性判定：系统管理员可见全部项目；其余用户按成员表。
 */
import db from '@/lib/db';
import snowflake from '@/lib/snowflake';
import { ApiError } from '@/lib/http';
import { isAdmin } from '@/lib/auth';

export const PROJECT_ROLES = ['owner', 'reviewer'] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

let ensured = false;

/** 幂等建表 + 存量项目 owner 回填。进程内只跑一次。 */
export async function ensureMemberTable(): Promise<void> {
  if (ensured) return;
  ensured = true;
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS audit_project_member (
        id bigint UNSIGNED NOT NULL COMMENT '成员关系ID（雪花算法）',
        project_id bigint UNSIGNED NOT NULL COMMENT '审计项目ID',
        user_id bigint UNSIGNED NOT NULL COMMENT '用户ID',
        project_role varchar(20) NOT NULL DEFAULT 'reviewer' COMMENT 'owner归属人/reviewer复核人',
        del_flag tinyint NOT NULL DEFAULT 0 COMMENT '删除标志（0正常 1删除）',
        created_by bigint UNSIGNED DEFAULT NULL,
        created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_by bigint UNSIGNED DEFAULT NULL,
        updated_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        remark varchar(500) DEFAULT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uk_project_user (project_id, user_id),
        KEY idx_user (user_id, del_flag)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审计项目成员表（owner/reviewer）'
    `);
  } catch (e: any) {
    // 权限不足等情况下置为已尝试，避免每请求重复建表刷日志
    console.warn('[member] 建表失败，降级为仅按归属人判定:', e?.message);
    return;
  }
  await backfillOwners();
}

/**
 * 把存量项目的归属人补写成 owner 成员。
 * 迁移文件不处理这一段：成员关系主键是雪花 ID，无法在纯 SQL 中安全推导。
 */
export async function backfillOwners(): Promise<number> {
  const [missing]: any = await db.query(
    `SELECT p.id, p.user_id
     FROM audit_project p
     WHERE p.del_flag = 0
       AND NOT EXISTS (
         SELECT 1 FROM audit_project_member m
         WHERE m.project_id = p.id AND m.user_id = p.user_id AND m.del_flag = 0
       )`
  );
  for (const p of missing) {
    await db.query(
      `INSERT IGNORE INTO audit_project_member (id, project_id, user_id, project_role, created_by)
       VALUES (?, ?, ?, 'owner', ?)`,
      [snowflake.nextId(), String(p.id), String(p.user_id), String(p.user_id)]
    );
  }
  if (missing.length) console.log(`[member] 已回填 ${missing.length} 个存量项目的 owner 成员`);
  return missing.length;
}

/** 取用户在某项目中的角色；非成员返回 null。 */
export async function roleOf(projectId: string | number, userId: string | number): Promise<ProjectRole | null> {
  await ensureMemberTable();
  const [rows]: any = await db.query(
    `SELECT project_role FROM audit_project_member
     WHERE project_id = ? AND user_id = ? AND del_flag = 0 LIMIT 1`,
    [String(projectId), String(userId)]
  );
  if (!rows.length) return null;
  const r = String(rows[0].project_role);
  return (PROJECT_ROLES as readonly string[]).includes(r) ? (r as ProjectRole) : 'reviewer';
}

/** 添加成员。已在成员表中则改角色。 */
export async function addMember(
  projectId: string | number,
  userId: string | number,
  role: ProjectRole,
  operatorId: string | number
): Promise<void> {
  const [exists]: any = await db.query(
    'SELECT id, project_role FROM audit_project_member WHERE project_id = ? AND user_id = ? LIMIT 1',
    [String(projectId), String(userId)]
  );
  if (exists.length) {
    await db.query(
      'UPDATE audit_project_member SET project_role = ?, del_flag = 0, updated_by = ? WHERE id = ?',
      [role, String(operatorId), String(exists[0].id)]
    );
    return;
  }
  await db.query(
    `INSERT INTO audit_project_member (id, project_id, user_id, project_role, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [snowflake.nextId(), String(projectId), String(userId), role, String(operatorId), String(operatorId)]
  );
}

/** 移除成员。归属人（owner）不可被移除。 */
export async function removeMember(projectId: string | number, memberId: string | number): Promise<void> {
  const [rows]: any = await db.query(
    'SELECT user_id, project_role FROM audit_project_member WHERE id = ? AND project_id = ? AND del_flag = 0',
    [String(memberId), String(projectId)]
  );
  if (!rows.length) throw new ApiError(404, '成员不存在');
  if (rows[0].project_role === 'owner') throw new ApiError(400, '项目归属人不可移除');
  await db.query('UPDATE audit_project_member SET del_flag = 1 WHERE id = ?', [String(memberId)]);
}

/** 项目成员列表（含用户信息）。 */
export async function listMembers(projectId: string | number) {
  const [rows]: any = await db.query(
    `SELECT m.id, m.user_id, m.project_role, m.created_at,
            u.username, u.nickname, u.email, u.is_admin
     FROM audit_project_member m
     LEFT JOIN sl_sys_user u ON u.id = m.user_id
     WHERE m.project_id = ? AND m.del_flag = 0
     ORDER BY FIELD(m.project_role, 'owner', 'reviewer'), m.created_at ASC`,
    [String(projectId)]
  );
  return rows.map((r: any) => ({
    ...r,
    id: String(r.id),
    user_id: String(r.user_id),
    is_admin: r.is_admin === 1,
  }));
}
