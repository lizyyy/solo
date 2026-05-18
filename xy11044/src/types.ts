export type SeafoodType = 'fish' | 'shrimp' | 'crab' | 'shellfish' | 'squid' | 'other';
export type QualityLevel = 'excellent' | 'good' | 'normal' | 'poor';
export type InspectionStatus = 'draft' | 'submitted' | 'manual_processing' | 'approved' | 'rejected' | 'withdrawn';
export type OperationType = 'create' | 'update' | 'submit' | 'withdraw' | 'manual_process' | 'approve' | 'reject' | 'resubmit' | 'add_remark';

export interface InspectionOrder {
  id: string;
  orderNo: string;
  supplierId: string;
  supplierName: string;
  deliveryDate: string;
  vehicleNo?: string;
  driverName?: string;
  driverPhone?: string;
  totalQuantity: number;
  totalWeight: number;
  totalLossWeight: number;
  totalLossRate: number;
  status: InspectionStatus;
  inspectorId?: string;
  inspectorName?: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  manualProcessedAt?: string;
}

export interface InspectionItem {
  id: string;
  orderId: string;
  seafoodType: SeafoodType;
  seafoodName: string;
  seafoodSpec?: string;
  isLive: number;
  expectedQuantity: number;
  expectedWeight: number;
  actualQuantity: number;
  actualWeight: number;
  lossWeight: number;
  lossRate: number;
  temperature?: number;
  salinity?: number;
  phValue?: number;
  qualityLevel?: QualityLevel;
  abnormalDescription?: string;
  imageUrls?: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InspectionHistory {
  id: string;
  orderId: string;
  operationType: OperationType;
  operatorId?: string;
  operatorName?: string;
  beforeStatus?: InspectionStatus;
  afterStatus?: InspectionStatus;
  changeContent: string;
  remark?: string;
  createdAt: string;
}

export interface CreateOrderRequest {
  supplierId: string;
  supplierName: string;
  deliveryDate: string;
  vehicleNo?: string;
  driverName?: string;
  driverPhone?: string;
  items: Omit<InspectionItem, 'id' | 'orderId' | 'createdAt' | 'updatedAt' | 'lossWeight' | 'lossRate'>[];
  operatorId?: string;
  operatorName?: string;
}

export interface UpdateOrderRequest {
  supplierId?: string;
  supplierName?: string;
  deliveryDate?: string;
  vehicleNo?: string;
  driverName?: string;
  driverPhone?: string;
  items?: Omit<InspectionItem, 'id' | 'orderId' | 'createdAt' | 'updatedAt' | 'lossWeight' | 'lossRate'>[];
  remark?: string;
  operatorId?: string;
  operatorName?: string;
}

export interface SubmitOrderRequest {
  operatorId?: string;
  operatorName?: string;
  remark?: string;
}

export interface WithdrawOrderRequest {
  operatorId?: string;
  operatorName?: string;
  remark?: string;
}

export interface ManualProcessRequest {
  operatorId?: string;
  operatorName?: string;
  remark: string;
}

export interface AddRemarkRequest {
  operatorId?: string;
  operatorName?: string;
  remark: string;
}

export interface DailyReport {
  date: string;
  totalOrders: number;
  submittedOrders: number;
  approvedOrders: number;
  rejectedOrders: number;
  totalWeight: number;
  totalLossWeight: number;
  averageLossRate: number;
  liveSeafoodLossRate: number;
  icedSeafoodLossRate: number;
}
