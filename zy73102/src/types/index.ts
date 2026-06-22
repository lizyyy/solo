export type ProcessingStatus = 'confirmed' | 'pending' | 'conflicted' | 'obsolete';

export type MaterialType = 'pipe' | 'hopper' | 'gutter' | 'fitting' | 'sealant';

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface TrackBatch {
  batchId: string;
  name: string;
  status: 'pending' | 'running' | 'reviewed' | 'abnormal';
  createdAt: string;
  samplePackName: string;
  currentRunId?: string;
}

export interface TrackRun {
  runId: string;
  batchId: string;
  runNumber: number;
  remark: string;
  executedAt: string;
  resultStatus: 'success' | 'failed' | 'warning';
  drawingVersion: string;
  materialCount: number;
  collisionCount: number;
  abnormalCount: number;
  materials?: MaterialItem[];
  collisions?: CollisionPoint[];
}

export interface MaterialItem {
  materialId: string;
  runId: string;
  standardName: string;
  materialName?: string;
  materialType: MaterialType;
  processingStatus: ProcessingStatus;
  sourceNoteId: string;
  sourceNoteNumber: string;
  source?: string;
  threeMeshId: string;
  drawingVersion: string;
  position: Position;
  originalFields: Record<string, unknown>;
  matchedMap?: Record<string, string>;
  lockedFields: string[];
  involvedInCollision?: boolean;
}

export interface CollisionPoint {
  collisionId: string;
  runId: string;
  confidence: 'high' | 'medium' | 'low';
  involvedMaterialIds: string[];
  originalQuote: string;
  noteParagraphRef: string;
  deduplicationHash: number;
}

export interface NoteParagraph {
  index: number;
  rawText: string;
  extractedFields: Record<string, string>;
  matchedStandards: string[];
}

export interface MeetingNote {
  noteId: string;
  noteNumber: string;
  title: string;
  meetingDate: string;
  paragraphs: NoteParagraph[];
}

export interface TimelineNode {
  version: string;
  label: string;
  timestamp: string;
  noteNumber: string;
  isLatest: boolean;
}

export interface FilterState {
  materialTypes: string[];
  processingStatuses: string[];
  drawingVersions: string[];
  collisionOnly: boolean;
}

export interface ExportRecord {
  exportId: string;
  fileName: string;
  exportAt: string;
  fileSize: number;
  batchId: string;
  runNumber: number;
  format: 'csv' | 'json';
}

export interface TrackStoreState {
  batches: TrackBatch[];
  runs: TrackRun[];
  materials: MaterialItem[];
  collisions: CollisionPoint[];
  meetingNotes: MeetingNote[];
  exportRecords: ExportRecord[];
  currentBatchId: string | null;
  currentRunId: string | null;
  filterState: FilterState;
  addBatch: (batch: TrackBatch) => void;
  addRun: (run: TrackRun) => void;
  rerunRun: (sourceRunId: string, remark: string) => TrackRun | null;
  setCurrentBatch: (batchId: string | null) => void;
  setCurrentRun: (runId: string | null) => void;
  getRunsByBatchId: (batchId: string) => TrackRun[];
  getMaxRunNumber: (batchId: string) => number;
  addExportRecord: (record: ExportRecord) => void;
  loadSamplePack: () => void;
  updateFilter: (filter: Partial<FilterState>) => void;
}
