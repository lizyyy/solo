export interface MedicalReport {
  id: string;
  employeeId: string;
  name: string;
  department: string;
  examinationDate: string;
  reportStatus: 'pending' | 'completed' | 'withdrawn';
  distributionStatus: 'pending' | 'distributed' | 'failed';
  phone?: string;
  email?: string;
  clinicName: string;
  reportType: '普通体检' | '入职体检' | '年度体检' | '健康证';
  items: string[];
  sourceFile: string;
  processedAt: string;
}

export interface ParseError {
  file: string;
  rowNumber?: number;
  errorType: 'format_error' | 'missing_field' | 'invalid_data' | 'duplicate' | 'parse_failed';
  message: string;
  rawData?: string;
}

export interface DuplicateEmployee {
  name: string;
  count: number;
  records: {
    employeeId: string;
    department: string;
    sourceFile: string;
  }[];
}

export interface WithdrawnRecord {
  employeeId: string;
  name: string;
  department: string;
  withdrawnDate: string;
  reason?: string;
  sourceFile: string;
}

export interface Statistics {
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  totalRecords: number;
  validRecords: number;
  duplicateEmployees: DuplicateEmployee[];
  withdrawnRecords: WithdrawnRecord[];
  formatErrors: ParseError[];
  skippedRecords: number;
  distributedRecords: number;
}

export interface ProcessResult {
  success: boolean;
  statistics: Statistics;
  outputFiles: {
    distribution: string;
    errors: string;
    duplicates: string;
    withdrawn: string;
    summary: string;
  };
}

export interface ProcessedRecord {
  recordId: string;
  fileHash: string;
  processedAt: string;
}

export interface RunState {
  lastRun: string;
  processedFiles: string[];
  processedRecords: ProcessedRecord[];
}
