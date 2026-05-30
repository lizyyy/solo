export type MaterialType = 'timeline' | 'dialog' | 'music' | 'cue' | 'note';

export type MaterialStatus = 'pending' | 'parsing' | 'success' | 'failed';

export type IssueType = 'timecode' | 'version' | 'conflict';

export type IssueSeverity = 'warning' | 'error';

export type ProjectStatus = 'draft' | 'uploading' | 'processing' | 'completed' | 'has_issues';

export interface Timecode {
  hours: number;
  minutes: number;
  seconds: number;
  frames?: number;
  milliseconds?: number;
  totalSeconds: number;
  originalFormat: 'frames' | 'milliseconds' | 'seconds';
}

export interface CuePoint {
  id: string;
  number: string;
  name: string;
  startTime: Timecode;
  endTime: Timecode;
  duration: Timecode;
  description?: string;
  sourceMaterial: MaterialType;
}

export interface ParseError {
  id: string;
  materialId: string;
  lineNumber?: number;
  fieldName?: string;
  originalValue?: string;
  friendlyMessage: string;
  suggestion: string;
  detectionStep: string;
}

export interface Material {
  id: string;
  projectId: string;
  type: MaterialType;
  fileName: string;
  fileFormat: string;
  content: string;
  fileSize?: number;
  uploadedAt: string;
  parseStatus: MaterialStatus;
  parseErrors: ParseError[];
  parsedData?: {
    cuePoints?: CuePoint[];
    rawData?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  };
  fingerprint?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  currentSnapshotId?: string;
}

export interface Issue {
  id: string;
  snapshotId: string;
  projectId?: string;
  type: IssueType;
  severity: IssueSeverity;
  detectionStep: string;
  location: string;
  description: string;
  suggestion: string;
  relatedMaterialId?: string;
  timecode?: number;
  resolved: boolean;
}

export interface TimelineAlignment {
  id: string;
  snapshotId: string;
  timecode: number;
  timelineCueId?: string;
  dialogCueId?: string;
  musicCueId?: string;
  cueListCueId?: string;
  isAligned: boolean;
  issues: string[];
}

export interface CheckSnapshot {
  id: string;
  projectId: string;
  versionNumber: number;
  createdAt: string;
  summary: string;
  errorCount: number;
  warningCount: number;
  alignmentPassRate: number;
  materials: {
    materialId: string;
    type: MaterialType;
    fingerprint: string;
    fileName: string;
  }[];
}

export interface OperationLog {
  id: string;
  projectId: string;
  action: string;
  detail: string;
  timestamp: string;
  operator: string;
  isError: boolean;
}

export interface Result<T, E = ParseError> {
  success: boolean;
  data?: T;
  error?: E;
}

export const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  timeline: '剪辑时间轴',
  dialog: '对白轨',
  music: '音乐文件',
  cue: 'Cue清单',
  note: '导演备注',
};

export const MATERIAL_TYPE_COLORS: Record<MaterialType, string> = {
  timeline: 'bg-track-timeline',
  dialog: 'bg-track-dialog',
  music: 'bg-track-music',
  cue: 'bg-track-cue',
  note: 'bg-track-note',
};
