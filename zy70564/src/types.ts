export type PatchOperation = 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';

export interface JsonPatch {
  op: PatchOperation;
  path: string;
  value?: any;
  from?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  type: string;
  message: string;
  patchIndex?: number;
  path?: string;
}

export interface ValidationWarning {
  type: string;
  message: string;
  patchIndex?: number;
  path?: string;
}

export interface Conflict {
  type: ConflictType;
  path: string;
  message: string;
  severity: 'error' | 'warning';
  patchIndex?: number;
  existingValue?: any;
  newValue?: any;
}

export type ConflictType = 
  | 'path_not_exists'
  | 'would_overwrite_nested'
  | 'array_index_out_of_bounds'
  | 'test_failure'
  | 'move_source_not_exists'
  | 'copy_source_not_exists'
  | 'duplicate_path'
  | 'patch_application_error';

export interface PatchPreview {
  originalValue: any;
  newValue: any;
  path: string;
  op: PatchOperation;
  changed: boolean;
}

export interface FilePreviewResult {
  filePath: string;
  originalJson: any;
  patches: JsonPatch[];
  patchedJson: any;
  validation: ValidationResult;
  conflicts: Conflict[];
  previews: PatchPreview[];
  diff: DiffEntry[];
  success: boolean;
}

export interface DiffEntry {
  path: string;
  op: 'add' | 'remove' | 'replace';
  oldValue?: any;
  newValue?: any;
}

export interface PreviewReport {
  summary: ReportSummary;
  results: FilePreviewResult[];
  generatedAt: string;
}

export interface ReportSummary {
  totalFiles: number;
  totalPatches: number;
  successCount: number;
  conflictCount: number;
  errorCount: number;
  warningCount: number;
  changedFiles: number;
}
