export interface TemplateManifest {
  name: string;
  version: string;
  files: FileEntry[];
  configs: ConfigEntry[];
}

export interface FileEntry {
  path: string;
  required: boolean;
  checkContent?: boolean;
  ignorePatterns?: string[];
}

export interface ConfigEntry {
  path: string;
  type: 'json' | 'yaml' | 'env' | 'text';
  keys?: string[];
  required: boolean;
}

export type DriftStatus = 'normal' | 'risk' | 'unknown';

export type DriftType = 
  | 'file_missing'
  | 'file_extra'
  | 'content_diff'
  | 'config_missing_key'
  | 'config_value_diff'
  | 'config_extra_key'
  | 'parse_error'
  | 'permission_denied';

export interface DriftItem {
  id: string;
  type: DriftType;
  path: string;
  status: DriftStatus;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  reason?: string;
  diff?: DiffChunk[];
  expected?: string;
  actual?: string;
}

export interface DiffChunk {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  lineStart?: number;
  lineEnd?: number;
}

export interface FileCheckResult {
  path: string;
  exists: boolean;
  required: boolean;
  contentMatch?: boolean;
  drifts: DriftItem[];
}

export interface ConfigCheckResult {
  path: string;
  exists: boolean;
  required: boolean;
  parsed: boolean;
  drifts: DriftItem[];
}

export interface DriftReport {
  metadata: {
    timestamp: string;
    repoPath: string;
    templatePath: string;
    templateName: string;
    templateVersion: string;
    runId: string;
  };
  summary: {
    totalFiles: number;
    totalConfigs: number;
    normalItems: number;
    riskItems: number;
    unknownItems: number;
    totalDrifts: number;
    criticalDrifts: number;
    highDrifts: number;
    mediumDrifts: number;
    lowDrifts: number;
  };
  files: FileCheckResult[];
  configs: ConfigCheckResult[];
  drifts: DriftItem[];
  repairPreview: RepairPreview[];
}

export interface RepairPreview {
  driftId: string;
  path: string;
  action: 'create' | 'delete' | 'modify';
  description: string;
  preview: string;
  autoFixable: boolean;
}

export interface CliOptions {
  repo: string;
  template: string;
  output: string;
  format: 'json' | 'markdown' | 'both';
  detail: boolean;
  preview: boolean;
}
