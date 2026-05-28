export interface ProductContract {
  id: string;
  productId: string;
  productName: string;
  version: string;
  effectiveDate: string;
  expireDate: string | null;
  baseRate: number;
  createdAt: string;
}

export interface CustomerShare {
  id: string;
  customerId: string;
  customerName: string;
  productId: string;
  shareAmount: number;
  purchaseDate: string;
  contractId: string;
}

export interface RateVersion {
  id: string;
  productId: string;
  version: string;
  effectiveDate: string;
  managementFeeRate: number;
  serviceFeeRate: number;
  description: string;
}

export interface PromotionPeriod {
  id: string;
  productId: string;
  customerId: string | null;
  name: string;
  startDate: string;
  endDate: string;
  discountRate: number;
  status: 'active' | 'expired';
}

export interface ChargeRecord {
  id: string;
  customerId: string;
  productId: string;
  chargeDate: string;
  shareAmount: number;
  appliedRate: number;
  chargedAmount: number;
  rateVersionId: string;
  promotionId: string | null;
}

export type AuditStatus = 'pending' | 'normal' | 'abnormal' | 'resolved';

export interface AuditRecord {
  id: string;
  customerId: string;
  customerName: string;
  productId: string;
  productName: string;
  shareId: string;
  contractId: string;
  rateVersionId: string;
  promotionId: string | null;
  chargeId: string;
  status: AuditStatus;
  expectedAmount: number;
  actualAmount: number;
  diffAmount: number;
  reasons: string[];
  auditTime: string;
  resolvedTime: string | null;
  rollbackId: string | null;
}

export type RollbackStatus = 'pending' | 'completed';

export interface RollbackRecord {
  id: string;
  auditId: string;
  customerId: string;
  productId: string;
  rollbackAmount: number;
  compensationAmount: number;
  totalAmount: number;
  status: RollbackStatus;
  createdAt: string;
  completedAt: string | null;
}

export type NodeStatus = 'ok' | 'warning' | 'error';
export type NodeType = 'contract' | 'share' | 'rate' | 'promotion' | 'charge' | 'audit';

export interface AuditLinkNode {
  type: NodeType;
  data: Record<string, unknown>;
  status: NodeStatus;
  message: string;
}

export interface AuditStats {
  total: number;
  pending: number;
  normal: number;
  abnormal: number;
  resolved: number;
  totalDiffAmount: number;
}
