-- ============================================================
-- v1.1.x 20260927 清理 v1.0.x 历史遗留模块
-- 说明：早期版本（v1.0.x）内置了若干与当前「工程审计」定位无关的功能模块，
--       其数据表、菜单、角色、演示用户与演示日志在此一并清理，以保证库结构聚焦。
-- 适用范围：
--   1) 全新初始化：本文件在 db-init 之后执行，DROP 不存在的表为空操作；
--   2) 历史库升级：删除已存在的上述数据。
-- 幂等：DROP TABLE IF EXISTS / DELETE ... WHERE 均可重复执行。
-- 本文件由 scripts/migrate.mjs 按版本顺序自动执行（置于 v1.1.x 末位）。
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1) 删除历史遗留模块数据表
DROP TABLE IF EXISTS
  `common_bank`, `common_table`,
  `edu_alert_log`, `edu_answer_record`, `edu_assessment_session`,
  `edu_chat_message`, `edu_chat_session`, `edu_error_analysis`,
  `edu_knowledge_node`, `edu_learning_plan`, `edu_oral_record`,
  `edu_question`, `edu_student_profile`, `edu_subject`, `edu_wrong_question`;

-- 2) 删除与审计无关的历史菜单（保留 page_key='home' = 审计驾驶舱 /cockpit）
DELETE FROM `sl_sys_menu` WHERE `page_key` IN (
  'assessment', 'learning', 'profile', 'errors', 'tutoring',
  'analytics', 'wrongbook', 'favorites', 'memory'
);

-- 3) 删除历史演示用户 / 角色 / 角色菜单（保留 ADMIN / AUDITOR，由运行时 ensure 注入）
DELETE FROM `sl_sys_user` WHERE `username` = 'xiaoxiang';
DELETE FROM `sl_sys_role_menu`
 WHERE `role_id` IN (
   SELECT `id` FROM `sl_sys_role`
   WHERE `role_code` IN ('TEACHER', 'STUDENT', 'HEAD_TEACHER')
 );
DELETE FROM `sl_sys_role` WHERE `role_code` IN ('TEACHER', 'STUDENT', 'HEAD_TEACHER');

-- 4) 删除历史模块的 AI 配置域（edu.ai，当前未启用）
DELETE FROM `sl_sys_config` WHERE `namespace` = 'edu.ai';

-- 5) 删除历史演示操作日志
DELETE FROM `sl_sys_oper_log`
 WHERE `oper_url` LIKE '/api/edu/%'
    OR `oper_url` LIKE '/experiment/%'
    OR `title` IN (
         '智能评测', 'AI答疑', '主观题批改', '口语评测', '学情预警',
         '虚拟实验', '错因分析', '错题变式', 'AI生成题目', '题目管理'
       );

SET FOREIGN_KEY_CHECKS = 1;
