-- 源自 ai-smart-audit（https://github.com/xiangxiang088/ai-smart-audit，Apache License 2.0）
-- 本文件基于上游同名脚本修改，改动说明见 README「来源与许可」一节
-- ============================================================
-- v1.1.x 统一配置中心：sl_sys_config 升级为「分域键值」结构
--
-- 统一配置中心：将各模块的 AI 与业务配置收敛到「一张表 + 分域」结构。
-- 配置以 namespace 归属模块、以 value_type 声明类型、以 is_secret 标记密钥，
-- 读写统一走配置中心（lib/configStore）。
--   audit.ai  → 审计 Agent 模型链
--   edu.ai    → 历史兼容模块 AI 配置
--
-- 本文件由 scripts/migrate.mjs 按版本顺序自动执行，无需单独运行。
-- ============================================================

-- 1. 结构升级：key → config_key、value → config_value，并加 namespace / value_type / is_secret / updated_by
ALTER TABLE `sl_sys_config`
  ADD COLUMN `namespace` varchar(64) NOT NULL DEFAULT 'sys' COMMENT '配置域（点分层级，如 audit.ai / edu.ai）',
  ADD COLUMN `value_type` varchar(16) NOT NULL DEFAULT 'string' COMMENT '值类型：string/number/boolean/json',
  ADD COLUMN `is_secret` tinyint NOT NULL DEFAULT 0 COMMENT '是否密钥（对外输出脱敏）',
  ADD COLUMN `updated_by` bigint UNSIGNED NULL COMMENT '最后修改人',
  CHANGE COLUMN `key` `config_key` varchar(128) NOT NULL COMMENT '配置键（域内唯一）',
  CHANGE COLUMN `value` `config_value` mediumtext NULL COMMENT '配置值（按 value_type 解码）';

-- 2. 原有 AI 配置归属 edu.ai 域，并去掉与域重复的 ai_ 前缀
UPDATE `sl_sys_config` SET `namespace` = 'edu.ai'
 WHERE `config_key` IN ('ai_api_key', 'ai_api_url', 'ai_enabled', 'ai_model', 'ai_vision_model');

UPDATE `sl_sys_config` SET `config_key` = SUBSTRING(`config_key`, 4)
 WHERE `namespace` = 'edu.ai' AND `config_key` LIKE 'ai\_%';

-- 3. 类型与密钥标注
UPDATE `sl_sys_config`
   SET `value_type` = 'boolean'
 WHERE `namespace` = 'edu.ai' AND `config_key` = 'enabled';

UPDATE `sl_sys_config`
   SET `is_secret` = 1, `description` = '智谱AI API Key（历史兼容模块，当前未启用）'
 WHERE `namespace` = 'edu.ai' AND `config_key` = 'api_key';

-- 4. 主键由 (config_key) 改为 (namespace, config_key)
ALTER TABLE `sl_sys_config`
  DROP PRIMARY KEY,
  ADD PRIMARY KEY (`namespace`, `config_key`);

-- 5. 审计模型链迁入 audit.ai 域（值保持为 JSON 原文，新旧字段结构一致）
INSERT INTO `sl_sys_config`
  (`namespace`, `config_key`, `config_value`, `value_type`, `is_secret`, `description`)
SELECT 'audit.ai', 'model_chain', `config_json`, 'json', 0,
       '审计 Agent 模型链（主模型 + 备用降级顺序 + 各模型超时 + 故障转移开关）'
  FROM `audit_ai_config` WHERE `id` = 1
ON DUPLICATE KEY UPDATE `config_value` = VALUES(`config_value`), `value_type` = 'json';

-- 6. audit_ai_config 保留为回滚快照（新代码已不再读写它）
--    确认新结构稳定后，可手动执行：DROP TABLE `audit_ai_config`;

-- ============================================================
-- 回滚（如需撤销本次结构升级）
-- ============================================================
-- DELETE FROM `sl_sys_config` WHERE `namespace` = 'audit.ai';
-- UPDATE `sl_sys_config` SET `config_key` = CONCAT('ai_', `config_key`) WHERE `namespace` = 'edu.ai';
-- UPDATE `sl_sys_config` SET `namespace` = 'sys';
-- ALTER TABLE `sl_sys_config` DROP PRIMARY KEY, ADD PRIMARY KEY (`config_key`);
-- ALTER TABLE `sl_sys_config`
--   CHANGE COLUMN `config_key` `key` varchar(100) NOT NULL COMMENT '配置键名',
--   CHANGE COLUMN `config_value` `value` text NULL,
--   DROP COLUMN `namespace`, DROP COLUMN `value_type`, DROP COLUMN `is_secret`, DROP COLUMN `updated_by`;
