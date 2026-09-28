// 全局实体类型定义（对应数据库表与 API 响应）

export interface User {
  id: string;
  username: string;
  nickname?: string;
  avatar?: string;
  email?: string;
  // 后端 is_admin 字段为 tinyint，但所有 auth 接口统一转换为 boolean 后返回
  is_admin?: boolean;
  created_at?: string;
}

export type ProjectRole = 'owner' | 'reviewer';

export interface AuditProject {
  id: string;
  project_name: string;
  project_code?: string | null;
  audit_type: string;
  audit_period?: string | null;
  description?: string | null;
  status: number;
  user_id: string;
  owner_username?: string;
  owner_nickname?: string;
  doc_count?: number;
  parsed_count?: number;
  failed_count?: number;
  finding_count?: number;
  member_count?: number;
  /** 当前用户在该项目中的角色；非成员为 null */
  my_role?: ProjectRole | null;
  /** 当前用户是否可编辑项目、管理成员（仅 owner） */
  can_manage?: boolean;
  del_flag?: number;
  created_by?: string;
  created_at?: string;
  updated_by?: string;
  updated_at?: string;
  remark?: string | null;
}

export interface ProjectMember {
  id: string;
  user_id: string;
  project_role: ProjectRole;
  username?: string;
  nickname?: string;
  email?: string | null;
  is_admin?: boolean;
  created_at?: string;
}

export interface AuditDocument {
  id: string;
  project_id: string;
  file_name: string;
  file_url: string;
  file_path?: string | null;
  file_size: number;
  mime_type?: string | null;
  file_ext?: string | null;
  doc_type: string;
  biz_category: string;
  page_count: number;
  sheet_count: number;
  parse_status: string;
  parse_progress: number;
  parse_error?: string | null;
  ocr_job_id?: string | null;
  result_path?: string | null;
  summary_text?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AuditElement {
  id: string;
  project_id: string;
  document_id: string;
  page_no: number;
  sheet_name?: string | null;
  element_type: string;
  content_md?: string | null;
  bbox_json?: string | null;
  anchor_label?: string | null;
}

export interface ChatSession {
  id: string;
  project_id: string;
  title: string;
  user_id: string;
  last_message_at?: string | null;
  created_at?: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  project_id: string;
  role: string;
  content: string;
  citations_json?: string | null;
  created_at?: string;
}

export interface CheckProgram {
  id: string;
  project_id: string;
  program_type: string;
  program_name?: string | null;
  status: string;
  summary_json?: string | null;
  error_msg?: string | null;
  created_at?: string;
}

export interface CheckItem {
  id: string;
  program_id: string;
  project_id: string;
  item_code?: string | null;
  item_name?: string | null;
  unit?: string | null;
  left_label?: string | null;
  right_label?: string | null;
  qty_left?: number | null;
  qty_right?: number | null;
  price_left?: number | null;
  price_right?: number | null;
  amount_left?: number | null;
  amount_right?: number | null;
  diff_qty?: number | null;
  diff_amount?: number | null;
  conclusion: string;
  diff_desc?: string | null;
  evidence_json?: string | null;
  suggestion?: string | null;
}

export interface Finding {
  id: string;
  project_id: string;
  finding_type: string;
  title: string;
  risk_level: string;
  description?: string | null;
  evidence_json?: string | null;
  suggestion?: string | null;
  source: string;
  ref_id?: string | null;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface BidSession {
  id: string;
  title: string;
  project_id?: string | null;
  status: string;
  control_price_doc_id?: string | null;
  created_at?: string;
}

export interface BidParty {
  id: string;
  session_id: string;
  party_name: string;
  order_no: number;
  doc_id?: string | null;
}

export interface AiModelChain {
  models: Array<{
    model: string;
    base_url?: string;
    api_key?: string;
    timeout_ms?: number;
    enabled?: boolean;
  }>;
  failover_enabled?: boolean;
  total_timeout_ms?: number;
}

export interface MenuItem {
  id: number;
  page_key: string;
  menu_name: string;
  menu_icon: string;
  menu_url: string;
  sort_no: number;
  is_enabled: number;
}
