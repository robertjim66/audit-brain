-- ============================================================
-- v1.1.x 菜单表补列：sl_sys_menu 增加 parent_id / menu_type / perm_key
--
-- 背景：v1.0.x 的 sl_sys_menu 只有 8 个基础列，而 src/lib/admin/ensure.ts
--       的 ensureMenuTables() 是按 12 列设计的（多了 parent_id / menu_type /
--       perm_key）。CREATE TABLE IF NOT EXISTS 对已存在的表是空操作，补不了列，
--       于是：
--         1) /api/admin/menus/my 报 Unknown column 'parent_id'（500）；
--         2) 本目录 20260921-* 两个 rebrand 脚本引用 perm_key / parent_id 也报警。
--       应用侧 ensureMenuTables() 已在运行时自愈，本文件把 schema 补齐，
--       让迁移阶段就与代码一致。
--
-- 本文件由 scripts/migrate.mjs 按版本顺序自动执行，无需单独运行。
-- 文件名排序在 20260921-* 之前，确保先于引用这两列的脚本执行。
--
-- 回滚：ALTER TABLE `sl_sys_menu`
--         DROP COLUMN `perm_key`, DROP COLUMN `menu_type`, DROP COLUMN `parent_id`;
--
-- 说明：MySQL 8.0 不支持 ADD COLUMN IF NOT EXISTS，故用 INFORMATION_SCHEMA
--       判断 + 动态 SQL 实现幂等，重复执行不会报 Duplicate column name。
-- ============================================================

-- 1. parent_id：父菜单ID，0=一级
SET @stmt := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `sl_sys_menu` ADD COLUMN `parent_id` INT NOT NULL DEFAULT 0 COMMENT ''父菜单ID，0=一级'' AFTER `is_builtin`',
    'SELECT 1')
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sl_sys_menu' AND COLUMN_NAME = 'parent_id'
);
PREPARE add_parent_id FROM @stmt;
EXECUTE add_parent_id;
DEALLOCATE PREPARE add_parent_id;

-- 2. menu_type：0=菜单 1=按钮
SET @stmt := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `sl_sys_menu` ADD COLUMN `menu_type` TINYINT NOT NULL DEFAULT 0 COMMENT ''0=菜单 1=按钮'' AFTER `parent_id`',
    'SELECT 1')
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sl_sys_menu' AND COLUMN_NAME = 'menu_type'
);
PREPARE add_menu_type FROM @stmt;
EXECUTE add_menu_type;
DEALLOCATE PREPARE add_menu_type;

-- 3. perm_key：权限标识（按钮节点用，如 user:add）
SET @stmt := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `sl_sys_menu` ADD COLUMN `perm_key` VARCHAR(60) DEFAULT NULL COMMENT ''权限标识'' AFTER `menu_type`',
    'SELECT 1')
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sl_sys_menu' AND COLUMN_NAME = 'perm_key'
);
PREPARE add_perm_key FROM @stmt;
EXECUTE add_perm_key;
DEALLOCATE PREPARE add_perm_key;
