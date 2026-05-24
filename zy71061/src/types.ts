export type DataSourceType = 'config' | 'terraform' | 'platform';

export type RetentionUnit = 'days' | 'day' | 'weeks' | 'week' | 'months' | 'month' | 'years' | 'year' | 'd' | 'w' | 'm' | 'y';

export type DiffSeverity = 'critical' | 'warning' | 'info';

export interface ServiceRetention {
  serviceName: string;
  retentionDays: number;
  source: DataSourceType;
  rawValue: string;
  aliases?: string[];
}

export interface RawRetentionConfig {
  defaults?: {
    retention: string | number;
  };
  services?: Array<{
    name: string;
    retention: string | number;
    aliases?: string[];
  }>;
}

export interface TerraformOutput {
  log_retention?: {
    [serviceName: string]: string | number;
  };
}

export interface PlatformExport {
  services?: Array<{
    name: string;
    log_retention_days?: number;
    log_retention?: string;
  }>;
}

export interface NormalizedService {
  canonicalName: string;
  aliases: string[];
  sources: {
    [key in DataSourceType]?: {
      retentionDays: number;
      rawValue: string;
    };
  };
}

export interface ServiceDiff {
  canonicalName: string;
  aliases: string[];
  sources: {
    [key in DataSourceType]?: number;
  };
  differences: SourceDifference[];
  maxDiffDays: number;
  severity: DiffSeverity;
  consistencyScore: number;
}

export interface SourceDifference {
  sourceA: DataSourceType;
  sourceB: DataSourceType;
  valueA: number;
  valueB: number;
  diffDays: number;
  diffPercentage: number;
  severity: DiffSeverity;
}

export interface DiffReport {
  generatedAt: string;
  summary: {
    totalServices: number;
    consistentServices: number;
    inconsistentServices: number;
    criticalIssues: number;
    warningIssues: number;
    infoIssues: number;
    overallConsistencyScore: number;
  };
  services: ServiceDiff[];
  sources: {
    type: DataSourceType;
    serviceCount: number;
  }[];
  config: {
    outputDir: string;
    sources: string[];
    severityThresholds: SeverityThresholds;
  };
}

export interface SeverityThresholds {
  critical: number;
  warning: number;
}

export interface CLIOptions {
  config?: string;
  terraform?: string;
  platform?: string;
  outputDir: string;
  name: string;
  format: string[];
  criticalThreshold?: string;
  warningThreshold?: string;
  thresholds?: {
    critical: number;
    warning: number;
  };
  service?: string;
  aliasMap?: string;
  quiet: boolean;
  verbose: boolean;
}

export const UNIT_CONVERSIONS: { [key in RetentionUnit]: number } = {
  days: 1,
  day: 1,
  d: 1,
  weeks: 7,
  week: 7,
  w: 7,
  months: 30,
  month: 30,
  m: 30,
  years: 365,
  year: 365,
  y: 365,
};
