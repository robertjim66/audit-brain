-- =====================================================================
-- 审计资料二进制内容表：把「原件 + 解析产物」的字节落到数据库
-- 本文件由 scripts/migrate.mjs 按版本顺序自动执行，无需单独运行。
--
-- 背景：EdgeOne 等 Serverless 运行环境没有持久磁盘，向 public/uploads 落盘
--       的写入在函数实例回收后即丢失，导致上传/解析/下载全链路不可用。
--       现引入存储适配层（src/lib/storage.ts），由 STORAGE_DRIVER 切换
--       介质：local 仍写本地磁盘（本地开发/历史数据），db 写本表 LONGBLOB。
--
-- 设计：key 为相对存储路径（沿用原有目录布局，便于 local 与 db 双向兼容）：
--   doc 原件   ：2026/10/07/<16字节hex>.pdf
--   解析结果   ：audit-parse/{documentId}/result.json
--   解析全文   ：audit-parse/{documentId}/content.md
--   其他解析资产：audit-parse/{documentId}/<relpath>
--   document_id 冗余一列，便于按资料级联清理，不建外键（与既有表风格一致）。
--
-- 说明：LONGBLOB 独立成表而非并入 audit_document——业务代码存在
--       SELECT * FROM audit_document，大字段混入会显著放大常规查询的传输量。
-- =====================================================================

CREATE TABLE IF NOT EXISTS `audit_document_blob` (
  `storage_key` varchar(191) NOT NULL COMMENT '存储键（相对路径，如 2026/10/07/xxx.pdf 或 audit-parse/{documentId}/result.json）',
  `document_id` bigint UNSIGNED DEFAULT NULL COMMENT '关联资料ID（便于按资料清理）',
  `content` longblob NOT NULL COMMENT '文件二进制内容',
  `size` bigint NOT NULL DEFAULT 0 COMMENT '字节数',
  `sha256` char(64) DEFAULT NULL COMMENT '内容 SHA-256 校验和',
  `content_type` varchar(100) DEFAULT NULL COMMENT 'MIME类型',
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '最后写入时间',
  PRIMARY KEY (`storage_key`) USING BTREE,
  KEY `idx_document` (`document_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审计资料二进制内容表（原件与解析产物，适配无持久盘环境）';