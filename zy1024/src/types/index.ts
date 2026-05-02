export type RiskLevel = 'critical' | 'high' | 'medium' | 'low';

export type BlockingLevel = 'required' | 'recommended' | 'optional';

export interface GitChange {
  filePath: string;
  oldFilePath?: string;
  changeType: 'added' | 'modified' | 'deleted' | 'renamed' | 'copied';
  isBinary: boolean;
  diffContent?: string;
  insertions: number;
  deletions: number;
}

export interface Rule {
  id: string;
  name: string;
  description?: string;
  paths?: string[];
  fileTypes?: string[];
  keywords?: string[];
  modules?: string[];
  owners?: string[];
  riskLevel: RiskLevel;
  blockingLevel: BlockingLevel;
  checkCommands: string[];
  confirmations?: string[];
}

export interface ModuleConfig {
  name: string;
  paths: string[];
  owners: string[];
  defaultCheckCommands: string[];
  riskLevel?: RiskLevel;
}

export interface ReleaseScopeConfig {
  version: '1.0';
  projectName: string;
  modules: ModuleConfig[];
  rules: Rule[];
  globalCheckCommands?: string[];
  defaultRiskLevel?: RiskLevel;
}

export interface MatchedRule {
  rule: Rule;
  matchedBy: {
    path?: boolean;
    fileType?: boolean;
    keyword?: boolean;
    module?: boolean;
  };
  matchedKeyword?: string;
}

export interface FileAnalysis {
  change: GitChange;
  module: string | null;
  owners: string[];
  riskLevel: RiskLevel;
  matchedRules: MatchedRule[];
  checkCommands: string[];
  confirmations: string[];
  score: number;
}

export interface GroupedAnalysis {
  byModule: Map<string, FileAnalysis[]>;
  byOwner: Map<string, FileAnalysis[]>;
  byRiskLevel: Map<RiskLevel, FileAnalysis[]>;
}

export interface ImpactReport {
  projectName: string;
  generatedAt: string;
  scope: {
    fromRef: string | null;
    toRef: string | null;
    isWorkingDir: boolean;
  };
  summary: {
    totalFiles: number;
    criticalFiles: number;
    highRiskFiles: number;
    mediumRiskFiles: number;
    lowRiskFiles: number;
    totalInsertions: number;
    totalDeletions: number;
  };
  grouped: GroupedAnalysis;
  allCheckCommands: string[];
  allConfirmations: string[];
  files: FileAnalysis[];
}

export interface ScanOptions {
  projectDir: string;
  configPath?: string;
  fromRef?: string;
  toRef?: string;
  useSampleData?: boolean;
  sampleKey?: string;
}

export interface ExportOptions extends ScanOptions {
  outputPath: string;
  format: 'json' | 'markdown';
}
