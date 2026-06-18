export interface Station {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: 'active' | 'maintenance';
  hasAnomaly: boolean;
}

export type ReviewStatus = 'confirmed' | 'pending' | 'returned';
export type SourceType = 'original' | 'old_bottle_id' | 'manual_review' | 'verbal_note';
export type AnomalyType = 'outlier' | 'unit_mismatch' | 'bottle_mismatch' | 'manual_change' | 'none';
export type TideUnit = 'm' | 'cm' | 'ft';

export interface TidalRecord {
  id: string;
  stationId: string;
  timestamp: string;
  waterLevel: number;
  unit: TideUnit;
  originalUnit: TideUnit;
  bottleId: string;
  bottleVersion: 'current' | 'old';
  oldBottleId?: string;
  status: ReviewStatus;
  isAnomaly: boolean;
  anomalyType: AnomalyType;
  anomalyReason?: string;
  conclusion?: string;
}

export interface SourceChainItem {
  id: string;
  recordId: string;
  type: SourceType;
  label: string;
  content: string;
  operator: string;
  time: string;
  affectsConclusion: boolean;
  sequence: number;
}

export interface Remark {
  id: string;
  recordId: string;
  content: string;
  author: string;
  time: string;
  isVerbal: boolean;
}

export interface ReviewLog {
  id: string;
  recordId: string;
  action: string;
  fromStatus?: ReviewStatus;
  toStatus: ReviewStatus;
  operator: string;
  time: string;
  remark?: string;
}

export interface AppState {
  stations: Station[];
  records: TidalRecord[];
  sourceChains: Record<string, SourceChainItem[]>;
  remarks: Record<string, Remark[]>;
  reviewLogs: Record<string, ReviewLog[]>;
  selectedStationId: string;
  selectedRecordId: string | null;
  timeRange: { start: string; end: string };
  statusFilter: ReviewStatus | 'all';
  unitFilter: 'all' | TideUnit | 'mixed';
  anomalyFilter: 'all' | 'anomaly' | 'normal';
  isPlaying: boolean;
  playSpeed: number;
  currentTimeIndex: number;
  showDetail: boolean;
  showReport: boolean;
}

export interface AppActions {
  setSelectedStation: (id: string) => void;
  setSelectedRecord: (id: string | null) => void;
  setStatusFilter: (status: ReviewStatus | 'all') => void;
  setUnitFilter: (unit: 'all' | TideUnit | 'mixed') => void;
  setAnomalyFilter: (filter: 'all' | 'anomaly' | 'normal') => void;
  setTimeRange: (start: string, end: string) => void;
  togglePlay: () => void;
  setPlaySpeed: (speed: number) => void;
  setCurrentTimeIndex: (index: number) => void;
  toggleDetail: (show?: boolean) => void;
  toggleReport: (show?: boolean) => void;
  updateRecordStatus: (recordId: string, status: ReviewStatus, remark?: string) => void;
  addRemark: (recordId: string, content: string, isVerbal: boolean) => void;
  getFilteredRecords: () => TidalRecord[];
  getCurrentStationRecords: () => TidalRecord[];
}
