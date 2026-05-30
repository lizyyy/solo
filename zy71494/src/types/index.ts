export type SegmentType = 'intro' | 'outro' | 'breakdown' | 'drop' | 'build' | 'verse' | 'chorus';

export type BPMConfidence = 'low' | 'medium' | 'high';

export type OperationType = 'bpm' | 'beat' | 'segment' | 'inpoint' | 'outpoint' | 'delete' | 'import';

export interface Track {
  id: string;
  name: string;
  fileName: string;
  duration: number;
  audioBlobId: string;
  currentBPM: number;
  bpmConfidence: BPMConfidence;
  bestInPoint?: number;
  bestOutPoint?: number;
  waveformData?: number[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Beat {
  id: string;
  trackId: string;
  time: number;
  confidence: number;
  isManual: boolean;
  driftNote?: string;
  createdAt: Date;
}

export interface Segment {
  id: string;
  trackId: string;
  type: SegmentType;
  startTime: number;
  endTime: number;
  label?: string;
  version: number;
  previousValue?: string;
  createdAt: Date;
}

export interface BPMHistory {
  id: string;
  trackId: string;
  detectedBPM: number;
  adjustedBPM: number;
  reason: string;
  isHalfSpeedFix: boolean;
  isDoubleSpeedFix: boolean;
  createdAt: Date;
}

export interface TransitionScore {
  id: string;
  trackId: string;
  fromTrackId?: string;
  toTrackId?: string;
  overallScore: number;
  bpmMatchScore: number;
  beatAlignScore: number;
  segmentFitScore: number;
  recommendation: string;
  createdAt: Date;
}

export interface OperationLog {
  id: string;
  trackId: string;
  operationType: OperationType;
  fieldName: string;
  oldValue: string;
  newValue: string;
  reason?: string;
  operator: string;
  timestamp: Date;
}

export interface EvidenceChainItem {
  log: OperationLog;
  relatedData?: Beat | Segment | BPMHistory;
  type: 'bpm' | 'beat' | 'segment';
}

export interface ExportData {
  track: Track;
  beats: Beat[];
  segments: Segment[];
  bpmHistory: BPMHistory[];
  transitionScores: TransitionScore[];
  operationLogs: OperationLog[];
  exportedAt: Date;
  exportedBy: string;
}

export const SEGMENT_COLORS: Record<SegmentType, string> = {
  intro: '#06b6d4',
  outro: '#ec4899',
  breakdown: '#f59e0b',
  drop: '#10b981',
  build: '#8b5cf6',
  verse: '#64748b',
  chorus: '#f43f5e',
};

export const SEGMENT_LABELS: Record<SegmentType, string> = {
  intro: 'Intro',
  outro: 'Outro',
  breakdown: 'Breakdown',
  drop: 'Drop',
  build: 'Build',
  verse: 'Verse',
  chorus: 'Chorus',
};

export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
};

export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};
