export type KeyStatus = 'normal' | 'warning' | 'error';

export interface PianoKeyData {
  keyNumber: number;
  noteName: string;
  isBlack: boolean;
  pressure: number;
  reboundTime: number;
  status: KeyStatus;
  pressureCurve: number[];
  octave: number;
}

export interface KeyNote {
  id: string;
  keyNumber: number;
  content: string;
  createdAt: string;
  author: string;
  version: string;
}

export type EvidenceType = 'key_mismatch' | 'unit_conversion' | 'note_change' | 'pressure_adjust';

export interface EvidenceRecord {
  id: string;
  keyNumber: number;
  type: EvidenceType;
  beforeValue: string;
  afterValue: string;
  timestamp: string;
  operator: string;
  description: string;
}

export interface DataSnapshot {
  id: string;
  name: string;
  createdAt: string;
  keyData: PianoKeyData[];
  reason: string;
  operator: string;
}

export interface FilterCriteria {
  keyRange: [number, number];
  pressureRange: [number, number];
  reboundRange: [number, number];
  status: KeyStatus[];
  searchText: string;
}

export interface RelatedKeyItem {
  keyNumber: number;
  reason: string;
  similarity: number;
}

export interface PianoStoreState {
  keys: PianoKeyData[];
  selectedKey: number | null;
  notes: KeyNote[];
  evidence: EvidenceRecord[];
  snapshots: DataSnapshot[];
  filters: FilterCriteria;
  viewMode: 'heatmap' | 'normal' | 'rebound';
  showPanel: boolean;
  currentSnapshot: string | null;
  
  setSelectedKey: (keyNumber: number | null) => void;
  addNote: (keyNumber: number, content: string, author: string) => void;
  addEvidence: (record: Omit<EvidenceRecord, 'id' | 'timestamp'>) => void;
  updateKeyPressure: (keyNumber: number, pressure: number, operator: string) => void;
  updateFilters: (filters: Partial<FilterCriteria>) => void;
  setViewMode: (mode: 'heatmap' | 'normal' | 'rebound') => void;
  togglePanel: () => void;
  createSnapshot: (name: string, reason: string, operator: string) => void;
  loadSnapshot: (snapshotId: string) => void;
  getFilteredKeys: () => PianoKeyData[];
  getRelatedKeys: (keyNumber: number) => RelatedKeyItem[];
}
