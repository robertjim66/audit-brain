-- ============================================================
# v1.1.x 工程审计模块初始化
# 说明：在 v1.0.x 基础表之上新增 audit_* 业务表与审计模块菜单，不改动其它模块表
# 本文件由 scripts/migrate.mjs 按版本顺序自动执行，无需单独运行。
# 兼容 MySQL 5.7 / 8.0，排序规则使用默认 utf8mb4
-- ============================================================

-- ----------------------------
-- 1. 审计项目表
-- ----------------------------
CREATE TABLE IF NOT EXISTS `audit_project` (
  `id` bigint UNSIGNED NOT NULL COMMENT '项目ID（雪花算法）',
  `project_name` varchar(200) NOT NULL COMMENT '项目名称（脱敏代号）',
  `project_code` varchar(64) DEFAULT NULL COMMENT '项目编号',
  `audit_type` varchar(30) NOT NULL DEFAULT 'cost' COMMENT '审计类型：cost造价/结算审计，可扩展',
  `audit_period` varchar(100) DEFAULT NULL COMMENT '审计/工程期间',
  `description` varchar(500) DEFAULT NULL COMMENT '项目说明',
  `status` tinyint NOT NULL DEFAULT 0 COMMENT '0进行中 1已完成',
  `user_id` bigint UNSIGNED NOT NULL COMMENT '所属用户ID',
  `del_flag` tinyint NOT NULL DEFAULT 0 COMMENT '删除标志（0正常 1删除）',
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `remark` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`, `del_flag`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工程审计项目表';

-- ----------------------------
-- 2. 审计资料文件表
-- ----------------------------
CREATE TABLE IF NOT EXISTS `audit_document` (
  `id` bigint UNSIGNED NOT NULL COMMENT '资料ID（雪花算法）',
  `project_id` bigint UNSIGNED NOT NULL COMMENT '所属审计项目ID',
  `file_name` varchar(255) NOT NULL COMMENT '原始文件名',
  `file_url` varchar(255) NOT NULL COMMENT '文件访问URL',
  `file_path` varchar(500) DEFAULT NULL COMMENT '服务器本地相对路径',
  `file_size` bigint NOT NULL DEFAULT 0 COMMENT '文件大小（字节）',
  `mime_type` varchar(100) DEFAULT NULL COMMENT 'MIME类型',
  `file_ext` varchar(10) DEFAULT NULL COMMENT '扩展名',
  `doc_type` varchar(30) NOT NULL DEFAULT 'other' COMMENT 'pdf_text文字PDF/pdf_mixed图文PDF/pdf_scan扫描PDF/excel/word/photo/other',
  `biz_category` varchar(30) NOT NULL DEFAULT 'other' COMMENT 'contract合同/boq清单/control_price控制价/settlement结算/payment支付/visa签证/photo照片/invoice发票/other',
  `page_count` int NOT NULL DEFAULT 0 COMMENT '页数（PDF/图片）',
  `sheet_count` int NOT NULL DEFAULT 0 COMMENT '工作表数（Excel）',
  `parse_status` varchar(20) NOT NULL DEFAULT 'pending' COMMENT 'pending/processing/done/failed',
  `parse_progress` int NOT NULL DEFAULT 0 COMMENT '解析进度0-100',
  `parse_error` varchar(2000) DEFAULT NULL COMMENT '解析错误信息',
  `ocr_job_id` varchar(64) DEFAULT NULL COMMENT 'PaddleOCR任务ID',
  `result_path` varchar(255) DEFAULT NULL COMMENT '解析结果落盘目录（相对 data/）',
  `summary_text` varchar(500) DEFAULT NULL COMMENT '识别内容摘要',
  `del_flag` tinyint NOT NULL DEFAULT 0,
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `remark` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_project` (`project_id`, `del_flag`),
  KEY `idx_status` (`parse_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审计资料文件表';

-- ----------------------------
-- 3. 解析要素/证据锚点表
-- ----------------------------
CREATE TABLE IF NOT EXISTS `audit_element` (
  `id` bigint UNSIGNED NOT NULL COMMENT '要素ID（雪花算法）',
  `project_id` bigint UNSIGNED NOT NULL,
  `document_id` bigint UNSIGNED NOT NULL,
  `page_no` int NOT NULL DEFAULT 0 COMMENT '页码（PDF页/图片=1，从1开始）',
  `sheet_name` varchar(100) DEFAULT NULL COMMENT 'Excel工作表名',
  `element_type` varchar(30) NOT NULL DEFAULT 'text' COMMENT 'title/text/table/seal/image',
  `content_md` mediumtext COMMENT '要素内容（markdown/HTML表格/文本）',
  `bbox_json` mediumtext COMMENT '归一化定位坐标JSON：{x,y,w,h,pageWidth,pageHeight}',
  `anchor_label` varchar(200) DEFAULT NULL COMMENT '人工可读定位描述',
  `del_flag` tinyint NOT NULL DEFAULT 0,
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `remark` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_document` (`document_id`),
  KEY `idx_project_type` (`project_id`, `element_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审计资料解析要素与证据锚点表';

-- ----------------------------
-- 4. 智能问答会话表
-- ----------------------------
CREATE TABLE IF NOT EXISTS `audit_chat_session` (
  `id` bigint UNSIGNED NOT NULL COMMENT '会话ID（雪花算法）',
  `project_id` bigint UNSIGNED NOT NULL,
  `title` varchar(200) NOT NULL DEFAULT '新会话',
  `user_id` bigint UNSIGNED NOT NULL,
  `last_message_at` datetime(3) DEFAULT NULL,
  `del_flag` tinyint NOT NULL DEFAULT 0,
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `remark` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_project` (`project_id`, `del_flag`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审计智能问答会话表';

-- ----------------------------
-- 5. 问答消息表
-- ----------------------------
CREATE TABLE IF NOT EXISTS `audit_chat_message` (
  `id` bigint UNSIGNED NOT NULL COMMENT '消息ID（雪花算法）',
  `session_id` bigint UNSIGNED NOT NULL,
  `project_id` bigint UNSIGNED NOT NULL,
  `role` varchar(20) NOT NULL COMMENT 'user/assistant/system',
  `content` mediumtext NOT NULL COMMENT '消息内容',
  `citations_json` mediumtext COMMENT '证据引用JSON数组（文件/页码/sheet/坐标/摘要）',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_session` (`session_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审计智能问答消息表';

-- ----------------------------
-- 6. 核对程序记录表
-- ----------------------------
CREATE TABLE IF NOT EXISTS `audit_check_program` (
  `id` bigint UNSIGNED NOT NULL COMMENT '程序记录ID（雪花算法）',
  `project_id` bigint UNSIGNED NOT NULL,
  `program_type` varchar(40) NOT NULL COMMENT 'boq_settlement清单结算核对/visa_evidence签证证据链/contract_payment合同付款/summary_tie汇总勾稽',
  `program_name` varchar(100) DEFAULT NULL COMMENT '程序名称',
  `status` varchar(20) NOT NULL DEFAULT 'pending' COMMENT 'pending/running/done/failed',
  `summary_json` mediumtext COMMENT '统计结果JSON（一致/差异/无法确认数量、核增核减额）',
  `error_msg` varchar(2000) DEFAULT NULL,
  `del_flag` tinyint NOT NULL DEFAULT 0,
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `remark` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_project` (`project_id`, `del_flag`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审计核对程序记录表';

-- ----------------------------
-- 7. 核对明细表
-- ----------------------------
CREATE TABLE IF NOT EXISTS `audit_check_item` (
  `id` bigint UNSIGNED NOT NULL COMMENT '明细ID（雪花算法）',
  `program_id` bigint UNSIGNED NOT NULL,
  `project_id` bigint UNSIGNED NOT NULL,
  `item_code` varchar(100) DEFAULT NULL COMMENT '清单编码/签证编号',
  `item_name` varchar(255) DEFAULT NULL COMMENT '项目/分项名称',
  `unit` varchar(30) DEFAULT NULL COMMENT '单位',
  `left_label` varchar(100) DEFAULT NULL COMMENT '左方数据源名称（如中标清单）',
  `right_label` varchar(100) DEFAULT NULL COMMENT '右方数据源名称（如结算书）',
  `qty_left` decimal(18,4) DEFAULT NULL COMMENT '左方工程量',
  `qty_right` decimal(18,4) DEFAULT NULL COMMENT '右方工程量',
  `price_left` decimal(18,4) DEFAULT NULL COMMENT '左方综合单价',
  `price_right` decimal(18,4) DEFAULT NULL COMMENT '右方综合单价',
  `amount_left` decimal(18,2) DEFAULT NULL COMMENT '左方合价',
  `amount_right` decimal(18,2) DEFAULT NULL COMMENT '右方合价',
  `diff_qty` decimal(18,4) DEFAULT NULL COMMENT '工程量差异',
  `diff_amount` decimal(18,2) DEFAULT NULL COMMENT '合价差异（核增核减）',
  `conclusion` varchar(20) NOT NULL DEFAULT 'unconfirmed' COMMENT 'match一致/diff差异/unconfirmed无法确认',
  `diff_desc` varchar(1000) DEFAULT NULL COMMENT '差异说明',
  `evidence_json` mediumtext COMMENT '双向证据锚点JSON',
  `suggestion` varchar(500) DEFAULT NULL COMMENT '审计建议',
  `del_flag` tinyint NOT NULL DEFAULT 0,
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `remark` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_program` (`program_id`),
  KEY `idx_project_conclusion` (`project_id`, `conclusion`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审计核对明细表';

-- ----------------------------
-- 8. 疑点/发现台账表
-- ----------------------------
CREATE TABLE IF NOT EXISTS `audit_finding` (
  `id` bigint UNSIGNED NOT NULL COMMENT '疑点ID（雪花算法）',
  `project_id` bigint UNSIGNED NOT NULL,
  `finding_type` varchar(40) NOT NULL COMMENT '疑点类型：no_seal无签章/no_photo无照片/qty_diff量差异常/round_amount凑整/late_visa竣工后签证/duplicate重复/invoice_serial连号发票/other',
  `title` varchar(255) NOT NULL COMMENT '疑点标题',
  `risk_level` varchar(10) NOT NULL DEFAULT 'low' COMMENT 'high/mid/low',
  `description` mediumtext COMMENT '疑点描述',
  `evidence_json` mediumtext COMMENT '证据链JSON',
  `suggestion` varchar(500) DEFAULT NULL COMMENT '建议追加的审计程序',
  `source` varchar(20) NOT NULL DEFAULT 'scan' COMMENT 'check核对产生/scan规则扫描/manual人工录入',
  `ref_id` bigint UNSIGNED DEFAULT NULL COMMENT '来源记录ID',
  `status` varchar(20) NOT NULL DEFAULT 'open' COMMENT 'open待核实/confirmed属实/misreport误报/closed已关闭',
  `del_flag` tinyint NOT NULL DEFAULT 0,
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `remark` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_project_status` (`project_id`, `status`, `del_flag`),
  KEY `idx_risk` (`risk_level`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审计疑点/发现台账表';

-- ----------------------------
-- 9. 审计模块菜单（page_key 唯一，INSERT IGNORE 防重复）
-- ----------------------------
INSERT IGNORE INTO `sl_sys_menu`
  (`id`, `page_key`, `menu_name`, `menu_icon`, `menu_url`, `sort_no`, `is_enabled`, `is_builtin`)
VALUES
  (100, 'audit-project',   '审计项目', '📁', '/projects',   90, 1, 1),
  (101, 'audit-documents', '资料舱',   '📄', '/documents', 91, 1, 1),
  (102, 'audit-chat',      '智能问答', '💬', '/chat',      92, 1, 1),
  (103, 'audit-checks',    '核对程序', '✅', '/checks',    93, 1, 1),
  (104, 'audit-findings',  '疑点台账', '⚠️', '/findings',  94, 1, 1);
