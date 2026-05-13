export type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type IssueType = 
  | 'no_ttl'           
  | 'ttl_too_long'    
  | 'ttl_too_short'   
  | 'invalid_name'    
  | 'policy_mismatch' 
  | 'inconsistent_policy';

export interface RedisKeyRecord {
  key: string;
  ttl: number | null; 
  type?: string;
  size?: number;
  lastSeenAt: number;
}

export interface KeySnapshot {
  version: string;
  generatedAt: number;
  isComplete: boolean;
  sampleRate?: number;
  keys: RedisKeyRecord[];
}

export interface BusinessPrefix {
  prefix: string;
  description: string;
  owner?: string;
  isTemporary?: boolean;
  tempExpireDate?: string; 
}

export interface TTLPolicy {
  id: string;
  name: string;
  description: string;
  minTTL: number; 
  maxTTL: number; 
  suggestedTTL: number;
  unit: 'seconds' | 'minutes' | 'hours' | 'days';
}

export interface PolicyBinding {
  prefix: string;
  policyId: string;
}

export interface AuditRules {
  businessPrefixes: BusinessPrefix[];
  ttlPolicies: TTLPolicy[];
  policyBindings: PolicyBinding[];
  globalSettings: {
    maxAllowedTTL: number;
    minWarnTTL: number;
    treatNoTTLAs: RiskLevel;
  };
}

export interface KeyIssue {
  key: string;
  issueType: IssueType;
  riskLevel: RiskLevel;
  currentTTL: number | null;
  expectedTTL?: number;
  suggestedTTL?: number;
  policyId?: string;
  businessPrefix: string;
  description: string;
  needsBusinessConfirmation: boolean;
  isTemporary?: boolean;
}

export interface AcceptedIssue {
  key: string;
  issueType: IssueType;
  reason: string;
  acceptedAt: number;
  expiresAt: number; 
  acceptedBy?: string;
}

export interface AcceptedIssuesStore {
  version: string;
  updatedAt: number;
  accepted: AcceptedIssue[];
}

export interface BusinessRiskSummary {
  businessPrefix: string;
  description: string;
  owner?: string;
  totalKeys: number;
  issues: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  exampleKeys: string[];
  suggestedAction: string;
}

export interface AuditReport {
  generatedAt: number;
  totalKeysScanned: number;
  uniqueKeys: number;
  duplicateKeys: number;
  isCompleteSnapshot: boolean;
  issues: KeyIssue[];
  expiredAcceptances: AcceptedIssue[];
  businessSummaries: BusinessRiskSummary[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    accepted: number;
  };
}

export interface KeyExplanation {
  key: string;
  matchedPrefix: string;
  currentTTL: number | null;
  assignedPolicy?: TTLPolicy;
  issues: KeyIssue[];
  isTemporary: boolean;
  acceptanceStatus?: AcceptedIssue;
}
