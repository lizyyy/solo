export enum ReturnBucketStatus {
  NORMAL = '正常',
  REJECTED = '驳回',
  SUPPLEMENT = '补录',
  COMPLETED = '已完成'
}

export enum MaterialType {
  CUSTOMER_SIGNATURE = '客户签收单',
  DRIVER_CONFIRMATION = '配送员确认书',
  SITE_VERIFICATION = '水站核验单',
  PHOTO_PROOF = '现场照片',
  TRANSFER_RECORD = '转桶记录',
  DAMAGE_REPORT = '破损报告'
}

export interface ReturnBucketRecord {
  id: string;
  bucketNumber: string;
  bucketType: string;
  waterStationId: string;
  waterStationName: string;
  deliveryTeamId: string;
  deliveryTeamName: string;
  driverId: string;
  driverName: string;
  driverPhone: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerAddressDetail: string;
  returnDate: string;
  returnQuantity: number;
  returnReason: string;
  bucketCondition: string;
  hasDamage: boolean;
  damageDescription?: string;
  receiverId: string;
  receiverName: string;
  receiveDate?: string;
  status: ReturnBucketStatus;
  rejectReason?: string;
  supplementMaterials: MaterialType[];
  supplementRemark?: string;
  ledgerConsistent: boolean;
  ledgerInconsistencyReason?: string;
  duplicateBucketAddress?: string;
  createTime: string;
  updateTime: string;
  operatorId: string;
  operatorName: string;
  remark?: string;
}

export interface ReturnBucketCreateRequest {
  bucketNumber: string;
  bucketType: string;
  waterStationId: string;
  waterStationName: string;
  deliveryTeamId: string;
  deliveryTeamName: string;
  driverId: string;
  driverName: string;
  driverPhone: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerAddressDetail: string;
  returnDate: string;
  returnQuantity: number;
  returnReason: string;
  bucketCondition: string;
  hasDamage: boolean;
  damageDescription?: string;
  operatorId: string;
  operatorName: string;
  remark?: string;
}

export interface ReturnBucketBatchCreateRequest {
  records: ReturnBucketCreateRequest[];
  batchNo: string;
  operatorId: string;
  operatorName: string;
}

export interface ValidationResult {
  valid: boolean;
  hasDuplicateBucket: boolean;
  duplicateBucketInfo?: {
    bucketNumber: string;
    existingAddress: string;
    newAddress: string;
  };
  ledgerConsistent: boolean;
  ledgerInconsistencyReason?: string;
  requiredMaterials: MaterialType[];
  message: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message: string;
  validationResult?: ValidationResult;
}

export interface ExportQueryParams {
  waterStationId?: string;
  deliveryTeamId?: string;
  startDate?: string;
  endDate?: string;
  status?: ReturnBucketStatus;
}
