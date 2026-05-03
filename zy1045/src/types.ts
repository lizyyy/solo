export type FieldType = 
  | 'phone' 
  | 'email' 
  | 'address' 
  | 'name' 
  | 'order_number' 
  | 'ticket_number'
  | 'free_text';

export interface FieldMapping {
  [field: string]: {
    type: FieldType;
    format?: string;
  };
}

export interface FileConfig {
  path: string;
  type: 'csv' | 'json';
  fields: FieldMapping;
  ignoreFields?: string[];
  keyField?: string;
  jsonPath?: string;
}

export interface MaskerConfig {
  version: string;
  salt: string;
  outputDir: string;
  dryRun: boolean;
  files: FileConfig[];
  globalIgnoreFields?: string[];
  preserveOriginalFilenames?: boolean;
  outputFormat?: 'csv' | 'json';
}

export interface MappingRecord {
  original: string;
  masked: string;
  type: FieldType;
  occurrences: number;
  files: string[];
}

export interface ConsistencyMap {
  [type: string]: {
    [original: string]: string;
  };
}

export interface FileProcessingResult {
  filePath: string;
  outputPath: string;
  totalRecords: number;
  maskedFields: {
    [field: string]: number;
  };
  errors: string[];
  warnings: string[];
}

export interface RiskItem {
  level: 'high' | 'medium' | 'low';
  category: string;
  message: string;
  file?: string;
  field?: string;
  suggestion?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  risks: RiskItem[];
}

export interface MaskingSummary {
  timestamp: string;
  configFile: string;
  salt: string;
  dryRun: boolean;
  totalFiles: number;
  totalRecords: number;
  totalMaskedFields: number;
  files: FileProcessingResult[];
  mappingStats: {
    [type: string]: number;
  };
}

export interface ReportOptions {
  format: 'markdown' | 'json';
  outputPath?: string;
  includeMappingDetails?: boolean;
}
