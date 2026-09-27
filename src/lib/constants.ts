// 审计业务枚举（对齐审计业务域字段取值）

export const AUDIT_TYPES = [
  { value: 'cost', label: '造价/结算审计' },
  { value: 'project', label: '工程审计' },
  { value: 'legal', label: '竣工决算' },
];

export const DOC_TYPES = [
  'pdf_text', 'pdf_mixed', 'pdf_scan', 'excel', 'word', 'photo', 'other',
] as const;

export const BIZ_CATEGORIES = [
  'contract', 'boq', 'control_price', 'settlement', 'payment', 'visa', 'photo', 'invoice', 'other',
] as const;

export const BIZ_CATEGORY_LABELS: Record<string, string> = {
  contract: '合同',
  boq: '清单',
  control_price: '控制价',
  settlement: '结算',
  payment: '支付',
  visa: '签证',
  photo: '照片',
  invoice: '发票',
  other: '其他',
};

export const PARSE_STATUS = ['pending', 'processing', 'done', 'failed'] as const;

export const PROJECT_STATUS = [
  { value: 0, label: '进行中' },
  { value: 1, label: '已完成' },
];

export const CHECK_PROGRAM_TYPES = [
  { value: 'boq_settlement', label: '清单↔结算勾稽' },
  { value: 'visa_evidence', label: '签证证据链核对' },
  { value: 'contract_payment', label: '合同付款核对' },
  { value: 'summary_tie', label: '汇总勾稽' },
];

export const CHECK_CONCLUSIONS = ['match', 'diff', 'unconfirmed'] as const;

export const FINDING_TYPES = [
  'no_seal', 'no_photo', 'qty_diff', 'round_amount', 'late_visa',
  'duplicate', 'invoice_serial', 'other',
] as const;

export const FINDING_TYPE_LABELS: Record<string, string> = {
  no_seal: '无签章',
  no_photo: '无照片',
  qty_diff: '量差异常',
  round_amount: '凑整',
  late_visa: '竣工后签证',
  duplicate: '重复',
  invoice_serial: '连号发票',
  other: '其他',
};

export const RISK_LEVELS = [
  { value: 'high', label: '高', color: 'danger' },
  { value: 'mid', label: '中', color: 'warning' },
  { value: 'low', label: '低', color: 'success' },
] as const;

export const FINDING_STATUS = [
  { value: 'open', label: '待核实' },
  { value: 'confirmed', label: '属实' },
  { value: 'misreport', label: '误报' },
  { value: 'closed', label: '已关闭' },
] as const;

export const FINDING_SOURCE = ['check', 'scan', 'manual'] as const;
