export type RecordStatus = 
  | 'pending'      
  | 'approved'     
  | 'rejected'     
  | 'withdrawn'    
  | 'disputed'     
  | 'completed';

export type RecordSource = 
  | 'approval_screenshot' 
  | 'review_daily'        
  | 'manual_entry'        
  | 'batch_import';

export interface GuaranteeRecord {
  id: number;
  guaranteeNo: string;
  customerName: string;
  amount: number;
  currency: string;
  source: RecordSource;
  sourceRef?: string;
  status: RecordStatus;
  pendingReason?: string;
  reviewReason?: string;
  currentOperator: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  isDuplicate: boolean;
  duplicateWith?: number;
  remark?: string;
}

export interface OperationLog {
  id: number;
  recordId: number;
  operation: string;
  operator: string;
  oldStatus?: RecordStatus;
  newStatus?: RecordStatus;
  changes: string;
  reason?: string;
  createdAt: string;
}

export interface ImportResult {
  success: number;
  duplicates: number;
  errors: number;
  errorDetails: string[];
  importedIds: number[];
  duplicateIds: number[];
}
