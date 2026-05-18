export interface CouponBatch {
  batchId: string;
  batchName: string;
  anchorId: string;
  anchorName: string;
  couponType: string;
  totalCount: number;
  grantedCount: number;
  withdrawalTime: string;
  status: string;
}

export interface CouponRecord {
  recordId: string;
  batchId: string;
  userId: string;
  userName: string;
  couponCode: string;
  receiveTime: string;
  expireTime: string;
  useStatus: 'UNUSED' | 'USED' | 'EXPIRED' | 'REFUNDED';
  orderId?: string;
  useTime?: string;
}

export interface OrderDetail {
  orderId: string;
  userId: string;
  batchId: string;
  couponCode: string;
  orderAmount: number;
  discountAmount: number;
  payAmount: number;
  orderTime: string;
  refundStatus: 'NONE' | 'PARTIAL' | 'FULL';
  refundAmount: number;
  refundTime?: string;
}

export type UserImpactLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface WithdrawalImpact {
  batchId: string;
  batchName: string;
  anchorId: string;
  anchorName: string;
  userId: string;
  userName: string;
  couponCode: string;
  receiveTime: string;
  expireTime: string;
  useStatus: string;
  orderId?: string;
  orderTime?: string;
  orderAmount?: number;
  discountAmount?: number;
  refundStatus?: string;
  refundAmount?: number;
  impactLevel: UserImpactLevel;
  impactDescription: string;
  lossAmount: number;
}

export interface ImpactStatistics {
  totalAffectedUsers: number;
  totalAffectedCoupons: number;
  totalLossAmount: number;
  byImpactLevel: {
    HIGH: number;
    MEDIUM: number;
    LOW: number;
  };
  byUseStatus: Record<string, number>;
}

export interface CliOptions {
  batches: string;
  records: string;
  orders: string;
  output: string;
}
