export interface ParcelRecord {
  trackingNumber: string;
  recipient: string;
  phone: string;
  pickupTime?: string;
  pickupPerson?: string;
  pickupMethod?: string;
  status: string;
  location: string;
  courier: string;
  notes?: string;
}

export interface ValidationError {
  type: 'missing_column' | 'duplicate' | 'encoding_error' | 'empty_file' | 'parse_error';
  message: string;
  row?: number;
  trackingNumber?: string;
}

export interface AnomalyRecord {
  type: 'family_pickup' | 'label_obscured' | 'rerun_required';
  trackingNumber: string;
  recipient: string;
  details: string;
  suggestion: string;
  severity: 'low' | 'medium' | 'high';
}

export interface ProcessingResult {
  fileName: string;
  success: boolean;
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  anomalies: AnomalyRecord[];
  errors: ValidationError[];
  processedAt: string;
}

export interface SummaryReport {
  totalFiles: number;
  processedFiles: number;
  failedFiles: string[];
  totalRecords: number;
  validRecords: number;
  anomalies: AnomalyRecord[];
  errorsByType: Record<string, number>;
}
