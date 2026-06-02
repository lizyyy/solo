export type PointSource = 'GIS' | 'feedback' | 'inspection' | 'street';

export type PointStatus = 'pending' | 'merged' | 'confirmed' | 'rejected';

export type PointType = 'smooth' | 'review' | 'legacy' | 'boundary' | 'duplicate' | 'empty';

export type SuggestionStatus = 'pending' | 'approved' | 'rejected';

export type AuditAction = 'import' | 'merge' | 'confirm' | 'reject' | 'note' | 'split';

export interface AuditRecord {
  id: string;
  action: AuditAction;
  operator: string;
  remark: string;
  timestamp: Date;
}

export interface MealPoint {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  source: PointSource;
  status: PointStatus;
  type: PointType;
  mergeHistory: string[];
  notes: string;
  auditTrail: AuditRecord[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SimilarityBreakdown {
  address: number;
  name: number;
  distance: number;
}

export interface MergeSuggestion {
  id: string;
  pointId1: string;
  pointId2: string;
  similarityScore: number;
  similarityBreakdown: SimilarityBreakdown;
  reason: string;
  status: SuggestionStatus;
  suggestedAt: Date;
}

export interface AppState {
  points: MealPoint[];
  suggestions: MergeSuggestion[];
  currentStep: 'import' | 'merge' | 'review' | 'export';
}

export interface AppContextType extends AppState {
  addPoints: (points: MealPoint[]) => void;
  approveSuggestion: (suggestionId: string) => void;
  rejectSuggestion: (suggestionId: string, reason: string) => void;
  confirmPoint: (pointId: string, note?: string) => void;
  rejectPoint: (pointId: string, reason: string) => void;
  addNoteToPoint: (pointId: string, note: string) => void;
  generateSuggestions: () => void;
  loadSampleData: () => void;
  clearAllData: () => void;
  setCurrentStep: (step: 'import' | 'merge' | 'review' | 'export') => void;
  exportToCSV: () => string;
}
