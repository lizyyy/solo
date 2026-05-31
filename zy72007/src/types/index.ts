export enum RecordStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PENDING_MATERIAL = 'pending_material',
  MANUAL_ADJUSTED = 'manual_adjusted',
}

export enum MaterialType {
  PAYMENT = 'payment',
  REFUND = 'refund',
  APPROVAL = 'approval',
  HANDWRITTEN = 'handwritten',
}

export enum OperationType {
  CREATE = 'create',
  CONFIRM = 'confirm',
  SUSPEND = 'suspend',
  ADJUST = 'adjust',
  ROLLBACK = 'rollback',
  ADD_NOTE = 'add_note',
}

export interface Material {
  id: string;
  recordId: string;
  type: MaterialType;
  title: string;
  content: string;
  source: string;
  amount?: number;
  createdAt: string;
}

export interface OperationLog {
  id: string;
  recordId: string;
  type: OperationType;
  operator: string;
  oldStatus?: RecordStatus;
  newStatus?: RecordStatus;
  oldAmount?: number;
  newAmount?: number;
  oldSuggestion?: string;
  newSuggestion?: string;
  diffNote: string;
  createdAt: string;
}

export interface Note {
  id: string;
  recordId: string;
  content: string;
  author: string;
  createdAt: string;
}

export interface InvestmentRecord {
  id: string;
  investorName: string;
  amount: number;
  status: RecordStatus;
  previousStatus?: RecordStatus;
  suggestion: string;
  handler: string;
  materials: Material[];
  operationLogs: OperationLog[];
  notes: Note[];
  createdAt: string;
  updatedAt: string;
}

export type StatusFilter = RecordStatus | 'all';

export const RecordStatusLabel: { [key in RecordStatus]: string } = {
  [RecordStatus.PENDING]: '待处理',
  [RecordStatus.CONFIRMED]: '已确认',
  [RecordStatus.PENDING_MATERIAL]: '待补材料',
  [RecordStatus.MANUAL_ADJUSTED]: '人工改判',
};

export const MaterialTypeLabel: { [key in MaterialType]: string } = {
  [MaterialType.PAYMENT]: '收款流水',
  [MaterialType.REFUND]: '退款申请',
  [MaterialType.APPROVAL]: '审批邮件',
  [MaterialType.HANDWRITTEN]: '手写备注',
};

export const OperationTypeLabel: { [key in OperationType]: string } = {
  [OperationType.CREATE]: '创建记录',
  [OperationType.CONFIRM]: '确认入账',
  [OperationType.SUSPEND]: '挂起待补',
  [OperationType.ADJUST]: '人工改判',
  [OperationType.ROLLBACK]: '回退操作',
  [OperationType.ADD_NOTE]: '添加备注',
};
