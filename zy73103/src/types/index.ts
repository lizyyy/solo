export type SchemeId = 'A' | 'B' | 'C';

export type SchemeStatus =
  | 'draft'
  | 'reviewing'
  | 'approved'
  | 'rejected'
  | 'pending_material'
  | 'construction_ready';

export type MaterialStatus = 'complete' | 'pending' | 'late';

export type AnomalyType = 'layer_name' | 'attachment_late' | 'conflict' | 'missing_data';

export type AnomalyStatus = 'open' | 'investigating' | 'resolved' | 'ignored';

export type TimelineEventType =
  | 'scheme_created'
  | 'note_imported'
  | 'anomaly_detected'
  | 'anomaly_resolved'
  | 'material_arrived'
  | 'material_late'
  | 'status_changed'
  | 'comparison_rerun'
  | 'scheme_updated';

export interface DrainageScheme {
  id: SchemeId;
  name: string;
  efficiency: number;
  cost: number;
  duration: number;
  risk: number;
  status: SchemeStatus;
  recommLevel: '推荐' | '备选' | '待完善';
  responsible: string;
  constructionSpec: string;
  sceneAnnotation: string;
  sideNote: string;
  roofZones: RoofZone[];
}

export interface RoofZone {
  id: string;
  label: string;
  position: [number, number, number];
  size: [number, number];
  slope: number;
  hasAnomaly?: boolean;
}

export interface BimNote {
  id: string;
  schemeId: SchemeId;
  layerName: string;
  content: string;
  author: string;
  createdAt: string;
  materialStatus: MaterialStatus;
  attachmentId?: string;
  attachmentName?: string;
  estimatedArrival?: string;
  isLayerValid: boolean;
  layerIssue?: string;
  affectedZoneId?: string;
}

export interface AnomalyRecord {
  id: string;
  noteId?: string;
  schemeId: SchemeId;
  type: AnomalyType;
  title: string;
  detail: string;
  cause: string;
  responsible: string;
  status: AnomalyStatus;
  affectedZoneId?: string;
  firstDetected: string;
}

export interface TimelineEvent {
  id: string;
  schemeId: SchemeId;
  noteId?: string;
  anomalyId?: string;
  timestamp: string;
  eventType: TimelineEventType;
  title: string;
  description: string;
  fromState?: string;
  toState?: string;
  actor: string;
  tags?: string[];
}

export interface RerunMeta {
  runIndex: number;
  timestamp: string;
  actor: string;
  summary: string;
}

export interface AppState {
  schemes: DrainageScheme[];
  notes: BimNote[];
  anomalies: AnomalyRecord[];
  timeline: TimelineEvent[];
  rerunHistory: RerunMeta[];

  selectedSchemeId: SchemeId;
  selectedNoteId?: string;
  selectedAnomalyId?: string;
  activePanelTab: 'side' | 'anomaly';

  highlightZoneId?: string;
  lastImportAt?: string;
  notesImported: boolean;
}

export interface AppActions {
  selectScheme: (id: SchemeId) => void;
  selectAnomaly: (id?: string) => void;
  setActivePanelTab: (tab: 'side' | 'anomaly') => void;
  highlightZone: (zoneId?: string) => void;
  importSampleNotes: () => void;
  rerunComparison: () => void;
  markAttachmentArrived: (noteId: string) => void;
  resolveAnomaly: (anomalyId: string) => void;
  filterTimelineByScheme: (id?: SchemeId) => TimelineEvent[];
  getAnomaliesByScheme: (id: SchemeId) => AnomalyRecord[];
  getNotesByScheme: (id: SchemeId) => BimNote[];
}
