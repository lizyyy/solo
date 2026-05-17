export interface ServiceEntry {
  id: string;
  name: string;
  repoUrl?: string;
  owners: string[];
  alertRules: string[];
  status: 'active' | 'deprecated' | 'unknown';
  lastUpdated?: string;
  sourceFile: string;
  lineNumber: number;
}

export interface RepoProbeResult {
  serviceId: string;
  repoUrl: string;
  exists: boolean;
  isArchived?: boolean;
  lastCommitDate?: string;
  error?: string;
}

export interface AlertReference {
  ruleId: string;
  serviceName: string;
  isOrphan: boolean;
  sourceFile: string;
  lineNumber: number;
}

export interface OwnerInfo {
  name: string;
  services: string[];
  orphanServices: string[];
}

export interface OrphanEvidence {
  serviceId: string;
  serviceName: string;
  reasons: string[];
  repoCheck?: RepoProbeResult;
  alertReferences: AlertReference[];
}

export interface OrphanReport {
  generatedAt: string;
  totalServices: number;
  orphanServices: OrphanEvidence[];
  activeServices: number;
  owners: OwnerInfo[];
  errors: ProcessingError[];
  summary: {
    total: number;
    orphanCount: number;
    activeCount: number;
    errorCount: number;
    orphanRate: number;
  };
}

export interface ProcessingError {
  serviceId?: string;
  serviceName?: string;
  sourceFile: string;
  lineNumber?: number;
  errorType: 'parse_error' | 'validation_error' | 'repo_check_error' | 'alert_check_error' | 'unknown';
  message: string;
  rawData?: string;
}

export interface CliOptions {
  inputDir: string;
  outputDir: string;
  configFile?: string;
  format: ('json' | 'markdown' | 'csv' | 'all')[];
  force: boolean;
  verbose: boolean;
  skipRepoCheck: boolean;
  skipAlertCheck: boolean;
  repoTimeout: number;
  githubToken?: string;
}

export interface Config {
  serviceDirectories: string[];
  alertRulePaths: string[];
  repoProbe: {
    enabled: boolean;
    timeout: number;
    githubApiBase?: string;
  };
  orphanCriteria: {
    repoArchived: boolean;
    noCommitSinceDays: number;
    noAlertReferences: boolean;
    inactiveStatus: boolean;
  };
  output: {
    formats: string[];
    timestampPrefix: boolean;
  };
}
