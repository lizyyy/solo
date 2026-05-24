export interface CliOptions {
  dist: string;
  sourcemap?: string;
  js?: string;
  publicPath: string;
  exceptions: string;
  output: string;
  failOnLeak: boolean;
  verbose: boolean;
  quiet: boolean;
}

export interface ExceptionRule {
  path: string;
  reason: string;
  expiresAt?: string;
  createdAt: string;
  createdBy: string;
}

export interface SourcemapReference {
  type: 'comment' | 'hidden' | 'url' | 'inline';
  value: string;
  line: number;
  column: number;
  raw: string;
}

export interface LeakIssue {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: 'sourcemap_file' | 'sourcemap_reference' | 'hidden_sourcemap' | 'publicly_accessible' | 'expired_exception';
  file: string;
  line?: number;
  column?: number;
  message: string;
  details: {
    reference?: SourcemapReference;
    publicUrl?: string;
    exception?: ExceptionRule;
    suggestedFix: string;
  };
}

export interface FileScanResult {
  filePath: string;
  fileType: 'js' | 'map' | 'other';
  references: SourcemapReference[];
  issues: LeakIssue[];
  isExcluded: boolean;
  exceptionRule?: ExceptionRule;
}

export interface ScanSummary {
  totalFiles: number;
  scannedFiles: number;
  excludedFiles: number;
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  expiredExceptions: number;
  scanDuration: number;
  scanTimestamp: string;
}

export interface ScanReport {
  metadata: {
    version: string;
    timestamp: string;
    cliOptions: Partial<CliOptions>;
  };
  summary: ScanSummary;
  results: FileScanResult[];
  issues: LeakIssue[];
  exceptions: {
    active: ExceptionRule[];
    expired: ExceptionRule[];
  };
}

export const EXIT_CODES = {
  SUCCESS: 0,
  LEAKS_FOUND: 1,
  INVALID_OPTIONS: 2,
  SCAN_ERROR: 3,
  EXPIRED_EXCEPTIONS: 4,
} as const;

export type ExitCode = typeof EXIT_CODES[keyof typeof EXIT_CODES];
