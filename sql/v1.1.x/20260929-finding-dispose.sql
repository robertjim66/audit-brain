-- =====================================================================
-- 疑点处置流水表：记录每次状态变更的操作人，用于定位责任
-- 本文件由 scripts/migrate.mjs 按版本顺序自动执行，无需单独运行。
-- 背景：audit_finding 此前只有 status 与 remark，没有任何操作人字段；
--       updated_by 会被疑点扫描重建覆盖（findingScan 软删旧记录后用新雪花
--       ID 重插，updated_by 被重置为扫描执行人），无法区分「人标的」与
--       「机器扫的」。
--
-- 归档设计：finding_scan 每次扫描都会把旧疑点软删并以新雪花 ID 重新插入，
--   只 finding_id 关联会让同一件事产生多个 ID，审计追溯时需跨记录拼接。
--   因此本表冗余 project_id / finding_type / title 作为业务归档键
--   （项目+类型+标题），无论疑点记录如何重建，同一件事的处置历史都能串联。
--   finding_id 保留为「本次处置对应的疑点记录」，便于从详情页直接查。
--
-- 说明：不建外键约束（与既有表风格一致，全部走软删 + 索引）。
-- =====================================================================

CREATE TABLE IF NOT EXISTS `audit_finding_dispose` (
  `id` bigint UNSIGNED NOT NULL COMMENT '处置记录ID（雪花算法）',
  `finding_id` bigint UNSIGNED NOT NULL COMMENT '本次处置对应的疑点记录ID',
  `project_id` bigint UNSIGNED NOT NULL COMMENT '所属项目ID',
  `finding_type` varchar(40) NOT NULL COMMENT '归档键之一：疑点类型',
  `title` varchar(255) NOT NULL COMMENT '归档键之一：疑点标题',
  `from_status` varchar(20) DEFAULT NULL COMMENT '变更前状态；首次处置或仅改备注时与 to_status 相同',
  `to_status` varchar(20) NOT NULL COMMENT '变更后状态',
  `operator_id` bigint UNSIGNED NOT NULL COMMENT '操作人（处理人）',
  `remark` varchar(500) DEFAULT NULL COMMENT '本次处置备注快照',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '处置时间',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_finding` (`finding_id`, `created_at`) USING BTREE,
  KEY `idx_project` (`project_id`, `created_at`) USING BTREE,
  KEY `idx_operator` (`operator_id`) USING BTREE,
  KEY `idx_archive` (`project_id`, `finding_type`, `title`(100)) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='疑点处置流水表（记录处理人与变更过程）';
