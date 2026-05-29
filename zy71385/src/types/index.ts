export type RiskLevel = 'low' | 'medium' | 'high' | 'blocker';
export type FlagStatus = 'active' | 'inactive' | 'deprecated' | 'pending_cleanup';
export type MatchType = 'static' | 'dynamic' | 'suspected';
export type Environment = 'dev' | 'staging' | 'production';
export type ImportConflictStrategy = 'skip' | 'overwrite' | 'append';
export type SuggestedAction = 'safe_delete' | 'verify_first' | 'do_not_delete';
export type CleanupAction = 'import' | 'scan' | 'assess' | 'delete' | 'rollback';

export interface FeatureFlag {
  id: string;
  name: string;
  key: string;
  description: string;
  owner: string | null;
  launchDate: string | null;
  createdAt: string;
  updatedAt: string;
  status: FlagStatus;
}

export interface CodeReference {
  id: string;
  flagId: string;
  filePath: string;
  lineNumber: number;
  matchType: MatchType;
  codeSnippet: string;
  confidence: number;
  scanTaskId?: string;
}

export interface EnvironmentStatus {
  id: string;
  flagId: string;
  environment: Environment;
  enabled: boolean;
  value: string;
  grayUsers: number;
  grayPercentage: number;
  lastChecked: string;
}

export interface RiskReason {
  code: string;
  message: string;
  severity: 'warning' | 'error';
  suggestion: string;
}

export interface RiskAssessment {
  id: string;
  flagId: string;
  level: RiskLevel;
  reasons: RiskReason[];
  suggestedAction: SuggestedAction;
  assessedAt: string;
}

export interface CleanupLog {
  id: string;
  flagId: string;
  action: CleanupAction;
  operator: string;
  timestamp: string;
  beforeSnapshot: any;
  afterSnapshot: any;
  note: string;
}

export interface ScanTask {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  config: ScanConfig;
  startedAt: string;
  finishedAt?: string;
  progress: number;
  message?: string;
}

export interface ScanConfig {
  repositoryPath: string;
  excludeDirs: string[];
  dynamicPatterns: string[];
  flagIds?: string[];
}

export interface Report {
  id: string;
  title: string;
  type: 'cleanup' | 'risk' | 'scan';
  generatedAt: string;
  generatedBy: string;
  summary: ReportSummary;
  flagIds: string[];
}

export interface ReportSummary {
  totalFlags: number;
  safeToDelete: number;
  needVerification: number;
  doNotDelete: number;
  blockers: number;
}

export interface RuleConfig {
  id: string;
  ruleKey: string;
  ruleName: string;
  description: string;
  explanation: string;
  value: any;
  enabled: boolean;
  updatedAt: string;
}

export interface ImportConflict {
  flagKey: string;
  existing: FeatureFlag;
  incoming: Partial<FeatureFlag>;
  resolution: ImportConflictStrategy;
}

export interface ImportResult {
  total: number;
  success: number;
  skipped: number;
  overwritten: number;
  appended: number;
  conflicts: ImportConflict[];
}

export interface FlagWithDetails extends FeatureFlag {
  riskLevel?: RiskLevel;
  suggestedAction?: SuggestedAction;
  codeReferences: CodeReference[];
  environmentStatuses: EnvironmentStatus[];
  riskReasons: RiskReason[];
}

export interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface FilterParams {
  riskLevel?: RiskLevel[];
  status?: FlagStatus[];
  owner?: string;
  environment?: Environment;
  hasCodeReferences?: boolean;
  hasGrayUsers?: boolean;
  searchQuery?: string;
}
