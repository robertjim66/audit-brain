-- =====================================================================
-- 项目成员表：支持一个审计项目由多人协作
-- 本文件由 scripts/migrate.mjs 按版本顺序自动执行，无需单独运行。
-- 背景：audit_project.user_id 是单值字段，一个项目只能有一个归属人；全库
--       此前没有任何成员/协作者概念。管理员建的项目，审计员登录后看不到、
--       直接访问接口也会被 assertProject 拒为 403。
--       现引入成员表：owner 可添加/移除成员并编辑项目，reviewer 可参与
--       资料、问答、核对、疑点等业务操作，但不能管理成员。
-- 说明：owner 语义即「项目归属人」，与 audit_project.user_id 一致，
--       创建项目时自动写入成员表；保留 user_id 是为了兼容既有索引与
--       「我创建的项目」这一列表排序语义。
-- 存量项目的 owner 回填由 src/lib/audit/member.ts 的 backfillOwners()
-- 幂等执行（需要雪花 ID，不能在纯 SQL 里推导），无需在迁移中处理。
-- =====================================================================

CREATE TABLE IF NOT EXISTS `audit_project_member` (
  `id` bigint UNSIGNED NOT NULL COMMENT '成员关系ID（雪花算法）',
  `project_id` bigint UNSIGNED NOT NULL COMMENT '审计项目ID',
  `user_id` bigint UNSIGNED NOT NULL COMMENT '用户ID',
  `project_role` varchar(20) NOT NULL DEFAULT 'reviewer' COMMENT '项目角色：owner项目归属人/reviewer复核人',
  `del_flag` tinyint NOT NULL DEFAULT 0 COMMENT '删除标志（0正常 1删除）',
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_project_user` (`project_id`, `user_id`) USING BTREE,
  KEY `idx_user` (`user_id`, `del_flag`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审计项目成员表（owner/reviewer）';
