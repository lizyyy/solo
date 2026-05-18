export interface StoreInspection {
  storeId: string;
  storeName: string;
  inspectionDate: string;
  inspector: string;
  items: InspectionItem[];
  photos: PhotoInfo[];
}

export interface InspectionItem {
  itemId: string;
  category: string;
  description: string;
  score: number;
  maxScore: number;
  deductionReason?: string;
  rectificationRequired: boolean;
  rectificationDeadline?: string;
  rectificationStatus?: 'pending' | 'completed' | 'overdue';
  rectificationPhotoId?: string;
}

export interface PhotoInfo {
  photoId: string;
  photoUrl: string;
  uploadTime: string;
  description: string;
  md5Hash: string;
}

export interface ValidationError {
  type: 'photo_reuse' | 'overdue_rectification' | 'invalid_data';
  severity: 'high' | 'medium' | 'low';
  storeId: string;
  storeName: string;
  itemId?: string;
  message: string;
  suggestion: string;
  relatedData?: Record<string, unknown>;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  summary: {
    totalErrors: number;
    photoReuseCount: number;
    overdueCount: number;
    invalidDataCount: number;
  };
}

export interface Report {
  generatedAt: string;
  inspectionCount: number;
  validationResult: ValidationResult;
  sortedInspections: StoreInspection[];
  runId: string;
}
