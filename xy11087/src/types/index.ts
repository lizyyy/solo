export enum ReplenishmentAbnormalType {
  CHANNEL_MISPLACEMENT = 'channel_misplacement',
  REPLENISHMENT_DIFF_INCONSISTENCY = 'replenishment_diff_inconsistency',
  STOCK_SHORTAGE = 'stock_shortage',
  MACHINE_FAULT = 'machine_fault',
  NETWORK_ABNORMAL = 'network_abnormal',
  OTHER = 'other'
}

export enum ReplenishmentAbnormalStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  REMARKED = 'remarked',
  SUSPENDED = 'suspended',
  RESOLVED = 'resolved',
  CLOSED = 'closed'
}

export interface ReplenishmentAbnormal {
  id: string;
  abnormalNo: string;
  machineId: string;
  machineName: string;
  pointId: string;
  pointName: string;
  pointAddress: string;
  channelNo: string;
  channelName: string;
  productSku: string;
  productName: string;
  actualProductSku?: string;
  actualProductName?: string;
  abnormalType: ReplenishmentAbnormalType;
  abnormalTypeDesc: string;
  abnormalStatus: ReplenishmentAbnormalStatus;
  expectedQty: number;
  actualQty: number;
  diffQty: number;
  replenishmentTime: Date;
  operatorId: string;
  operatorName: string;
  handlerId?: string;
  handlerName?: string;
  remark?: string;
  statusHistory: StatusHistoryItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface StatusHistoryItem {
  status: ReplenishmentAbnormalStatus;
  operatorId: string;
  operatorName: string;
  remark?: string;
  operatedAt: Date;
}

export interface ImportRow {
  [key: string]: any;
}

export interface ImportResult {
  success: number;
  failed: number;
  total: number;
  successItems: ReplenishmentAbnormal[];
  failedItems: FailedImportItem[];
}

export interface FailedImportItem {
  rowData: ImportRow;
  reason: string;
  suggestion: string;
}

export interface AddRemarkRequest {
  abnormalNo: string;
  remark: string;
  operatorId: string;
  operatorName: string;
}
