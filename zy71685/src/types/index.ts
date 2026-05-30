export type SourceType = 'system' | 'manual';

export type ProblemType = 'voice_overlap' | 'section_misalignment' | 'noise_misjudgment';

export type ConfirmationStatus = 'pending' | 'confirmed' | 'rejected';

export type OperationType = 'detection_run' | 'rerun' | 'undo' | 'manual_add' | 'confirm' | 'reject' | 'comment_add' | 'export';

export type Instrument = 'violin' | 'flute' | 'other';

export interface Rehearsal {
  id: string;
  name: string;
  date: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AudioTrack {
  id: string;
  rehearsalId: string;
  name: string;
  filePath: string;
  duration: number;
  sourceType: SourceType;
  createdAt: Date;
  audioData?: Float32Array;
  sampleRate?: number;
}

export interface VoicePart {
  id: string;
  rehearsalId: string;
  name: string;
  instrument: Instrument;
  studentName: string;
  sourceType: SourceType;
  createdAt: Date;
}

export interface ScoreSection {
  id: string;
  rehearsalId: string;
  name: string;
  startTime: number;
  endTime: number;
  expectedNotes: string;
  sourceType: SourceType;
  createdAt: Date;
}

export interface DetectionRun {
  id: string;
  rehearsalId: string;
  type: 'full' | 'partial';
  config: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: Date;
  finishedAt?: Date;
  timeRangeStart?: number;
  timeRangeEnd?: number;
}

export interface Misnote {
  id: string;
  rehearsalId: string;
  detectionRunId: string;
  voicePartId: string;
  time: number;
  duration: number;
  problemType: ProblemType;
  expectedPitch: string;
  actualPitch: string;
  deviationCents: number;
  confidence: number;
  confirmationStatus: ConfirmationStatus;
  sourceType: SourceType;
  createdAt: Date;
  notes?: string;
}

export interface Confirmation {
  id: string;
  misnoteId: string;
  status: ConfirmationStatus;
  operator: string;
  note?: string;
  createdAt: Date;
}

export interface Comment {
  id: string;
  misnoteId: string;
  authorType: 'teacher' | 'student';
  authorName: string;
  content: string;
  createdAt: Date;
}

export interface Report {
  id: string;
  rehearsalId: string;
  name: string;
  format: 'pdf' | 'xlsx';
  filtersApplied: string;
  timeRangeStart: number;
  timeRangeEnd: number;
  filePath: string;
  createdAt: Date;
  misnoteCount: number;
}

export interface OperationLog {
  id: string;
  rehearsalId: string;
  operationType: OperationType;
  targetEntity: string;
  targetId: string;
  snapshotBefore: string;
  snapshotAfter: string;
  operator: string;
  note?: string;
  createdAt: Date;
}

export interface FilterCriteria {
  voicePartIds: string[];
  problemTypes: ProblemType[];
  confirmationStatuses: ConfirmationStatus[];
  sourceTypes: SourceType[];
  timeRange: [number, number] | null;
  minConfidence: number;
  maxDeviation: number;
}

export interface ExportConfig {
  format: 'pdf' | 'xlsx';
  includeCharts: boolean;
  includeMisnoteList: boolean;
  includeComments: boolean;
  timeRange: [number, number];
  filters: FilterCriteria;
}

export interface PitchDetectionResult {
  time: number;
  frequency: number;
  probability: number;
}

export interface SeparationResult {
  time: number;
  dominantInstrument: Instrument | 'both' | 'none';
  violinEnergy: number;
  fluteEnergy: number;
}

export interface AlignmentResult {
  scoreSectionId: string;
  alignedStartTime: number;
  alignedEndTime: number;
  confidence: number;
}

export interface MisnoteStatistics {
  total: number;
  byProblemType: Record<ProblemType, number>;
  byVoicePart: Record<string, number>;
  byConfirmationStatus: Record<ConfirmationStatus, number>;
  byDeviationRange: { range: string; count: number }[];
  timeDistribution: { time: number; count: number }[];
}

export interface WaveformData {
  min: number[];
  max: number[];
  peaks: number[];
}

export const PROBLEM_TYPE_LABELS: Record<ProblemType, string> = {
  voice_overlap: '声部混叠',
  section_misalignment: '段落错位',
  noise_misjudgment: '噪声误判',
};

export const PROBLEM_TYPE_COLORS: Record<ProblemType, string> = {
  voice_overlap: 'text-problem-overlap',
  section_misalignment: 'text-problem-misalignment',
  noise_misjudgment: 'text-problem-noise',
};

export const PROBLEM_TYPE_BG_COLORS: Record<ProblemType, string> = {
  voice_overlap: 'bg-problem-overlap/20 border-problem-overlap/30 text-problem-overlap',
  section_misalignment: 'bg-problem-misalignment/20 border-problem-misalignment/30 text-problem-misalignment',
  noise_misjudgment: 'bg-problem-noise/20 border-problem-noise/30 text-problem-noise',
};

export const CONFIRMATION_STATUS_LABELS: Record<ConfirmationStatus, string> = {
  pending: '待确认',
  confirmed: '已确认',
  rejected: '已驳回',
};

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  system: '系统',
  manual: '人工',
};

export const INSTRUMENT_LABELS: Record<Instrument, string> = {
  violin: '小提琴',
  flute: '长笛',
  other: '其他',
};

export const OPERATION_TYPE_LABELS: Record<OperationType, string> = {
  detection_run: '运行检测',
  rerun: '重新计算',
  undo: '撤回操作',
  manual_add: '人工补录',
  confirm: '确认错音',
  reject: '驳回错音',
  comment_add: '添加备注',
  export: '导出报告',
};

export const DEFAULT_FILTERS: FilterCriteria = {
  voicePartIds: [],
  problemTypes: [],
  confirmationStatuses: [],
  sourceTypes: [],
  timeRange: null,
  minConfidence: 0,
  maxDeviation: 500,
};

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

export function frequencyToNote(frequency: number): string {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const noteNum = 12 * (Math.log2(frequency / 440)) + 69;
  const note = noteNames[Math.round(noteNum) % 12];
  const octave = Math.floor(Math.round(noteNum) / 12) - 1;
  return `${note}${octave}`;
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
