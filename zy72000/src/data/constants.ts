import type { RedemptionStatus, MaterialType } from '@/types';

export const STATUS_LABELS: Record<RedemptionStatus, string> = {
  confirmed: '已确认',
  pending: '待补材料',
  manual: '人工改判',
};

export const STATUS_CLASSES: Record<RedemptionStatus, string> = {
  confirmed: 'status-confirmed',
  pending: 'status-pending',
  manual: 'status-manual',
};

export const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  receipt: '收款流水',
  refund: '退款申请',
  email: '审批邮件',
  import: '系统导入',
};

export const MATERIAL_TYPE_ICONS: Record<MaterialType, string> = {
  receipt: 'receipt',
  refund: 'file-text',
  email: 'mail',
  import: 'database',
};

export const OPERATOR = '阿宁';

export const STORAGE_KEY = 'fund_redemption_queue_data';

export const CSV_HEADERS = [
  '序号',
  '基金代码',
  '基金名称',
  '申请金额(元)',
  '申请日期',
  '预计到账日',
  '申请人',
  '状态',
  '基金赎回预约排队原因',
  '材料齐全情况',
  '最后操作人',
  '最后操作时间',
  '备注条数',
];
