-- 源自 ai-smart-audit（https://github.com/xiangxiang088/ai-smart-audit，Apache License 2.0）
-- 本文件基于上游同名脚本修改，改动说明见 README「来源与许可」一节
-- ============================================================
# v1.1.x 后台管理审计化：停用学科/知识点/题库相关菜单与权限节点
# 说明：后台管理已移除旧版三个功能分组，角色配权树中不再展示对应分组与按钮
# 本文件由 scripts/migrate.mjs 按版本顺序自动执行，无需单独运行。
-- ============================================================

-- 停用三个历史功能分组
UPDATE `sl_sys_menu` SET `is_enabled` = 0
WHERE `page_key` IN ('grp_subject', 'grp_node', 'grp_question')
  AND `is_enabled` = 1;

-- 停用 subject:* / knowledge_node:* / question:* 按钮权限节点
UPDATE `sl_sys_menu` SET `is_enabled` = 0
WHERE `perm_key` LIKE 'subject:%'
   OR `perm_key` LIKE 'knowledge_node:%'
   OR `perm_key` LIKE 'question:%';
