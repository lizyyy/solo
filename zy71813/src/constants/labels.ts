export const STATUS_LABELS: Record<string, string> = {
  pending: '待处理',
  investigating: '核查中',
  resolved: '已解决',
  disputed: '有争议'
};

export const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  investigating: 'bg-blue-100 text-blue-800 border-blue-200',
  resolved: 'bg-green-100 text-green-800 border-green-200',
  disputed: 'bg-red-100 text-red-800 border-red-200'
};

export const CHANGE_TYPE_LABELS: Record<string, string> = {
  material_only: '仅补材料',
  conclusion_changed: '结论变更'
};

export const CHANGE_TYPE_COLORS: Record<string, string> = {
  material_only: 'bg-purple-100 text-purple-800',
  conclusion_changed: 'bg-red-100 text-red-800'
};

export const SOURCE_LABELS: Record<string, string> = {
  refund_list: '退款清单',
  settlement_attachment: '结算附件',
  bank_statement: '银行对账单',
  manual_adjustment: '手工调整'
};

export const SOURCE_ICONS: Record<string, string> = {
  refund_list: '📋',
  settlement_attachment: '📎',
  bank_statement: '🏦',
  manual_adjustment: '✏️'
};

export const CATEGORY_LABELS: Record<string, string> = {
  fee_carryover: '手续费跨期',
  refund_early_arrival: '退款清单早到',
  attachment_late_submit: '结算附件晚补',
  statement_manual_edit: '对账单手工改动',
  amount_mismatch: '金额不符',
  missing_document: '缺少单据',
  other: '其他'
};

export const FIELD_LABELS: Record<string, string> = {
  amount: '金额',
  status: '状态',
  conclusion: '结论',
  issueCategory: '问题分类',
  pendingReason: '待处理原因',
  sourceRef: '来源参考'
};

export function formatFieldName(field: string): string {
  if (field.startsWith('attachment:')) {
    return `附件[${field.replace('attachment:', '')}]`;
  }
  return FIELD_LABELS[field] || field;
}
