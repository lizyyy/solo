export interface LogEntry {
  timestamp: string;
  orderId?: string;
  tenantId?: string;
  errorCode?: string;
  amount?: number;
  message: string;
  raw: string;
  lineNumber: number;
}

export interface BusinessFieldConfig {
  orderIdFields: string[];
  tenantIdFields: string[];
  errorCodeFields: string[];
  amountFields: string[];
  messageFields: string[];
  timestampFields: string[];
  logPattern: string;
}

export interface ErrorCodeMapping {
  [code: string]: {
    description: string;
    category: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
  };
}

export interface SuppressionRule {
  id: string;
  pattern: string;
  orderIdPattern?: string;
  tenantIdPattern?: string;
  errorCodePattern?: string;
  messagePattern?: string;
  minAmount?: number;
  maxAmount?: number;
  expireAt: string;
  reason: string;
}

export interface AggregatedSample {
  id: string;
  representative: LogEntry;
  count: number;
  uniqueOrderIds: string[];
  tenants: string[];
  errorCode: string;
  errorDescription: string;
  totalAmount: number;
  avgAmount: number;
  firstSeen: string;
  lastSeen: string;
  timeWindow: string;
  isNew: boolean;
  isSuppressed: boolean;
  suppressionReason?: string;
  priority: number;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'unknown';
  duplicateSamples: LogEntry[];
}

export interface SamplingOptions {
  timeWindowMinutes: number;
  minSampleCount: number;
  maxSamples: number;
  sortBy: 'amount' | 'count' | 'priority' | 'time';
  sortOrder: 'asc' | 'desc';
  includeSuppressed: boolean;
}

export interface ScanResult {
  totalEntries: number;
  parsedEntries: number;
  missingOrderId: number;
  missingTenantId: number;
  missingErrorCode: number;
  missingAmount: number;
  negativeAmount: number;
  unknownErrorCodes: string[];
  dateRange: {
    start: string;
    end: string;
  };
}
