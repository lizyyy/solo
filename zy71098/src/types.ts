export enum BounceCategory {
  MAILBOX_NOT_EXIST = 'mailbox_not_exist',
  POLICY_REJECTION = 'policy_rejection',
  CONTENT_BLOCKED = 'content_blocked',
  TEMPORARY_FAILURE = 'temporary_failure',
  UNKNOWN = 'unknown'
}

export const BounceCategoryLabels: Record<BounceCategory, string> = {
  [BounceCategory.MAILBOX_NOT_EXIST]: '邮箱不存在',
  [BounceCategory.POLICY_REJECTION]: '策略拒收',
  [BounceCategory.CONTENT_BLOCKED]: '内容被拦',
  [BounceCategory.TEMPORARY_FAILURE]: '临时失败',
  [BounceCategory.UNKNOWN]: '未知原因'
};

export interface BounceRecord {
  id: string;
  recipient: string;
  smtpCode?: string;
  enhancedCode?: string;
  provider?: string;
  batchId?: string;
  rawMessage: string;
  subject?: string;
  timestamp: number;
  category: BounceCategory;
  confidence: number;
  reason: string;
  retrySuggestion: RetrySuggestion;
}

export interface RetrySuggestion {
  shouldRetry: boolean;
  retryAfterHours?: number;
  maxRetries: number;
  reason: string;
}

export interface BatchAggregation {
  batchId: string;
  totalBounces: number;
  categoryBreakdown: Record<BounceCategory, number>;
  uniqueRecipients: number;
  repeatedBounces: Array<{
    recipient: string;
    count: number;
    firstBounce: number;
    lastBounce: number;
    categories: BounceCategory[];
  }>;
  providerBreakdown: Record<string, number>;
  retryEligibleCount: number;
}

export interface AnalysisReport {
  generatedAt: number;
  totalRecords: number;
  uniqueRecipients: number;
  batches: Record<string, BatchAggregation>;
  overallBreakdown: Record<BounceCategory, number>;
  topReasons: Array<{ reason: string; count: number; category: BounceCategory }>;
  summary: {
    hardBounceRate: number;
    policyRejectionRate: number;
    contentBlockRate: number;
    temporaryFailureRate: number;
  };
  recommendations: string[];
}

export interface CliOptions {
  input?: string;
  inputDir?: string;
  recipient?: string;
  smtpCode?: string;
  provider?: string;
  batchId?: string;
  outputDir: string;
  format: string[];
  config?: string;
  verbose: boolean;
}

export interface ProviderPattern {
  name: string;
  patterns: string[];
  smtpPatterns: string[];
  mailboxNotExist: string[];
  policyRejection: string[];
  contentBlocked: string[];
  temporaryFailure: string[];
}

export interface AppConfig {
  providers: ProviderPattern[];
  output: {
    defaultDir: string;
    formats: string[];
  };
  retry: {
    temporaryFailureHours: number;
    maxRetries: number;
    policyRetryHours: number;
  };
}
