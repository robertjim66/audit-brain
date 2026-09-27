-- ============================================================
-- v1.1.x 审计 Agent 模型配置表（主模型 + 备用模型自动故障切换）
-- 用户可在页面上决定当前使用哪个模型；apiKey/baseUrl 留空时回退 .env 的 ARK_API_KEY / ARK_BASE_URL
-- 本文件由 scripts/migrate.mjs 按版本顺序自动执行，无需单独运行。
--
-- 说明：审计 Agent 模型链配置现统一存放于配置中心 audit.ai 域（键 model_chain），
--       由 lib/configStore 读写；本表保留作回滚快照，新代码不再读写，确认稳定后可 DROP。
-- ============================================================

CREATE TABLE IF NOT EXISTS `audit_ai_config` (
  `id` tinyint UNSIGNED NOT NULL DEFAULT 1 COMMENT '固定单行 id=1',
  `config_json` mediumtext NOT NULL COMMENT '模型链配置JSON（activeModel/failoverEnabled/models[]）',
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审计Agent模型配置（主备故障切换）';

INSERT INTO `audit_ai_config` (`id`, `config_json`)
VALUES (1, '{"failoverEnabled":true,"activeModel":"doubao-seed-evolving","models":[{"key":"seed-evolving","label":"Doubao-Seed-Evolving（投稿口径 = Seed-2.1-pro-0915）","model":"doubao-seed-evolving","baseUrl":"","apiKey":"","role":"primary","enabled":true,"supportsTools":true,"supportsVision":true,"freeQuota":"50万tokens免费额度","note":"活动指定模型，工具调用/多模态/Agent 能力最强"},{"key":"seed-21-turbo","label":"Doubao-Seed-2.1-turbo（备用1）","model":"doubao-seed-2-1-turbo-260628","baseUrl":"","apiKey":"","role":"backup","enabled":true,"supportsTools":true,"supportsVision":true,"freeQuota":"50万tokens免费额度","note":"同代 turbo，效果与成本均衡，主模型欠费/限流时自动顶上"},{"key":"seed-20-lite","label":"Doubao-Seed-2.0-lite（备用2）","model":"doubao-seed-2-0-lite-260215","baseUrl":"","apiKey":"","role":"backup","enabled":true,"supportsTools":true,"supportsVision":true,"freeQuota":"免费额度","note":"再兜底，轻量低成本"}]}')
ON DUPLICATE KEY UPDATE `id` = `id`;
