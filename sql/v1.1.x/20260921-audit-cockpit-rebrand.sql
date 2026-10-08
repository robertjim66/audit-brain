-- 源自 ai-smart-audit（https://github.com/xiangxiang088/ai-smart-audit，Apache License 2.0）
-- 本文件基于上游同名脚本修改，改动说明见 README「来源与许可」一节
-- =============================================================
-- v1.1.x 20260921 审计驾驶舱：将首页菜单命名为「审计驾驶舱」，并兜底禁用无关菜单
-- 1) 「首页」(id=1) 菜单命名为「审计驾驶舱」，指向 /cockpit
-- 2) 兜底禁用与审计无关的历史菜单（确保新装/历史库一致）
-- 注意：执行后浏览器需 sessionStorage.removeItem('sidebarMenus') 或重新登录
-- =============================================================

UPDATE `sl_sys_menu`
   SET `menu_name` = '审计驾驶舱', `menu_icon` = '🧭'
 WHERE `id` = 1;

UPDATE `sl_sys_menu`
   SET `is_enabled` = 0
 WHERE `parent_id` = 0
   AND `page_key` IN ('assessment','learning','profile','errors','tutoring',
                      'analytics','wrongbook','memory','favorites')
   AND `is_enabled` = 1;
