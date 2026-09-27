/**
 * RBAC 表结构幂等初始化（首次启动时自动建表并写入种子数据）。
 * 每次请求前调用，Create Table If Not Exists + 种子数据，安全可重复执行。
 */
import db from '@/lib/db';
import snowflake from '@/lib/snowflake';

export async function ensureIsAdminColumn(): Promise<void> {
  const [cols]: any = await db.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sl_sys_user' AND COLUMN_NAME = 'is_admin'`
  );
  if (!cols.length) {
    await db.query(
      `ALTER TABLE sl_sys_user ADD COLUMN is_admin TINYINT NOT NULL DEFAULT 0 COMMENT '0普通用户 1超级管理员' AFTER email`
    );
    await db.query(
      `UPDATE sl_sys_user SET is_admin = 1
       WHERE id = (SELECT min_id FROM (SELECT MIN(id) AS min_id FROM sl_sys_user WHERE del_flag = 0) t)`
    );
  }
}

export async function ensureRoleTables(): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS sl_sys_role (
      id          BIGINT UNSIGNED NOT NULL COMMENT '雪花ID',
      role_name   VARCHAR(30)  NOT NULL COMMENT '角色名称',
      role_code   VARCHAR(30)  NOT NULL COMMENT '角色标识（英文，唯一）',
      description VARCHAR(200) DEFAULT NULL COMMENT '角色描述',
      status      TINYINT NOT NULL DEFAULT 1 COMMENT '1启用 0禁用',
      sort_no     INT NOT NULL DEFAULT 0,
      del_flag    TINYINT NOT NULL DEFAULT 0,
      created_at  DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
      updated_at  DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY uk_role_code (role_code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色表'
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS sl_sys_user_role (
      user_id  BIGINT UNSIGNED NOT NULL,
      role_id  BIGINT UNSIGNED NOT NULL,
      PRIMARY KEY (user_id, role_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户角色关联'
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS sl_sys_role_menu (
      role_id  BIGINT UNSIGNED NOT NULL,
      menu_id  INT UNSIGNED NOT NULL,
      PRIMARY KEY (role_id, menu_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色菜单关联'
  `);
  const [existing]: any = await db.query('SELECT COUNT(*) AS cnt FROM sl_sys_role WHERE del_flag = 0');
  // db.ts 开启了 bigNumberStrings，COUNT(*) 返回字符串，需显式转换后再比较
  if (Number(existing[0].cnt) === 0) {
    await db.query(`
      INSERT INTO sl_sys_role (id, role_name, role_code, description, status, sort_no) VALUES
      (1, '超级管理员', 'ADMIN', '系统管理员，可访问所有功能', 1, 1),
      (2, '审计员', 'AUDITOR', '普通审计人员，访问审计功能', 1, 2)
    `);
  }
}

const BUILTIN_MENUS = [
  { page_key: 'admin', menu_name: '后台管理', menu_icon: '⚙️', menu_url: '/admin', sort_no: 99, is_builtin: 1 },
];
const BUILTIN_GROUPS = [
  { page_key: 'grp_user', menu_name: '用户管理', menu_icon: '👥', sort_no: 50 },
  { page_key: 'grp_role', menu_name: '角色管理', menu_icon: '🎭', sort_no: 60 },
  { page_key: 'grp_menu', menu_name: '菜单管理', menu_icon: '🗂️', sort_no: 70 },
  { page_key: 'grp_ai', menu_name: 'AI 模型配置', menu_icon: '🤖', sort_no: 80 },
];
const BUILTIN_BUTTONS = [
  { page_key: 'btn_user_add', menu_name: '新增用户', menu_icon: '🔘', perm_key: 'user:add', sort_no: 51, group_key: 'grp_user' },
  { page_key: 'btn_user_edit', menu_name: '编辑用户', menu_icon: '🔘', perm_key: 'user:edit', sort_no: 52, group_key: 'grp_user' },
  { page_key: 'btn_user_delete', menu_name: '删除用户', menu_icon: '🔘', perm_key: 'user:delete', sort_no: 53, group_key: 'grp_user' },
  { page_key: 'btn_user_assign_roles', menu_name: '分配角色', menu_icon: '🔘', perm_key: 'user:assign_roles', sort_no: 54, group_key: 'grp_user' },
  { page_key: 'btn_user_reset_pwd', menu_name: '重置密码', menu_icon: '🔘', perm_key: 'user:reset_password', sort_no: 55, group_key: 'grp_user' },
  { page_key: 'btn_role_add', menu_name: '新增角色', menu_icon: '🔘', perm_key: 'role:add', sort_no: 61, group_key: 'grp_role' },
  { page_key: 'btn_role_edit', menu_name: '编辑角色', menu_icon: '🔘', perm_key: 'role:edit', sort_no: 62, group_key: 'grp_role' },
  { page_key: 'btn_role_delete', menu_name: '删除角色', menu_icon: '🔘', perm_key: 'role:delete', sort_no: 63, group_key: 'grp_role' },
  { page_key: 'btn_role_assign_menus', menu_name: '配置菜单权限', menu_icon: '🔘', perm_key: 'role:assign_menus', sort_no: 64, group_key: 'grp_role' },
  { page_key: 'btn_menu_add', menu_name: '新增菜单', menu_icon: '🔘', perm_key: 'menu:add', sort_no: 71, group_key: 'grp_menu' },
  { page_key: 'btn_menu_edit', menu_name: '编辑菜单', menu_icon: '🔘', perm_key: 'menu:edit', sort_no: 72, group_key: 'grp_menu' },
  { page_key: 'btn_menu_delete', menu_name: '删除菜单', menu_icon: '🔘', perm_key: 'menu:delete', sort_no: 73, group_key: 'grp_menu' },
  { page_key: 'btn_ai_config', menu_name: '编辑模型配置', menu_icon: '🔘', perm_key: 'ai:config', sort_no: 81, group_key: 'grp_ai' },
];

export async function ensureMenuTables(): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS sl_sys_menu (
      id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      page_key   VARCHAR(30)  NOT NULL UNIQUE COMMENT '页面标识',
      menu_name  VARCHAR(30)  NOT NULL COMMENT '显示名称',
      menu_icon  VARCHAR(20)  NOT NULL COMMENT '图标 emoji',
      menu_url   VARCHAR(100) NOT NULL DEFAULT '' COMMENT '页面路径',
      sort_no    INT NOT NULL DEFAULT 0,
      is_enabled TINYINT NOT NULL DEFAULT 1 COMMENT '1启用 0禁用',
      is_builtin TINYINT NOT NULL DEFAULT 0 COMMENT '1内置不可删',
      parent_id  INT NOT NULL DEFAULT 0 COMMENT '父菜单ID，0=一级',
      menu_type  TINYINT NOT NULL DEFAULT 0 COMMENT '0=菜单 1=按钮',
      perm_key   VARCHAR(60) DEFAULT NULL COMMENT '权限标识',
      updated_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='菜单配置'
  `);

  // 旧库的 sl_sys_menu 只有基础列，CREATE TABLE IF NOT EXISTS 不会补列，需显式 ALTER
  const [menuCols]: any = await db.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sl_sys_menu'
       AND COLUMN_NAME IN ('parent_id', 'menu_type', 'perm_key')`
  );
  const existingCols = new Set(menuCols.map((c: any) => c.COLUMN_NAME));
  if (!existingCols.has('parent_id')) {
    await db.query(
      `ALTER TABLE sl_sys_menu ADD COLUMN parent_id INT NOT NULL DEFAULT 0 COMMENT '父菜单ID，0=一级' AFTER is_builtin`
    );
  }
  if (!existingCols.has('menu_type')) {
    await db.query(
      `ALTER TABLE sl_sys_menu ADD COLUMN menu_type TINYINT NOT NULL DEFAULT 0 COMMENT '0=菜单 1=按钮' AFTER parent_id`
    );
  }
  if (!existingCols.has('perm_key')) {
    await db.query(
      `ALTER TABLE sl_sys_menu ADD COLUMN perm_key VARCHAR(60) DEFAULT NULL COMMENT '权限标识' AFTER menu_type`
    );
  }

  for (const m of BUILTIN_MENUS) {
    await db.query(
      `INSERT IGNORE INTO sl_sys_menu (page_key, menu_name, menu_icon, menu_url, sort_no, is_enabled, is_builtin, parent_id, menu_type)
       VALUES (?, ?, ?, ?, ?, 1, ?, 0, 0)`,
      [m.page_key, m.menu_name, m.menu_icon, m.menu_url, m.sort_no, m.is_builtin]
    );
  }
  const [adminRows]: any = await db.query(`SELECT id FROM sl_sys_menu WHERE page_key = 'admin' LIMIT 1`);
  if (adminRows.length) {
    const adminId = adminRows[0].id;
    for (const g of BUILTIN_GROUPS) {
      await db.query(
        `INSERT IGNORE INTO sl_sys_menu (page_key, menu_name, menu_icon, menu_url, sort_no, is_enabled, is_builtin, parent_id, menu_type)
         VALUES (?, ?, ?, '', ?, 1, 1, ?, 0)`,
        [g.page_key, g.menu_name, g.menu_icon, g.sort_no, adminId]
      );
    }
  }
  for (const b of BUILTIN_BUTTONS) {
    const [grpRows]: any = await db.query(`SELECT id FROM sl_sys_menu WHERE page_key = ? LIMIT 1`, [b.group_key]);
    if (!grpRows.length) continue;
    await db.query(
      `INSERT IGNORE INTO sl_sys_menu (page_key, menu_name, menu_icon, menu_url, sort_no, is_enabled, is_builtin, parent_id, menu_type, perm_key)
       VALUES (?, ?, ?, '', ?, 1, 1, ?, 1, ?)`,
      [b.page_key, b.menu_name, b.menu_icon, b.sort_no, grpRows[0].id, b.perm_key]
    );
  }
  await db.query(`
    CREATE TABLE IF NOT EXISTS sl_sys_role_menu (
      role_id  BIGINT UNSIGNED NOT NULL,
      menu_id  INT UNSIGNED NOT NULL,
      PRIMARY KEY (role_id, menu_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色菜单关联'
  `);
}

export async function ensureDictTable(): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS sl_sys_dict (
      id          BIGINT UNSIGNED NOT NULL PRIMARY KEY COMMENT '主键（雪花算法生成）',
      dict_type   VARCHAR(50)  NOT NULL COMMENT '字典类型',
      dict_code   VARCHAR(50)  NOT NULL COMMENT '字典项编码',
      dict_label  VARCHAR(100) NOT NULL COMMENT '字典项显示名称',
      dict_icon   VARCHAR(20)  DEFAULT NULL COMMENT '字典项图标（emoji）',
      sort_order  INT NOT NULL DEFAULT 0 COMMENT '排序值',
      status      TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1启用 0停用',
      del_flag    TINYINT NOT NULL DEFAULT 0 COMMENT '删除标志',
      created_by  BIGINT UNSIGNED DEFAULT NULL,
      created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_by  BIGINT UNSIGNED DEFAULT NULL,
      updated_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      remark      VARCHAR(500) DEFAULT NULL,
      UNIQUE KEY uk_type_code (dict_type, dict_code),
      INDEX idx_type (dict_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='通用字典表'
  `);
}

export { snowflake };
