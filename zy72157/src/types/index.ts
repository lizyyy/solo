export type PointSource = 'GIS' | 'feedback' | 'inspection' | 'street';

export type PointStatus = 'pending' | 'merged' | 'confirmed' | 'rejected';

export type PointType = 'smooth' | 'review' | 'legacy' | 'boundary' | 'duplicate' | 'empty';

export type SuggestionStatus = 'pending' | 'approved' | 'rejected';

export type AuditAction = 'import' | 'merge' | 'confirm' | 'reject' | 'note' | 'split' | 'diff' | 'diffResolve' | 'manualResolve';

export interface AuditRecord {
  id: string;
  action: AuditAction;
  operator: string;
  remark: string;
  timestamp: Date;
}

export interface ManualResolveSnapshot {
  field: string;
  originalValue: string;
  resolvedValue: string;
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
  sourceRow: Record<string, string>;
  fileName: string;
  sourceRowNumber: number;
  createdAt: Date;
  updatedAt: Date;
  feedback?: string;
  photoNotes?: string;
  zhoujieNote?: string;
  originalValues?: Partial<Record<'name' | 'address' | 'type', string>>;
  manualResolveHistory?: ManualResolveSnapshot[];
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

export interface FieldDiff {
  field: 'name' | 'address' | 'lat' | 'lng' | 'source' | 'notes' | string;
  valueA: string;
  valueB: string;
  chosen?: 'A' | 'B' | 'custom';
  customValue?: string;
}

export type DiffStatus = 'pending' | 'resolved' | 'skipped';

export interface DiffRecord {
  id: string;
  pointIds: string[];
  diffFields: FieldDiff[];
  status: DiffStatus;
  resolvedAt?: Date;
  resolvedNote?: string;
  detectedAt: Date;
}

export interface AppState {
  points: MealPoint[];
  suggestions: MergeSuggestion[];
  diffs: DiffRecord[];
  currentStep: 'import' | 'merge' | 'review' | 'diff' | 'export';
}

export interface ColumnMapping {
  name: string;
  address: string;
  lat: string;
  lng: string;
  source: string;
  notes: string;
}

export const SYSTEM_FIELDS: { key: keyof ColumnMapping; label: string; required: boolean }[] = [
  { key: 'name', label: '点位名称', required: true },
  { key: 'address', label: '详细地址', required: true },
  { key: 'lat', label: '纬度', required: false },
  { key: 'lng', label: '经度', required: false },
  { key: 'source', label: '数据来源', required: false },
  { key: 'notes', label: '备注', required: false },
];

export const SOURCE_ALIASES: Record<string, PointSource> = {
  'GIS点位': 'GIS',
  'GIS': 'GIS',
  'gis': 'GIS',
  '居民反馈': 'feedback',
  'feedback': 'feedback',
  '巡检记录': 'inspection',
  'inspection': 'inspection',
  '巡检': 'inspection',
  '街道备注': 'street',
  'street': 'street',
  '街道': 'street',
  '街道手改': 'street',
};

export interface ManualResolveInput {
  name?: string;
  address?: string;
  type?: PointType;
  zhoujieNote?: string;
  feedback?: string;
  photoNotes?: string;
  operationNote?: string;
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
  setCurrentStep: (step: 'import' | 'merge' | 'review' | 'diff' | 'export') => void;
  exportToCSV: () => string;
  detectDiffs: () => void;
  resolveDiff: (diffId: string, resolvedFields: FieldDiff[], note?: string) => void;
  skipDiff: (diffId: string) => void;
  manuallyResolvePoint: (pointId: string, input: ManualResolveInput) => void;
}
