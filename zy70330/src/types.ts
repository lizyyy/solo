export type PartyType = 'platform' | 'merchant' | 'talent' | 'serviceProvider';

export interface Party {
  id: string;
  type: PartyType;
  name: string;
  active: boolean;
  metadata?: Record<string, any>;
}

export interface Order {
  id: string;
  merchantId: string;
  talentId?: string;
  serviceProviderId?: string;
  amount: number;
  orderDate: string;
  settlementDate: string;
  status: 'pending' | 'completed' | 'refunded' | 'partial_refund';
  originalSettlement?: SettlementResult;
  metadata?: Record<string, any>;
}

export interface Refund {
  id: string;
  orderId: string;
  refundAmount: number;
  refundDate: string;
  refundType: 'full' | 'partial';
  refundReason?: string;
}

export interface RuleVersion {
  version: string;
  effectiveStartDate: string;
  effectiveEndDate?: string;
  description: string;
  platformFeeRate: number;
  merchantSplitRate: number;
  talentCommissionRate: number;
  serviceProviderSplitRate: number;
  talentMinimumGuarantee?: number;
  serviceProviderMinimumGuarantee?: number;
  settlementCycle: 'daily' | 'weekly' | 'monthly';
  refundDeductionPolicy: 'proportionate' | 'last_in_first_out' | 'first_in_first_out';
}

export interface Config {
  oldRules: RuleVersion[];
  newRules: RuleVersion[];
  defaultPartyIds: {
    platform: string;
    defaultServiceProvider?: string;
  };
}

export interface SettlementDetail {
  partyId: string;
  partyType: PartyType;
  partyName: string;
  baseAmount: number;
  rate: number;
  calculatedAmount: number;
  guaranteeApplied?: boolean;
  guaranteeAmount?: number;
  finalAmount: number;
  refundDeduction: number;
  ruleVersion: string;
}

export interface SettlementResult {
  orderId: string;
  ruleVersion: string;
  settlementDate: string;
  totalAmount: number;
  refundAmount: number;
  netAmount: number;
  details: SettlementDetail[];
  anomalies: Anomaly[];
  isSettlementPossible: boolean;
}

export interface Anomaly {
  type: 'missing_talent' | 'missing_service_provider' | 'rule_overlap' | 'missing_rule' | 'duplicate_order' | 'cross_cycle_settlement' | 'unknown';
  severity: 'warning' | 'error';
  message: string;
  affectedParties?: string[];
}

export interface SimulationResult {
  timestamp: string;
  configVersion: string;
  totalOrders: number;
  totalAmount: number;
  totalRefundAmount: number;
  oldSettlementSummary: SettlementSummary;
  newSettlementSummary: SettlementSummary;
  differences: OrderDifference[];
  anomalies: Anomaly[];
  cannotSettleOrders: CannotSettleOrder[];
}

export interface SettlementSummary {
  ruleVersions: string[];
  platformTotal: number;
  merchantTotal: number;
  talentTotal: number;
  serviceProviderTotal: number;
  grandTotal: number;
  ordersCount: number;
  anomalyCount: number;
}

export interface OrderDifference {
  orderId: string;
  orderAmount: number;
  refundAmount: number;
  oldRuleVersion: string;
  newRuleVersion: string;
  platformDiff: number;
  merchantDiff: number;
  talentDiff: number;
  serviceProviderDiff: number;
  totalDiff: number;
  diffPercentage: number;
  hasGuaranteeChange: boolean;
  hasRuleVersionChange: boolean;
  anomalies: Anomaly[];
}

export interface CannotSettleOrder {
  orderId: string;
  reason: string;
  anomalies: Anomaly[];
}

export interface ExplainDetail {
  orderId: string;
  orderDate: string;
  settlementDate: string;
  orderAmount: number;
  refundAmount: number;
  netAmount: number;
  oldSettlement: SettlementResult;
  newSettlement: SettlementResult;
  comparison: {
    partyType: PartyType;
    oldAmount: number;
    newAmount: number;
    diff: number;
    diffPercentage: number;
    reason: string;
  }[];
  anomalies: Anomaly[];
}

export type CommandAction = 'check' | 'simulate' | 'diff' | 'explain' | 'export';
