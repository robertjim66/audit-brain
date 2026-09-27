/*
 Navicat Premium Data Transfer

 Source Server         : audit_brain
 Source Server Type    : MySQL
 Source Server Version : 80028
 Source Host           : local:3306
 Source Schema         : audit_brain

 Target Server Type    : MySQL
 Target Server Version : 80028
 File Encoding         : 65001

 Date: 09/08/2026 18:28:15
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;































-- ----------------------------
-- Table structure for sl_sys_config
-- ----------------------------
DROP TABLE IF EXISTS `sl_sys_config`;
CREATE TABLE `sl_sys_config`  (
  `key` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '配置键名',
  `value` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '配置值',
  `description` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '配置说明描述',
  `updated_at` timestamp(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0) COMMENT '更新时间',
  PRIMARY KEY (`key`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '系统配置表（键值对）' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of sl_sys_config
-- ----------------------------

-- ----------------------------
-- Table structure for sl_sys_feedback
-- ----------------------------
DROP TABLE IF EXISTS `sl_sys_feedback`;
CREATE TABLE `sl_sys_feedback`  (
  `id` bigint UNSIGNED NOT NULL COMMENT '反馈ID（雪花算法）',
  `user_id` bigint UNSIGNED NOT NULL COMMENT '提交用户ID',
  `type` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'suggestion' COMMENT '反馈类型：bug-缺陷反馈/suggestion-功能建议/other-其他',
  `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '反馈内容',
  `contact` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '联系方式（选填，邮箱/微信/手机号）',
  `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'pending' COMMENT '处理状态：pending-待处理/processing-处理中/resolved-已处理',
  `admin_reply` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '管理员回复',
  `replied_at` timestamp(0) NULL DEFAULT NULL COMMENT '回复时间',
  `replied_by` bigint UNSIGNED NULL DEFAULT NULL COMMENT '回复管理员ID',
  `del_flag` tinyint NOT NULL DEFAULT 0 COMMENT '删除标志（0正常 1删除）',
  `created_by` bigint UNSIGNED NULL DEFAULT NULL COMMENT '创建用户ID',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  `updated_by` bigint UNSIGNED NULL DEFAULT NULL COMMENT '修改用户ID',
  `remark` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '备注',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_user_id`(`user_id`) USING BTREE,
  INDEX `idx_status`(`status`) USING BTREE,
  INDEX `idx_created_at`(`created_at`) USING BTREE,
  INDEX `idx_del_flag`(`del_flag`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '用户反馈表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of sl_sys_feedback
-- ----------------------------
INSERT INTO `sl_sys_feedback` VALUES (341995746662420480, 1, 'suggestion', '建议新增通知公告功能，方便知晓系统升级情况', 'xiaobawang@163.com', 'pending', NULL, NULL, NULL, 0, NULL, '2026-08-02 01:29:00.000', '2026-08-02 01:29:00.000', NULL, NULL);

-- ----------------------------
-- Table structure for sl_sys_login_log
-- ----------------------------
DROP TABLE IF EXISTS `sl_sys_login_log`;
CREATE TABLE `sl_sys_login_log`  (
  `id` bigint UNSIGNED NOT NULL COMMENT '访问ID（雪花算法生成）',
  `user_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '' COMMENT '用户账号',
  `user_id` bigint UNSIGNED NULL DEFAULT NULL COMMENT '用户ID',
  `ipaddr` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '' COMMENT '登录IP地址',
  `login_location` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '' COMMENT '登录地点',
  `browser` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '' COMMENT '浏览器类型',
  `os` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '' COMMENT '操作系统',
  `device_type` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '' COMMENT '设备类型（pc/mobile/tablet）',
  `status` char(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '0' COMMENT '登录状态（0成功 1失败）',
  `msg` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '' COMMENT '提示消息',
  `login_time` datetime(0) NULL DEFAULT NULL COMMENT '访问时间',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_sys_logininfor_s`(`status`) USING BTREE,
  INDEX `idx_sys_logininfor_lt`(`login_time`) USING BTREE,
  INDEX `idx_sys_logininfor_uid`(`user_id`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '系统访问记录' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of sl_sys_login_log
-- ----------------------------
INSERT INTO `sl_sys_login_log` VALUES (344515212809998336, 'admin', 1, '127.0.0.1', '内网IP', 'Chrome', 'Windows 10/11', 'pc', '0', '登录成功', '2026-08-09 00:20:28');
INSERT INTO `sl_sys_login_log` VALUES (344548000447729664, 'admin', 1, '127.0.0.1', '内网IP', 'Chrome', 'Windows 10/11', 'pc', '1', '密码错误', '2026-08-09 02:30:46');
INSERT INTO `sl_sys_login_log` VALUES (344548024216850432, 'admin', 1, '127.0.0.1', '内网IP', 'Chrome', 'Windows 10/11', 'pc', '0', '登录成功', '2026-08-09 02:30:51');
INSERT INTO `sl_sys_login_log` VALUES (344564689306521600, 'admin', 1, '127.0.0.1', '内网IP', 'Chrome', 'Windows 10/11', 'pc', '0', '登录成功', '2026-08-09 03:37:05');
INSERT INTO `sl_sys_login_log` VALUES (344565139690885120, 'admin', 1, '127.0.0.1', '内网IP', 'unknown', 'unknown', 'other', '0', '登录成功', '2026-08-09 03:38:52');
INSERT INTO `sl_sys_login_log` VALUES (344565398605271040, 'admin', 1, '127.0.0.1', '内网IP', 'unknown', 'unknown', 'other', '0', '登录成功', '2026-08-09 03:39:54');

-- ----------------------------
-- Table structure for sl_sys_menu
-- ----------------------------
DROP TABLE IF EXISTS `sl_sys_menu`;
CREATE TABLE `sl_sys_menu`  (
  `id` int UNSIGNED NOT NULL AUTO_INCREMENT,
  `page_key` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '页面标识',
  `menu_name` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '显示名称',
  `menu_icon` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '图标 emoji',
  `menu_url` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '页面路径',
  `sort_no` int NOT NULL DEFAULT 0,
  `is_enabled` tinyint NOT NULL DEFAULT 1 COMMENT '1启用 0禁用',
  `is_builtin` tinyint NOT NULL DEFAULT 0 COMMENT '1内置不可删',
  `updated_at` datetime(3) NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `page_key`(`page_key`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 73 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '菜单配置' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of sl_sys_menu
-- ----------------------------
INSERT INTO `sl_sys_menu` VALUES (1, 'home', '审计驾驶舱', '🧭', '/cockpit', 1, 1, 1, '2026-08-10 12:07:43.471');

-- ----------------------------
-- Table structure for sl_sys_notice
-- ----------------------------
DROP TABLE IF EXISTS `sl_sys_notice`;
CREATE TABLE `sl_sys_notice`  (
  `id` bigint UNSIGNED NOT NULL COMMENT '公告ID（雪花算法）',
  `notice_title` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '公告标题',
  `notice_type` char(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT '1' COMMENT '公告类型（1通知 2公告）',
  `notice_content` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '公告内容',
  `status` char(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT '0' COMMENT '状态（0正常/已发布 1关闭/草稿）',
  `is_popup` tinyint NOT NULL DEFAULT 0 COMMENT '是否弹窗公告（0否 1是，系统升级等重要公告）',
  `created_by` bigint UNSIGNED NULL DEFAULT NULL COMMENT '创建者用户ID',
  `updated_by` bigint UNSIGNED NULL DEFAULT NULL COMMENT '更新者用户ID',
  `del_flag` tinyint NOT NULL DEFAULT 0 COMMENT '删除标志（0正常 1删除）',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  `remark` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '备注',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_status`(`status`) USING BTREE,
  INDEX `idx_type`(`notice_type`) USING BTREE,
  INDEX `idx_created_at`(`created_at`) USING BTREE,
  INDEX `idx_del_flag`(`del_flag`) USING BTREE,
  INDEX `idx_popup`(`is_popup`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '系统通知/公告表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of sl_sys_notice
-- ----------------------------
INSERT INTO `sl_sys_notice` VALUES (342242870020935680, 'v1.0.0系统升级注意', '2', '从v1.0.0系统升级注意，要执行v2.0.x下日期脚本，而不是db-init.sql', '0', 0, 1, 1, 0, '2026-08-02 17:50:59.000', '2026-08-02 17:51:31.000', NULL);

-- ----------------------------
-- Table structure for sl_sys_notice_read
-- ----------------------------
DROP TABLE IF EXISTS `sl_sys_notice_read`;
CREATE TABLE `sl_sys_notice_read`  (
  `id` bigint UNSIGNED NOT NULL COMMENT '记录ID（雪花算法）',
  `notice_id` bigint UNSIGNED NOT NULL COMMENT '公告ID',
  `user_id` bigint UNSIGNED NOT NULL COMMENT '用户ID',
  `read_at` timestamp(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) COMMENT '阅读时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_notice_user`(`notice_id`, `user_id`) USING BTREE,
  INDEX `idx_user_id`(`user_id`) USING BTREE,
  INDEX `idx_notice_id`(`notice_id`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '公告用户阅读记录表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of sl_sys_notice_read
-- ----------------------------
INSERT INTO `sl_sys_notice_read` VALUES (345029543188369408, 342242870020935680, 1, '2026-08-10 10:24:14');

-- ----------------------------
-- Table structure for sl_sys_notification
-- ----------------------------
DROP TABLE IF EXISTS `sl_sys_notification`;
CREATE TABLE `sl_sys_notification`  (
  `id` bigint UNSIGNED NOT NULL COMMENT '通知ID（雪花算法）',
  `user_id` bigint UNSIGNED NOT NULL COMMENT '接收通知的用户ID',
  `type` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '通知类型：loan_due-借贷到期 credit_due-信用卡还款 system-系统通知',
  `title` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '通知标题',
  `content` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '通知内容',
  `related_type` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '关联类型：loan/account',
  `related_id` bigint UNSIGNED NULL DEFAULT NULL COMMENT '关联业务ID',
  `stage` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '提醒阶段：soon-3天前 today-当天',
  `period` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '期间标识（借贷=到期日，信用卡=YYYY-MM）',
  `is_read` tinyint NOT NULL DEFAULT 0 COMMENT '是否已读（0未读 1已读）',
  `read_at` datetime(3) NULL DEFAULT NULL COMMENT '阅读时间',
  `del_flag` tinyint NOT NULL DEFAULT 0 COMMENT '删除标志（0正常 1删除）',
  `created_by` bigint UNSIGNED NULL DEFAULT NULL COMMENT '创建用户ID（系统自动生成为NULL）',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `updated_by` bigint UNSIGNED NULL DEFAULT NULL COMMENT '修改用户ID',
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  `remark` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '备注',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_dedup`(`user_id`, `type`, `related_id`, `stage`, `period`) USING BTREE,
  INDEX `idx_user_read`(`user_id`, `is_read`, `del_flag`) USING BTREE,
  INDEX `idx_user_list`(`user_id`, `del_flag`, `created_at`) USING BTREE,
  CONSTRAINT `sl_sys_notification_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `sl_sys_user` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '个人通知表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of sl_sys_notification
-- ----------------------------

-- ----------------------------
-- Table structure for sl_sys_oper_log
-- ----------------------------
DROP TABLE IF EXISTS `sl_sys_oper_log`;
CREATE TABLE `sl_sys_oper_log`  (
  `id` bigint UNSIGNED NOT NULL COMMENT '日志主键（雪花算法生成）',
  `title` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '' COMMENT '模块标题',
  `business_type` int NULL DEFAULT 0 COMMENT '业务类型（0其它 1新增 2修改 3删除）',
  `method` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '' COMMENT '方法名称',
  `request_method` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '' COMMENT '请求方式（GET/POST/PUT/DELETE）',
  `operator_type` int NULL DEFAULT 0 COMMENT '操作类别（0其它 1后台用户 2手机端用户）',
  `oper_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '' COMMENT '操作人员用户名',
  `user_id` bigint UNSIGNED NULL DEFAULT NULL COMMENT '操作人员用户ID',
  `oper_url` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '' COMMENT '请求URL',
  `oper_ip` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '' COMMENT '主机地址IP',
  `oper_location` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '' COMMENT '操作地点',
  `oper_param` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '请求参数',
  `json_result` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '返回参数',
  `status` int NULL DEFAULT 0 COMMENT '操作状态（0正常 1异常）',
  `error_msg` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '错误消息',
  `cost_time` bigint NULL DEFAULT 0 COMMENT '消耗时间（毫秒）',
  `oper_time` datetime(0) NULL DEFAULT NULL COMMENT '操作时间',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_sys_oper_log_bt`(`business_type`) USING BTREE,
  INDEX `idx_sys_oper_log_s`(`status`) USING BTREE,
  INDEX `idx_sys_oper_log_ot`(`oper_time`) USING BTREE,
  INDEX `idx_sys_oper_log_uid`(`user_id`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '操作日志记录' ROW_FORMAT = Dynamic;


-- ----------------------------
-- Table structure for sl_sys_role
-- ----------------------------
DROP TABLE IF EXISTS `sl_sys_role`;
CREATE TABLE `sl_sys_role`  (
  `id` bigint UNSIGNED NOT NULL COMMENT '雪花ID',
  `role_name` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '角色名称',
  `role_code` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '角色标识（英文，唯一）',
  `description` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '角色描述',
  `status` tinyint NOT NULL DEFAULT 1 COMMENT '1启用 0禁用',
  `sort_no` int NOT NULL DEFAULT 0,
  `del_flag` tinyint NOT NULL DEFAULT 0,
  `created_at` datetime(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_role_code`(`role_code`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '角色表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of sl_sys_role
-- ----------------------------

-- ----------------------------
-- Table structure for sl_sys_role_menu
-- ----------------------------
DROP TABLE IF EXISTS `sl_sys_role_menu`;
CREATE TABLE `sl_sys_role_menu`  (
  `role_id` bigint UNSIGNED NOT NULL,
  `menu_id` int UNSIGNED NOT NULL,
  PRIMARY KEY (`role_id`, `menu_id`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '角色菜单关联' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of sl_sys_role_menu
-- ----------------------------

-- ----------------------------
-- Table structure for sl_sys_user
-- ----------------------------
DROP TABLE IF EXISTS `sl_sys_user`;
CREATE TABLE `sl_sys_user`  (
  `id` bigint UNSIGNED NOT NULL COMMENT '用户ID（雪花算法生成）',
  `username` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '登录用户名，唯一',
  `password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '密码，bcrypt加密存储',
  `nickname` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '用户昵称/显示名',
  `email` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '邮箱地址',
  `is_admin` tinyint NOT NULL DEFAULT 0 COMMENT '0普通用户 1超级管理员',
  `avatar` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '头像图片URL',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  `updated_by` bigint UNSIGNED NULL DEFAULT NULL COMMENT '修改用户ID',
  `del_flag` tinyint NOT NULL DEFAULT 0 COMMENT '删除标志（0正常 1删除）',
  `created_by` bigint UNSIGNED NULL DEFAULT NULL COMMENT '创建用户ID',
  `remark` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '备注',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `username`(`username`) USING BTREE,
  UNIQUE INDEX `username_2`(`username`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '用户账号表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of sl_sys_user
-- ----------------------------
INSERT INTO `sl_sys_user` VALUES (1, 'admin', '$2a$10$FF03kXCO7rzFGb.qObU1NOsP7gwgM07KFyh/qNiQPNBDPUiLZPn6K', '管理员', 'admin@example.com', 1, NULL, '2026-07-22 16:52:02.000', '2026-08-10 12:07:45.992', NULL, 0, NULL, NULL);

-- ----------------------------
-- Table structure for sl_sys_user_role
-- ----------------------------
DROP TABLE IF EXISTS `sl_sys_user_role`;
CREATE TABLE `sl_sys_user_role`  (
  `user_id` bigint UNSIGNED NOT NULL,
  `role_id` bigint UNSIGNED NOT NULL,
  PRIMARY KEY (`user_id`, `role_id`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '用户角色关联' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of sl_sys_user_role
-- ----------------------------

-- ----------------------------
-- Table structure for sl_sys_version
-- ----------------------------
DROP TABLE IF EXISTS `sl_sys_version`;
CREATE TABLE `sl_sys_version`  (
  `id` int UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `version` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '版本号，如 v2.0.1',
  `release_date` date NOT NULL COMMENT '发布日期',
  `title` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '版本副标题（可选）',
  `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '更新内容（换行分隔的条目，每行一条）',
  `created_at` timestamp(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) COMMENT '记录创建时间',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_release_date`(`release_date`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 10 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '系统版本升级记录' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of sl_sys_version
-- ----------------------------
INSERT INTO `sl_sys_version` VALUES (10, 'v1.0.0', '2026-09-20', '审计智脑 AuditBrain 基础版', '工程审计智能审读平台：覆盖审计项目、资料舱、智能问答（证据溯源 Agent）、核对程序、疑点台账等模块。', '2026-09-20 09:00:00');

SET FOREIGN_KEY_CHECKS = 1;
