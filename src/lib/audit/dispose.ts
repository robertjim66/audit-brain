/**
 * 疑点处置流水服务。
 *
 * 记录每次状态变更的操作人，用于「这条疑点是谁处理的、什么时候处理的」。
 *
 * 为什么要冗余 project_id / finding_type / title：
 *   findingScan 每次扫描都会把旧疑点软删、再以新雪花 ID 插入。若只按
 *   finding_id 关联，同一件事会散落在多个 ID 上，审计追溯需跨记录拼接。
 *   这里以「项目 + 类型 + 标题」为归档键，疑点记录无论怎么重建，
 *   同一件事的处置历史都能串起来。
 */
import db from '@/lib/db';
import snowflake from '@/lib/snowflake';

export const FINDING_STATUSES = ['open', 'confirmed', 'misreport', 'closed'] as const;
export type FindingStatus = (typeof FINDING_STATUSES)[number];

/** 归档键：项目 + 类型 + 标题。扫描重建时据此把处置沿用到新记录。 */
export function archiveKey(projectId: any, findingType: any, title: any): string {
  return `${projectId}|${findingType}|${title}`;
}

let ensured = false;

/** 幂等建表。进程内只跑一次。 */
export async function ensureDisposeTable(): Promise<void> {
  if (ensured) return;
  ensured = true;
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS audit_finding_dispose (
        id bigint UNSIGNED NOT NULL COMMENT '处置记录ID（雪花算法）',
        finding_id bigint UNSIGNED NOT NULL COMMENT '本次处置对应的疑点记录ID',
        project_id bigint UNSIGNED NOT NULL COMMENT '所属项目ID',
        finding_type varchar(40) NOT NULL COMMENT '归档键之一：疑点类型',
        title varchar(255) NOT NULL COMMENT '归档键之一：疑点标题',
        from_status varchar(20) DEFAULT NULL COMMENT '变更前状态',
        to_status varchar(20) NOT NULL COMMENT '变更后状态',
        operator_id bigint UNSIGNED NOT NULL COMMENT '操作人（处理人）',
        remark varchar(500) DEFAULT NULL COMMENT '本次处置备注快照',
        created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '处置时间',
        PRIMARY KEY (id),
        KEY idx_finding (finding_id, created_at),
        KEY idx_project (project_id, created_at),
        KEY idx_operator (operator_id),
        KEY idx_archive (project_id, finding_type, title(100))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='疑点处置流水表'
    `);
  } catch (e: any) {
    console.warn('[dispose] 建表失败，疑点处置人将不展示:', e?.message);
  }
}

/** 追加一条处置流水。 */
export async function recordDispose(p: {
  findingId: string | number;
  projectId: string | number;
  findingType: string;
  title: string;
  fromStatus: string | null;
  toStatus: string;
  operatorId: string | number;
  remark?: string | null;
}): Promise<void> {
  await ensureDisposeTable();
  await db.query(
    `INSERT INTO audit_finding_dispose
       (id, finding_id, project_id, finding_type, title, from_status, to_status, operator_id, remark)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [
      snowflake.nextId(),
      String(p.findingId),
      String(p.projectId),
      String(p.findingType || ''),
      String(p.title || ''),
      p.fromStatus,
      p.toStatus,
      String(p.operatorId),
      p.remark != null ? String(p.remark).slice(0, 500) : null,
    ]
  );
}

export interface DisposeEntry {
  id: string;
  from_status: string | null;
  to_status: string;
  remark: string | null;
  created_at: string;
  operator_id: string;
  username: string | null;
  nickname: string | null;
}

/** 某条疑点记录的完整处置历史，按时间正序。 */
export async function listDisposeOfFinding(findingId: string | number): Promise<DisposeEntry[]> {
  await ensureDisposeTable();
  const [rows]: any = await db.query(
    `SELECT d.id, d.from_status, d.to_status, d.remark, d.created_at, d.operator_id,
            u.username, u.nickname
     FROM audit_finding_dispose d
     LEFT JOIN sl_sys_user u ON u.id = d.operator_id
     WHERE d.finding_id = ?
     ORDER BY d.created_at ASC, d.id ASC`,
    [String(findingId)]
  );
  return rows.map((r: any) => ({
    ...r,
    id: String(r.id),
    operator_id: String(r.operator_id),
  }));
}

/**
 * 取一组疑点「最近一次处置」的操作人。
 * 只认 to_status != 'open' 的记录——待处理状态不构成处置。
 */
export async function latestHandlers(findingIds: string[]): Promise<Record<string, DisposeEntry>> {
  const out: Record<string, DisposeEntry> = {};
  if (!findingIds.length) return out;
  await ensureDisposeTable();
  const [rows]: any = await db.query(
    `SELECT d.finding_id, d.id, d.from_status, d.to_status, d.remark, d.created_at, d.operator_id,
            u.username, u.nickname
     FROM audit_finding_dispose d
     LEFT JOIN sl_sys_user u ON u.id = d.operator_id
     INNER JOIN (
       SELECT finding_id, MAX(created_at) AS mx
       FROM audit_finding_dispose
       WHERE finding_id IN (${findingIds.map(() => '?').join(',')})
         AND to_status <> 'open'
       GROUP BY finding_id
     ) t ON t.finding_id = d.finding_id AND t.mx = d.created_at
     WHERE d.finding_id IN (${findingIds.map(() => '?').join(',')})
       AND d.to_status <> 'open'`,
    [...findingIds, ...findingIds]
  );
  for (const r of rows) {
    const k = String(r.finding_id);
    // 同一毫秒可能有多条，取 id 最大的一条
    if (!out[k] || String(r.id) > String(out[k].id)) {
      out[k] = { ...r, id: String(r.id), operator_id: String(r.operator_id) };
    }
  }
  return out;
}
