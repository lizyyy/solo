export type RecordStatus = 'normal' | 'over_threshold' | 'supplemented' | 'pending_review' | 'conflict';

export type ConflictResolutionStatus = 'pending' | 'accept_photo' | 'accept_note' | 'rejected';

export type ThresholdReviewStatus = 'pending_review' | 'confirmed' | 'needs_recalibration' | 'rejected';

export type ReviewStatus = ThresholdReviewStatus;

export type OperationType = 'import_photo' | 'review_note' | 'unit_conversion' | 'data_cleaning' | 'conflict_resolution' | 'threshold_review';

export type MaterialType = 'normal' | 'wrong_caliber' | 'supplemented';

export interface StrainRecord {
  id: string;
  materialType: MaterialType;
  materialName: string;
  originalValue: number;
  originalUnit: string;
  cleanedValue: number;
  cleanedUnit: string;
  recordStatus: RecordStatus;
  evidenceSources: ('photo' | 'note')[];
  caliberSource: string;
  createTime: string;
  updateTime: string;
  description: string;
}

export interface PhotoEvidence {
  id: string;
  recordId: string;
  imageUrl: string;
  extractedValue: number;
  extractedUnit: string;
  captureTime: string;
  deviceInfo: string;
  location: string;
}

export interface NoteEvidence {
  id: string;
  recordId: string;
  handwrittenImageUrl: string;
  transcribedText: string;
  notedValue: number;
  notedUnit: string;
  inspectorName: string;
  noteTime: string;
  location: string;
}

export interface UnitConversion {
  id: string;
  recordId: string;
  fromUnit: string;
  toUnit: string;
  conversionFactor: number;
  caliberVersion: string;
  effectiveDate: string;
  historyReference: string;
  description: string;
}

export interface EvidenceConflict {
  id: string;
  recordId: string;
  conflictType: 'value_mismatch' | 'unit_mismatch' | 'caliber_mismatch';
  photoEvidenceId: string;
  noteEvidenceId: string;
  photoEvidence: string;
  noteEvidence: string;
  impactDescription: string;
  resolutionStatus: ConflictResolutionStatus;
  resolvedBy?: string;
  resolutionTime?: string;
  resolutionNote?: string;
}

export interface ThresholdAlert {
  id: string;
  recordId: string;
  originalValue: number;
  originalUnit: string;
  threshold: number;
  cleanedValue: number;
  cleanedUnit: string;
  deviationRate: number;
  neighborIndices: number[];
  reviewStatus: ThresholdReviewStatus;
  reviewedBy?: string;
  reviewComment?: string;
  reviewTime?: string;
}

export interface EvidenceChainNode {
  id: string;
  recordId: string;
  operationType: OperationType;
  description: string;
  operateTime: string;
  operator: string;
  evidenceRefs: string[];
}

export interface CaliberHistory {
  version: string;
  effectiveDate: string;
  conversionFactor: number;
  fromUnit: string;
  toUnit: string;
  description: string;
  operator: string;
}

export interface SampleRecord {
  id: string;
  type: 'normal' | 'over_threshold' | 'supplemented';
  title: string;
  description: string;
  record: StrainRecord;
  unitConversion?: {
    formula: string;
    caliberVersion: string;
    historyMatch?: boolean;
    historyMismatch?: string;
  };
  processingSteps: {
    title: string;
    description: string;
    type: 'photo' | 'note' | 'conversion';
  }[];
  conclusion: string;
}

export interface CleaningStore {
  records: StrainRecord[];
  photoEvidences: PhotoEvidence[];
  noteEvidences: NoteEvidence[];
  unitConversions: UnitConversion[];
  conflicts: EvidenceConflict[];
  thresholdAlerts: ThresholdAlert[];
  evidenceChain: EvidenceChainNode[];
  caliberHistory: CaliberHistory[];
  workflowStep: number;
  selectedRecordId: string | null;
}

export interface CleaningActions {
  setSelectedRecord: (id: string | null) => void;
  setWorkflowStep: (step: number) => void;
  addPhotoEvidence: (evidence: Omit<PhotoEvidence, 'id'>) => void;
  addNoteEvidence: (evidence: Omit<NoteEvidence, 'id'>) => void;
  resolveConflict: (conflictId: string, status: ConflictResolutionStatus, resolvedBy: string, note?: string) => void;
  reviewThresholdAlert: (alertId: string, status: ThresholdReviewStatus, reviewedBy: string, comment?: string) => void;
  updateRecordCaliber: (recordId: string, conversion: UnitConversion) => void;
  addEvidenceChainNode: (node: Omit<EvidenceChainNode, 'id'>) => void;
  resetAllData: () => void;
}

export type StoreType = CleaningStore & CleaningActions;
