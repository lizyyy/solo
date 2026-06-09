export type SchemeId = 'A' | 'B' | 'C';

export type RecordStatus = 'confirmed' | 'pending' | 'returned';

export type AnomalyType = 'collision_duplicate' | 'remark_conflict' | 'remark_missing';

export interface FireZone {
  id: string;
  floor: number;
  name: string;
  position: [number, number, number];
  size: [number, number, number];
  color: Record<SchemeId, string>;
}

export interface RemarksTriple {
  bimOriginal: string | null;
  supplementary: string | null;
  verbal: string | null;
  lastModified: string;
  hasConflict: boolean;
  conflictFields?: ('area' | 'material' | 'height' | 'other')[];
  diffHighlights?: string[];
}

export interface ReviewRecord {
  id: string;
  zoneId: string;
  schemeId: SchemeId;
  versionAt: string;
  remarks: RemarksTriple;
  status: RecordStatus;
  fileConclusion: string;
  anomalyIds: string[];
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface AnomalyItem {
  id: string;
  type: AnomalyType;
  zoneId: string;
  schemeId: SchemeId;
  description: string;
  detail: string;
  createdAt: string;
  resolved: boolean;
  duplicateCount?: number;
}

export interface TimelineNode {
  date: string;
  label: string;
  schemeId: SchemeId;
  index: number;
}
