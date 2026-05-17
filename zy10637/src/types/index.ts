export enum RedApplyStatus {
  PENDING_APPLY = '待申请',
  VERIFYING = '核验中',
  RED_COMPLETED = '已红冲',
  REJECTED = '被驳回'
}

export enum OperationSource {
  IMPORT = '导入',
  MANUAL = '人工操作',
  API = 'API调用',
  SYSTEM = '系统自动'
}

export enum ErrorType {
  DATA_INCOMPLETE = '数据不完整',
  CONFLICT_REFUND = '部分退款申请全额红冲冲突',
  DUPLICATE_RECORD = '重复记录',
  INVALID_FORMAT = '格式错误',
  BUSINESS_RULE_VIOLATION = '业务规则冲突',
  NEED_MANUAL = '需人工处理'
}

export interface Invoice {
  id: string;
  invoiceCode: string;
  invoiceNumber: string;
  invoiceDate: string;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  buyerName: string;
  buyerTaxId: string;
  sellerName: string;
  sellerTaxId: string;
}

export interface Order {
  id: string;
  orderNo: string;
  orderDate: string;
  orderAmount: number;
  refundAmount: number;
  isPartialRefund: boolean;
}

export interface Attachment {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadTime: string;
}

export interface HistoryRecord {
  id: string;
  redApplyId: string;
  operationSource: OperationSource;
  operator: string;
  operationTime: string;
  operationType: string;
  fromStatus?: RedApplyStatus;
  toStatus?: RedApplyStatus;
  remark?: string;
  changes?: Record<string, any>;
}

export interface RedApply {
  id: string;
  invoice: Invoice;
  order: Order;
  redReason: string;
  attachments: Attachment[];
  status: RedApplyStatus;
  rejectReason?: string;
  errorType?: ErrorType;
  createdAt: string;
  updatedAt: string;
}

export interface ImportResult {
  success: number;
  failed: number;
  failedDetails: Array<{
    rowIndex: number;
    data: Record<string, any>;
    error: string;
    errorType: ErrorType;
  }>;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    type: ErrorType;
    suggestion: string;
  };
}
