export enum ReissueStatus {
  DRAFT = 'draft',
  NORMAL = 'normal',
  REJECTED = 'rejected',
  SUPPLEMENTED = 'supplemented',
  PROCESSING = 'processing',
  REVIEWING = 'reviewing',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export enum IssueType {
  MISSING = 'missing',
  WRONG = 'wrong',
  DAMAGED = 'damaged',
  EXPIRED = 'expired'
}

export interface ReissueOrder {
  id: string;
  orderNo: string;
  groupBuyCode: string;
  groupBuyName: string;
  leaderId: string;
  leaderName: string;
  leaderPhone: string;
  warehouseCode: string;
  warehouseName: string;
  originalOrderNo: string;
  originalOrderDate: Date;
  status: ReissueStatus;
  totalAmount: number;
  totalItems: number;
  remark: string;
  createdBy: string;
  createdAt: Date;
  updatedBy: string;
  updatedAt: Date;
}

export interface ReissueItem {
  id: string;
  reissueOrderId: string;
  productCode: string;
  productName: string;
  skuCode: string;
  skuName: string;
  issueType: IssueType;
  originalQuantity: number;
  issueQuantity: number;
  reissueQuantity: number;
  unitPrice: number;
  subtotal: number;
  remark: string;
  createdAt: Date;
}

export interface ReissueHistory {
  id: string;
  reissueOrderId: string;
  action: string;
  previousStatus: ReissueStatus | null;
  newStatus: ReissueStatus | null;
  operatorId: string;
  operatorName: string;
  remark: string;
  changeDetails: string;
  createdAt: Date;
}

export interface CreateReissueOrderRequest {
  groupBuyCode: string;
  groupBuyName: string;
  leaderId: string;
  leaderName: string;
  leaderPhone: string;
  warehouseCode: string;
  warehouseName: string;
  originalOrderNo: string;
  originalOrderDate: string;
  items: CreateReissueItemRequest[];
  remark: string;
  createdBy: string;
}

export interface CreateReissueItemRequest {
  productCode: string;
  productName: string;
  skuCode: string;
  skuName: string;
  issueType: IssueType;
  originalQuantity: number;
  issueQuantity: number;
  reissueQuantity: number;
  unitPrice: number;
  remark: string;
}

export interface UpdateReissueStatusRequest {
  status: ReissueStatus;
  remark: string;
  operatorId: string;
  operatorName: string;
}
