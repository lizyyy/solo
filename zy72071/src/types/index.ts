export type AnomalyType = 'coordinate_offset' | 'duplicate_name' | 'missing_photo' | 'cross_floor';

export interface CoordinateSystem {
  id: string;
  name: string;
  color: string;
  offset: { x: number; y: number; z: number };
}

export interface Anomaly {
  id: string;
  pointId: string;
  type: AnomalyType;
  description: string;
  relatedPointId?: string;
  originalPosition?: { x: number; y: number; z: number };
}

export interface Point {
  id: string;
  name: string;
  deviceId: string;
  position: { x: number; y: number; z: number };
  coordinateSystemId: string;
  floor: number;
  hasPhoto: boolean;
  photoUrl?: string;
  originalData: Record<string, unknown>;
  anomalies: Anomaly[];
  reviewNote?: string;
}

export type JudgmentAction = 'import' | 'auto_detect' | 'manual_judge' | 'supplement_note' | 'import_success' | 'import_fail' | 'export' | 'review_verify' | 'handover';

export interface JudgmentTrace {
  id: string;
  pointId?: string;
  action: JudgmentAction;
  operator: string;
  timestamp: string;
  remark: string;
  diff?: string;
}

export interface ReviewNote {
  id: string;
  projectId: string;
  pointId?: string;
  content: string;
  operator: string;
  createdAt: string;
  isSupplementary: boolean;
  originalContent?: string;
}

export interface ImportRecord {
  id: string;
  filename: string;
  importedAt: string;
  operator: string;
  success: boolean;
  errorMessage?: string;
  sourceOrigin: string;
}

export interface HandoverRecord {
  id: string;
  handedOverBy: string;
  receivedBy: string;
  handedOverAt: string;
  remarks: string;
  keyDecisionsSummary: string;
}

export interface Project {
  id: string;
  name: string;
  source: string;
  createdAt: string;
  updatedAt: string;
  operator: string;
  status: 'draft' | 'completed';
  coordinateSystems: CoordinateSystem[];
  points: Point[];
  judgmentTraces: JudgmentTrace[];
  reviewNotes: ReviewNote[];
  importRecords: ImportRecord[];
  handoverRecords: HandoverRecord[];
}

export interface AnomalyStats {
  coordinate_offset: number;
  duplicate_name: number;
  missing_photo: number;
  cross_floor: number;
  total: number;
}
