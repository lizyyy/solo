export interface ReturnOrder {
  returnOrderNo: string;
  partCode: string;
  partName: string;
  returnDate: string;
  returnReason: string;
  returnStatus: string;
  carrier: string;
  trackingNo: string;
  quantity: number;
}

export interface InventoryItem {
  partCode: string;
  partName: string;
  warehouseLocation: string;
  quantity: number;
  status: string;
  lastUpdateDate: string;
}

export interface InspectionResult {
  returnOrderNo: string;
  partCode: string;
  inspectionDate: string;
  inspectionResult: string;
  inspectionConclusion: string;
  inspector: string;
  repairStatus: string;
}

export type ReconciliationStatus = 
  | '正常'
  | '拆件维修'
  | '检测驳回'
  | '承运商丢件'
  | '状态不一致'
  | '库存缺失'
  | '检测缺失';

export interface ReconciliationRecord {
  returnOrderNo: string;
  partCode: string;
  partName: string;
  returnDate: string;
  returnStatus: string;
  inventoryStatus: string;
  inspectionResult: string;
  repairStatus: string;
  reconciliationStatus: ReconciliationStatus;
  remarks: string;
  isAbnormal: boolean;
}

export interface ReconciliationSummary {
  totalRecords: number;
  normalCount: number;
  abnormalCount: number;
  breakdown: {
    normal: number;
    dismantleRepair: number;
    inspectionRejected: number;
    carrierLost: number;
    statusMismatch: number;
    inventoryMissing: number;
    inspectionMissing: number;
  };
}

export interface ReconciliationResult {
  records: ReconciliationRecord[];
  summary: ReconciliationSummary;
  detailedLogs: string[];
}
