-- =====================================================================
-- 移除清标分析模块（bid-clearing）
-- 适用：曾执行过 20260921-audit-bid-clearing.sql 的历史库；全新库本文件为 no-op。
-- 本文件由 scripts/migrate.mjs 按版本顺序自动执行，无需单独运行。
-- =====================================================================

-- 1. 删除清标分析三张表（按依赖逆序）
DROP TABLE IF EXISTS `audit_bid_party_doc`;
DROP TABLE IF EXISTS `audit_bid_party`;
DROP TABLE IF EXISTS `audit_bid_session`;

-- 2. 清理菜单授权与菜单种子（id=105 / page_key=audit-bid-clearing）
DELETE FROM `sl_sys_role_menu` WHERE `menu_id` = 105;
DELETE FROM `sl_sys_menu` WHERE `id` = 105 OR `page_key` = 'audit-bid-clearing';
