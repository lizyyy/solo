export type MaterialStatus = 'pending' | 'processed' | 'missing' | 'reviewed';

export type Unit = 'μg' | 'mg' | 'g' | 'kg' | 'mL' | 'L' | '%' | 'unit';

export interface DataPoint {
  id: string;
  x: number;
  y: number;
  label: string;
  source: 'student' | 'reference';
  isBoundary: boolean;
  note?: string;
}

export interface MaterialNameRecord {
  id: string;
  materialId: string;
  name: string;
  timestamp: number;
  operator: string;
  reason?: string;
}

export interface Material {
  id: string;
  currentName: string;
  nameHistory: MaterialNameRecord[];
  unit: Unit;
  dataPoints: DataPoint[];
  status: MaterialStatus;
  draftOriginalText?: string;
  sortNote?: string;
  createdAt: number;
  updatedAt: number;
}

export interface FilterCriteria {
  id: string;
  name: string;
  materialIds: string[];
  dateRange?: { start: number; end: number };
  boundaryThreshold: number;
  boundarySampleMinCount: number;
  fittingDegree: number;
  excludeOutliers: boolean;
  createdAt: number;
  createdBy: string;
}

export interface FittingResult {
  materialId: string;
  coefficients: number[];
  rSquared: number;
  boundaryPoints: DataPoint[];
  boundaryWarning: boolean;
  boundarySampleCount: number;
  predictedAtBoundary: { x: number; y: number }[];
  unstableSort?: {
    unstable: boolean;
    originalDraftText: string;
    suggestedOrder: string[];
  };
}

export interface JumpCause {
  type: 'threshold' | 'unit' | 'name_mismatch';
  description: string;
  detail: string;
  beforeValue?: number;
  afterValue?: number;
  affectedMaterials?: string[];
}

export interface TimelineEvent {
  id: string;
  type: 'import' | 'filter' | 'fit' | 'review' | 'export' | 'handover' | 'rename' | 'status_change';
  timestamp: number;
  operator: string;
  description: string;
  detail?: Record<string, unknown>;
  filterSnapshot?: FilterCriteria;
}

export interface ExportRecord {
  id: string;
  timestamp: number;
  operator: string;
  filterCriteriaId: string;
  dataHash: string;
  onScreenSnapshot: {
    materialCount: number;
    totalPoints: number;
    rSquaredValues: Record<string, number>;
    boundaryWarnings: string[];
  };
  fileName: string;
  summary?: {
    filterId: string;
    filterName: string;
    fittingDegree: number;
    boundarySampleMinCount: number;
    materialCount: number;
    totalPoints: number;
    avgR2: number;
    boundaryWarningCount: number;
    jumpCauseCount: number;
    causeBreakdown: { threshold: number; unit: number; name_mismatch: number };
    statusCounts: { reviewed: number; processed: number; pending: number; missing: number };
    materialIds: string[];
  };
}

export interface HandoverNote {
  materialLocation: string;
  anomalyLocation: string;
  reexportGuide: string;
  remarks?: string;
}

export interface AppState {
  materials: Material[];
  filterCriterias: FilterCriteria[];
  activeFilterId: string | null;
  fittingResults: Record<string, FittingResult>;
  timeline: TimelineEvent[];
  exports: ExportRecord[];
  handoverNote: HandoverNote;
  jumpAnalysis: {
    enabled: boolean;
    previousFitting?: Record<string, FittingResult>;
    causes: JumpCause[];
  };
}
