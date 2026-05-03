export type ConflictStrategy = 'rename' | 'skip' | 'error';
export type OperationType = 'move' | 'copy';
export type ReportFormat = 'json' | 'markdown' | 'html';

export interface RuleCondition {
  extensions?: string[];
  keywords?: string[];
  minSize?: number;
  maxSize?: number;
  modifiedAfter?: string;
  modifiedBefore?: string;
  createdAfter?: string;
  createdBefore?: string;
}

export interface Rule {
  name: string;
  condition: RuleCondition;
  destination: string;
  description?: string;
  priority?: number;
}

export interface RulesConfig {
  version: string;
  rules: Rule[];
  defaultConflictStrategy?: ConflictStrategy;
  defaultOperation?: OperationType;
  excludePatterns?: string[];
}

export interface FileInfo {
  path: string;
  name: string;
  extension: string;
  size: number;
  modifiedAt: Date;
  createdAt: Date;
  hash?: string;
}

export interface MatchedFile extends FileInfo {
  ruleName: string;
  rule: Rule;
  destinationPath: string;
}

export interface ConflictInfo {
  originalPath: string;
  targetPath: string;
  existingFile: FileInfo;
  strategy: ConflictStrategy;
  resolvedPath?: string;
  resolved: boolean;
}

export interface DuplicateFileGroup {
  hash: string;
  files: string[];
}

export interface ManifestEntry {
  originalPath: string;
  newPath: string;
  operationType: OperationType;
  timestamp: string;
  fileSize: number;
  hash: string;
  ruleName: string;
  conflictInfo?: ConflictInfo;
  status: 'success' | 'failed' | 'skipped';
  errorMessage?: string;
}

export interface Manifest {
  id: string;
  timestamp: string;
  sourceDirectory: string;
  entries: ManifestEntry[];
  operationType: OperationType;
  totalFiles: number;
}

export interface ScanResult {
  totalFiles: number;
  matchedFiles: MatchedFile[];
  unmatchedFiles: FileInfo[];
  duplicateFiles: DuplicateFileGroup[];
  potentialConflicts: ConflictInfo[];
}

export interface ExecutionResult extends ScanResult {
  manifest?: Manifest;
  successfulOperations: number;
  failedOperations: number;
  skippedOperations: number;
  errors: string[];
}

export interface UndoResult {
  manifestId: string;
  totalEntries: number;
  successfulRestores: number;
  failedRestores: number;
  skippedRestores: number;
  errors: string[];
  restoredFiles: { original: string; current: string }[];
}

export interface ReportData {
  manifest?: Manifest;
  scanResult?: ScanResult;
  executionResult?: ExecutionResult;
  undoResult?: UndoResult;
  timestamp: string;
  type: 'scan' | 'execution' | 'undo';
}

export interface RuleValidationError {
  field: string;
  message: string;
  ruleIndex?: number;
  ruleName?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: RuleValidationError[];
}

export interface ArchiveOptions {
  dryRun: boolean;
  operation: OperationType;
  conflictStrategy: ConflictStrategy;
  outputManifest?: string;
  calculateHash: boolean;
  verbose: boolean;
}

export interface ScanOptions {
  calculateHash: boolean;
  verbose: boolean;
}
