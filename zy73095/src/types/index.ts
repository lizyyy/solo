export type MaterialSource = 'cad_old' | 'note_added' | 'note_oral';

export type ConclusionStatus = 'passed' | 'pending' | 'rejected';

export interface Material {
  id: string;
  source: MaterialSource;
  title: string;
  content: string;
  recordedAt: string;
  operator: string;
  affectsConclusion: boolean;
}

export interface Zone {
  id: string;
  name: string;
  position: [number, number, number];
  size: [number, number, number];
  status: ConclusionStatus;
  materials: Material[];
  versionTags: string[];
  floor: number;
}

export interface VersionNode {
  tag: string;
  label: string;
  releasedAt: string;
  note: string;
  zonesWithDelta: string[];
  coordinateOffset: number;
  missingMaterials: string[];
}

export interface HistoryEvent {
  id: string;
  at: string;
  zoneId: string;
  oldConclusion: ConclusionStatus;
  newConclusion: ConclusionStatus;
  oldMaterialsSnapshot: Material[];
  newNote: string;
  reason: string;
  operator: string;
  relatedVersionTag: string;
}

export interface PageSummary {
  currentVersion: string;
  totalZones: number;
  reviewedCount: number;
  pendingCount: number;
  rejectedCount: number;
  overallConclusion: '通过' | '待定' | '驳回';
  keyInfluencingMaterials: { source: MaterialSource; count: number }[];
  hasCoordinateOffset: boolean;
  offsetMm: number;
}

export type SourceFilterSet = Record<MaterialSource, boolean>;

export const SOURCE_LABELS: Record<MaterialSource, string> = {
  cad_old: 'CAD 图层旧版',
  note_added: '后补备注',
  note_oral: '口头备注',
};

export const SOURCE_COLORS: Record<MaterialSource, string> = {
  cad_old: '#6366F1',
  note_added: '#059669',
  note_oral: '#D97706',
};

export const STATUS_COLORS: Record<ConclusionStatus, string> = {
  passed: '#15803D',
  pending: '#EA580C',
  rejected: '#DC2626',
};

export const STATUS_LABELS: Record<ConclusionStatus, string> = {
  passed: '通过',
  pending: '待定',
  rejected: '驳回',
};
