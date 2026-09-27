-- =====================================================================
-- 资料表放宽 project_id 约束：支持不绑定项目的独立资料
-- 本文件由 scripts/migrate.mjs 按版本顺序自动执行，无需单独运行。
-- 背景：资料上传管线在 project_id 为空时写入 NULL；解析流水线 parseService
--       会为每个解析要素写入 doc.project_id。若这两列仍为 NOT NULL，
--       上传 / 解析会直接失败（Column 'project_id' cannot be null）。
--       现将其改为可空，使资料与解析要素可不依赖具体审计项目存在。
-- =====================================================================

-- 1. audit_document.project_id 改为可空
ALTER TABLE `audit_document`
  MODIFY COLUMN `project_id` bigint UNSIGNED DEFAULT NULL COMMENT '所属审计项目ID（可选，NULL 表示不绑定项目的独立资料）';

-- 2. audit_element.project_id 改为可空
ALTER TABLE `audit_element`
  MODIFY COLUMN `project_id` bigint UNSIGNED DEFAULT NULL COMMENT '所属审计项目ID（可选，NULL 表示不绑定项目的独立资料要素）';
