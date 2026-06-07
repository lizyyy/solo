export type ProcessingStatus = 
  | 'imported'          
  | 'audio_remark_added' 
  | 'rework_detected'     
  | 'pending_review'      
  | 'reviewed_normal'     
  | 'reviewed_rework'     
  | 'rehearsal_updated'   
  | 'finalized';          

export type TrackRemarkType = 
  | 'normal'      
  | 'rework'       
  | 'supplementary'; 

export interface TicketRowRaw {
  originalRowNumber: number;
  rawData: Record<string, string>;
}

export interface ManualChange {
  changedAt: string;
  changedBy: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  reason: string;
}

export interface TrackRemark {
  id: string;
  trackId: string;
  type: TrackRemarkType;
  content: string;
  addedBy: string;
  addedAt: string;
  isReworkReason: boolean;
  retainedBy?: string;
  retainReason?: string;
}

export interface RehearsalChange {
  id: string;
  trackId: string;
  changeType: 'time' | 'location' | 'personnel' | 'other';
  oldValue: string;
  newValue: string;
  changedBy: string;
  changedAt: string;
  reason: string;
  relatedRemarkId?: string;
}

export interface TicketRow {
  id: string;
  importBatchId: string;
  originalRowNumber: number;
  rawData: Record<string, string>;
  manualChanges: ManualChange[];
  processingStatus: ProcessingStatus;
  studentName: string;
  instrument: string;
  trackId: string;
  currentClass?: string;
  trackRemarks: TrackRemark[];
  rehearsalChanges: RehearsalChange[];
  audioFileRemark?: string;
  audioRemarkAddedBy?: string;
  audioRemarkAddedAt?: string;
  importedAt: string;
  importedBy: string;
  lastUpdatedAt: string;
  lastUpdatedBy: string;
}

export interface ImportBatch {
  id: string;
  fileName: string;
  importedAt: string;
  importedBy: string;
  rowCount: number;
  duplicateCount: number;
  fileHash: string;
}

export interface SelfCheckResult {
  checkName: string;
  passed: boolean;
  message: string;
  details?: any;
}

export interface ClassificationResult {
  trackId: string;
  className: string;
  confidence: number;
  basedOn: string[];
}
