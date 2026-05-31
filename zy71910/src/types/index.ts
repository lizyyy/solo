export type SegmentStatus = 'confirmed' | 'pending' | 'discarded';
export type AnomalyType = 'normal' | 'drift' | 'silence' | 'overlap' | 'missing';
export type ActionType = 'import' | 'add_segment' | 'update_segment' | 'delete_segment' | 'confirm' | 'revert' | 'mark_pending' | 'export';

export interface AudioTrack {
  id: string;
  name: string;
  duration: number;
  fileHash: string;
  subtitleText?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Segment {
  id: string;
  trackId: string;
  startTime: number;
  endTime: number;
  text: string;
  status: SegmentStatus;
  anomalyType: AnomalyType;
  anomalyNote?: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConfirmRecord {
  id: string;
  segmentId: string;
  trackId: string;
  operator: string;
  action: 'confirm' | 'revert' | 'mark_pending' | 'discard';
  remark?: string;
  timestamp: Date;
}

export interface OperationLog {
  id: string;
  trackId: string;
  actionType: ActionType;
  beforeState?: string;
  afterState?: string;
  timestamp: Date;
}

export interface ExportManifest {
  exportId: string;
  trackName: string;
  exportedAt: Date;
  segments: Segment[];
  operationSummary: string[];
  anomalyNotes: string[];
}

export interface UserMessage {
  id: string;
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  action?: {
    label: string;
    handler: () => void;
  };
}

export interface UndoState {
  canUndo: boolean;
  canRedo: boolean;
  undoDescription: string;
}
