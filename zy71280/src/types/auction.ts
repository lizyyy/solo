export interface AuctionItem {
  id: string;
  name: string;
  category: string;
  appraisedValue: number;
  appraiser?: string;
  appraisalDate?: string;
  condition: string;
  provenance?: string;
  notes?: string;
}

export interface BidRecord {
  id: string;
  itemId: string;
  buyerId: string;
  buyerName: string;
  bidAmount: number;
  bidDate: string;
  bidType: 'floor' | 'phone' | 'online' | 'absentee';
  isWinning: boolean;
  buyerActivity: number;
  buyerHistory: number;
}

export interface TransactionRecord {
  id: string;
  itemId: string;
  itemName: string;
  salePrice: number;
  reservePrice: number;
  saleDate: string;
  buyerId: string;
  commissionRate: number;
  commissionAmount: number;
  auctionHouse: string;
  notes?: string;
}

export interface CommissionTier {
  tier: number;
  minAmount: number;
  maxAmount: number | null;
  rate: number;
  description: string;
}

export interface UnsoldRecord {
  id: string;
  itemId: string;
  itemName: string;
  appraisedValue: number;
  reservePrice: number;
  highestBid: number;
  unsoldDate: string;
  reason: string;
  reAuctionCount: number;
  storageCost?: number;
  marketingCost?: number;
  opportunityCost?: number;
}

export interface CalculationParams {
  riskTolerance: number;
  commissionTiers: CommissionTier[];
  unsoldCostCoefficient: number;
  buyerWeight: number;
  minReserveRatio: number;
  maxReserveRatio: number;
  maxUnsoldProbability: number;
  minCommissionGuarantee: number;
}

export interface CalculationPoint {
  reservePrice: number;
  reserveRatio: number;
  expectedRevenue: number;
  expectedCommission: number;
  unsoldProbability: number;
  confidence: number;
  scenario: 'conservative' | 'neutral' | 'optimistic';
}

export type AnomalyType = 'sample_size' | 'unsold_cost' | 'commission_tier' | 'data_quality';
export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AnomalyItem {
  id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  title: string;
  description: string;
  basis: string;
  impact: string;
  suggestion: string;
  relatedData?: string[];
}

export interface OptimizationReport {
  generatedAt: string;
  itemSummary: AuctionItem;
  optimalReservePrice: number;
  reservePriceRange: [number, number];
  scenarios: {
    conservative: CalculationPoint;
    neutral: CalculationPoint;
    optimistic: CalculationPoint;
  };
  anomalies: AnomalyItem[];
  parameterSnapshot: CalculationParams;
  ruleNotes: string;
}

export interface ScenarioAdjustment {
  activity: number;
  probability: number;
}

export interface RulesConfig {
  sampleSizeThresholds: {
    critical: number;
    warning: number;
    good: number;
  };
  commissionIndustryStandard: CommissionTier[];
  unsoldCostComponents: Array<{
    key: string;
    name: string;
    default: number;
    description: string;
  }>;
  scenarioAdjustments: {
    conservative: ScenarioAdjustment;
    neutral: ScenarioAdjustment;
    optimistic: ScenarioAdjustment;
  };
}

export type ScenarioType = 'conservative' | 'neutral' | 'optimistic';

export interface UploadedData {
  items: AuctionItem[];
  bids: BidRecord[];
  transactions: TransactionRecord[];
  unsolds: UnsoldRecord[];
}

export interface DataValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  recordCounts: {
    items: number;
    bids: number;
    transactions: number;
    unsolds: number;
  };
}
