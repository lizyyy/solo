export interface ImportJob {
  id: string
  name: string
  type: 'user' | 'product' | 'order' | 'custom'
  status: 'pending' | 'validating' | 'completed' | 'failed'
  totalRows: number
  successCount: number
  failedCount: number
  skippedCount: number
  createdAt: string
  updatedAt: string
  schemaId: string
  sourceFile?: string
  resultsFile?: string
  reportFile?: string
  errors?: string
}

export interface RowResult {
  id: string
  jobId: string
  rowIndex: number
  status: 'success' | 'failed' | 'skipped'
  data: Record<string, any>
  errors: ValidationError[]
  createdAt: string
  retryCount: number
  lastRetriedAt?: string
}

export interface ValidationError {
  field: string
  rule: string
  message: string
  value?: any
}

export interface ValidationSchema {
  id: string
  name: string
  type: string
  fields: SchemaField[]
  createdAt: string
}

export interface SchemaField {
  name: string
  label: string
  required: boolean
  type: 'string' | 'number' | 'integer' | 'date' | 'email' | 'email' | 'boolean' | 'array' | 'object'
  rules: FieldRule[]
}

export interface FieldRule {
  type: 'minLength' | 'maxLength' | 'min' | 'max' | 'pattern' | 'enum' | 'unique' | 'custom'
  value?: any
  message: string
}

export type FileFormat = 'csv' | 'xlsx' | 'xls'

export interface ImportRequest {
  schemaId: string
  file?: File
  filePath?: string
  format: FileFormat
  options?: {
    delimiter?: string
    hasHeader?: boolean
    sheetName?: string
  }
}

export interface ImportResult {
  job: ImportJob
  rows: RowResult[]
  summary: ImportSummary
}

export interface ImportSummary {
  total: number
  success: number
  failed: number
  failedDetails: ValidationError[]
  errors: string[]
}

export interface RetryRequest {
  jobId: string
  rowIds?: string[]
  overrideData?: Record<string, Record<string, any>>
}

export interface ReportFormat {
  id: string
  jobId: string
  format: 'csv' | 'json' | 'xlsx'
  createdAt: string
  filePath: string
}
