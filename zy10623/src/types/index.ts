export enum RefundReviewStatus {
  PENDING_REFUND = 'PENDING_REFUND',
  INTERCEPTING = 'INTERCEPTING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

export const RefundReviewStatusLabel: Record<RefundReviewStatus, string> = {
  [RefundReviewStatus.PENDING_REFUND]: '待退款',
  [RefundReviewStatus.INTERCEPTING]: '拦截中',
  [RefundReviewStatus.APPROVED]: '放行',
  [RefundReviewStatus.REJECTED]: '拒绝'
};

export enum RiskTag {
  SUSPICIOUS_FREQUENCY = 'SUSPICIOUS_FREQUENCY',
  SPLIT_ORDER_EVASION = 'SPLIT_ORDER_EVASION',
  ABNORMAL_REFUND_AMOUNT = 'ABNORMAL_REFUND_AMOUNT',
  NEW_USER_RISK = 'NEW_USER_RISK',
  HISTORICAL_FRAUD = 'HISTORICAL_FRAUD',
  IP_ABNORMAL = 'IP_ABNORMAL'
}

export const RiskTagLabel: Record<RiskTag, string> = {
  [RiskTag.SUSPICIOUS_FREQUENCY]: '退款频率异常',
  [RiskTag.SPLIT_ORDER_EVASION]: '拆单绕开阈值',
  [RiskTag.ABNORMAL_REFUND_AMOUNT]: '退款金额异常',
  [RiskTag.NEW_USER_RISK]: '新用户风险',
  [RiskTag.HISTORICAL_FRAUD]: '历史欺诈记录',
  [RiskTag.IP_ABNORMAL]: 'IP异常'
};

export enum ReviewConclusion {
  MANUAL_APPROVE = 'MANUAL_APPROVE',
  MANUAL_REJECT = 'MANUAL_REJECT',
  AUTO_APPROVE = 'AUTO_APPROVE',
  AUTO_REJECT = 'AUTO_REJECT'
}

export const ReviewConclusionLabel: Record<ReviewConclusion, string> = {
  [ReviewConclusion.MANUAL_APPROVE]: '人工放行',
  [ReviewConclusion.MANUAL_REJECT]: '人工拒绝',
  [ReviewConclusion.AUTO_APPROVE]: '自动放行',
  [ReviewConclusion.AUTO_REJECT]: '自动拒绝'
};

export enum RefundReason {
  QUALITY_ISSUE = 'QUALITY_ISSUE',
  WRONG_ITEM = 'WRONG_ITEM',
  DAMAGED = 'DAMAGED',
  NOT_AS_DESCRIBED = 'NOT_AS_DESCRIBED',
  CHANGE_MIND = 'CHANGE_MIND',
  OTHER = 'OTHER'
}

export const RefundReasonLabel: Record<RefundReason, string> = {
  [RefundReason.QUALITY_ISSUE]: '质量问题',
  [RefundReason.WRONG_ITEM]: '发错商品',
  [RefundReason.DAMAGED]: '商品破损',
  [RefundReason.NOT_AS_DESCRIBED]: '与描述不符',
  [RefundReason.CHANGE_MIND]: '不想要了',
  [RefundReason.OTHER]: '其他原因'
};

export interface OrderInfo {
  orderId: string;
  orderNo: string;
  userId: string;
  userPhone?: string;
  orderAmount: number;
  refundAmount: number;
  createTime: string;
  payTime?: string;
  goodsName: string;
  goodsId: string;
}

export interface AuditLog {
  id: string;
  refundReviewId: string;
  operatorId?: string;
  operatorName?: string;
  action: string;
  actionLabel: string;
  oldStatus?: RefundReviewStatus;
  newStatus?: RefundReviewStatus;
  remark?: string;
  createTime: string;
  ip?: string;
}

export interface RefundReview {
  id: string;
  orderInfo: OrderInfo;
  refundReason: RefundReason;
  refundReasonDetail?: string;
  riskTags: RiskTag[];
  status: RefundReviewStatus;
  reviewConclusion?: ReviewConclusion;
  reviewerId?: string;
  reviewerName?: string;
  reviewTime?: string;
  reviewRemark?: string;
  manualRemark?: string;
  manualRemarkOperatorId?: string;
  manualRemarkOperatorName?: string;
  manualRemarkTime?: string;
  splitOrderGroupId?: string;
  createTime: string;
  updateTime: string;
  idempotentKey: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  code: string;
  message: string;
  businessCode?: string;
  businessMessage?: string;
  data?: T;
  timestamp: string;
  requestId: string;
}

export interface PageResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ReviewRequest {
  reviewConclusion: ReviewConclusion;
  reviewRemark?: string;
  operatorId: string;
  operatorName: string;
}

export interface ManualRemarkRequest {
  manualRemark: string;
  operatorId: string;
  operatorName: string;
}

export interface ExportField {
  field: string;
  label: string;
}

export interface ConflictRecord {
  id: string;
  refundReviewId: string;
  conflictType: string;
  conflictMessage: string;
  oldValue?: any;
  newValue?: any;
  operatorId?: string;
  operatorName?: string;
  createTime: string;
}

export interface ImportBadRow {
  id?: string;
  rowNumber: number;
  rawData: string;
  errorMessage: string;
  errorFields: string[];
  importBatchId: string;
  createTime: string;
}

export enum RepairPartReturnStatus {
  PENDING_SHIP = 'PENDING_SHIP',
  IN_TRANSIT = 'IN_TRANSIT',
  PENDING_INSPECTION = 'PENDING_INSPECTION',
  INSPECTED = 'INSPECTED',
  STOCKED = 'STOCKED',
  REJECTED = 'REJECTED'
}

export const RepairPartReturnStatusLabel: Record<RepairPartReturnStatus, string> = {
  [RepairPartReturnStatus.PENDING_SHIP]: '待寄出',
  [RepairPartReturnStatus.IN_TRANSIT]: '返厂中',
  [RepairPartReturnStatus.PENDING_INSPECTION]: '待检测',
  [RepairPartReturnStatus.INSPECTED]: '已检测',
  [RepairPartReturnStatus.STOCKED]: '已入库',
  [RepairPartReturnStatus.REJECTED]: '驳回'
};

export enum InspectionResult {
  PASS = 'PASS',
  FAIL = 'FAIL',
  NEED_REPAIR = 'NEED_REPAIR',
  SCRAP = 'SCRAP'
}

export const InspectionResultLabel: Record<InspectionResult, string> = {
  [InspectionResult.PASS]: '检测通过',
  [InspectionResult.FAIL]: '检测不通过',
  [InspectionResult.NEED_REPAIR]: '需维修',
  [InspectionResult.SCRAP]: '报废'
};

export enum Carrier {
  SF = 'SF',
  JD = 'JD',
  ZTO = 'ZTO',
  YTO = 'YTO',
  EMS = 'EMS'
}

export const CarrierLabel: Record<Carrier, string> = {
  [Carrier.SF]: '顺丰',
  [Carrier.JD]: '京东',
  [Carrier.ZTO]: '中通',
  [Carrier.YTO]: '圆通',
  [Carrier.EMS]: 'EMS'
};

export interface SparePart {
  partId: string;
  partName: string;
  partCode: string;
  partModel: string;
  quantity: number;
  unit: string;
  price?: number;
}

export interface RepairOrder {
  repairOrderId: string;
  repairOrderNo: string;
  customerName: string;
  customerPhone: string;
  faultDescription: string;
  createTime: string;
}

export interface InspectionConclusion {
  inspectorId?: string;
  inspectorName?: string;
  inspectionTime?: string;
  result: InspectionResult;
  remark?: string;
  defectDescription?: string;
  repairSuggestion?: string;
  requiredMaterials?: string[];
}

export interface ShippingInfo {
  carrier: Carrier;
  trackingNo: string;
  shipTime?: string;
  receiveTime?: string;
  receiverName?: string;
}

export interface RepairPartReturn {
  id: string;
  returnNo: string;
  sparePart: SparePart;
  repairOrder: RepairOrder;
  shippingInfo?: ShippingInfo;
  inspectionConclusion?: InspectionConclusion;
  status: RepairPartReturnStatus;
  stockRecovered: boolean;
  nextStepHint?: string;
  remark?: string;
  createTime: string;
  updateTime: string;
  operatorId?: string;
  operatorName?: string;
  idempotentKey: string;
}

export interface RepairPartReturnHistory {
  id: string;
  returnId: string;
  oldStatus?: RepairPartReturnStatus;
  newStatus: RepairPartReturnStatus;
  operatorId?: string;
  operatorName?: string;
  remark?: string;
  createTime: string;
}

export interface CreateReturnRequest {
  sparePart: Omit<SparePart, 'partId'>;
  repairOrder: Omit<RepairOrder, 'repairOrderId'>;
  remark?: string;
  operatorId: string;
  operatorName: string;
  idempotentKey: string;
}

export interface ShipRequest {
  carrier: Carrier;
  trackingNo: string;
  operatorId: string;
  operatorName: string;
  remark?: string;
}

export interface ReceiveRequest {
  receiverName: string;
  operatorId: string;
  operatorName: string;
  remark?: string;
}

export interface InspectionRequest {
  result: InspectionResult;
  remark?: string;
  defectDescription?: string;
  repairSuggestion?: string;
  requiredMaterials?: string[];
  inspectorId: string;
  inspectorName: string;
}

export interface StockInRequest {
  operatorId: string;
  operatorName: string;
  remark?: string;
}
