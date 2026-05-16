export enum GroupStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  MANUAL_REVIEW = 'MANUAL_REVIEW'
}

export enum RuleType {
  WHITELIST = 'WHITELIST',
  BLACKLIST = 'BLACKLIST',
  PERCENTAGE = 'PERCENTAGE',
  ATTRIBUTE = 'ATTRIBUTE'
}

export interface GroupRule {
  ruleId: string;
  ruleType: RuleType;
  ruleValue: string | number | Record<string, unknown>;
  description: string;
}

export interface SourceSystem {
  systemId: string;
  systemName: string;
  rules: GroupRule[];
}

export interface HitDetail {
  ruleId: string;
  hit: boolean;
  explanation: string;
}

export interface HitResult {
  sourceSystemId: string;
  hitDetails: HitDetail[];
  overallHit: boolean;
  confidence: number;
}

export interface AdjustmentRecord {
  adjustmentId: string;
  operator: string;
  operationType: 'OVERRIDE' | 'ADD_RULE' | 'REMOVE_RULE';
  beforeValue: boolean;
  afterValue: boolean;
  reason: string;
  timestamp: number;
}

export interface TenantGroup {
  tenantId: string;
  groupId: string;
  requestId: string;
  sourceSystems: SourceSystem[];
  mergedRules: GroupRule[];
  hitResults: HitResult[];
  finalResult: boolean | null;
  status: GroupStatus;
  adjustmentRecords: AdjustmentRecord[];
  rawInput: Record<string, unknown>;
  processingBasis: string[];
  errorMessage?: string;
  createdAt: number;
  updatedAt: number;
}

export interface GroupReport {
  reportId: string;
  groupId: string;
  tenantId: string;
  finalResult: boolean | null;
  status: GroupStatus;
  sourceSummary: Array<{
    systemId: string;
    systemName: string;
    hitCount: number;
    totalRules: number;
  }>;
  adjustmentCount: number;
  generatedAt: number;
  exportContent?: string;
}
