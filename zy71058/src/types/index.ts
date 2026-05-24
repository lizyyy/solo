export interface SecretRule {
  id: string;
  name: string;
  description: string;
  pattern: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'credential' | 'network' | 'config' | 'other';
  examples?: string[];
}

export interface ExceptionItem {
  id: string;
  reason: string;
  path?: string;
  value?: string;
  ruleId?: string;
  expiresAt?: string;
  environment?: string;
  createdAt: string;
  createdBy: string;
}

export interface ScanOptions {
  valuesPath: string;
  templateDir?: string;
  rulesPath?: string;
  environment: string;
  exceptionsPath?: string;
  outputDir: string;
  failOnSeverity: string[];
  verbose: boolean;
}

export interface FindingLocation {
  file: string;
  path: string;
  line?: number;
  column?: number;
}

export interface Finding {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  description: string;
  location: FindingLocation;
  matchedValue: string;
  evidence: string;
  isBase64Encoded?: boolean;
  decodedValue?: string;
  excepted?: boolean;
  exception?: ExceptionItem;
  exceptionExpired?: boolean;
}

export interface ScanResult {
  metadata: {
    scannedAt: string;
    environment: string;
    valuesFile: string;
    templateDir?: string;
    rulesFile?: string;
    exceptionsFile?: string;
  };
  summary: {
    totalFiles: number;
    totalFindings: number;
    bySeverity: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    excepted: number;
    expiredExceptions: number;
  };
  findings: Finding[];
  errors: string[];
  warnings: string[];
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface SelfTestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: Record<string, unknown>;
}
