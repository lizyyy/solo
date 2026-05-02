export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface TimestampRange {
  start: string;
  end: string;
}

export enum CheckStatus {
  PASS = 'pass',
  WARN = 'warn',
  BLOCK = 'block',
}

export interface RuleCheckResult {
  ruleId: string;
  ruleName: string;
  status: CheckStatus;
  message: string;
  details?: Record<string, unknown>;
}

export interface OverallCheckResult {
  scheduleId: string;
  overallStatus: CheckStatus;
  checks: RuleCheckResult[];
  checkedAt: string;
}
