export type RecordSource = 'recording' | 'section_leader' | 'metronome';
export type RecordStatus = 'confirmed' | 'pending' | 'corrected' | 'duplicate' | 'late_arrival';
export type AnalysisResult = 'correct' | 'wrong_note' | 'rhythm_error' | 'key_mismatch' | 'tempo_mismatch' | 'other';

export interface BaseRecord {
  id: string;
  timestamp: number;
  source: RecordSource;
  status: RecordStatus;
  createdAt: number;
  updatedAt: number;
}

export interface RecordingRecord extends BaseRecord {
  source: 'recording';
  audioUrl: string;
  duration: number;
  segmentName: string;
  keySignature: string;
  tempo: number;
  notes: string;
}

export interface SectionLeaderNote extends BaseRecord {
  source: 'section_leader';
  sectionName: string;
  authorName: string;
  content: string;
  keySignature?: string;
  suggestedTempo?: number;
  priority: 'high' | 'medium' | 'low';
}

export interface MetronomeRecord extends BaseRecord {
  source: 'metronome';
  tempo: number;
  beatsPerMeasure: number;
  duration: number;
  driftAmount?: number;
}

export type TimelineRecord = RecordingRecord | SectionLeaderNote | MetronomeRecord;

export interface AutoAnalysis {
  analyzerVersion: string;
  analysisTime: number;
  result: AnalysisResult;
  confidence: number;
  reasons: string[];
  evidence: {
    type: string;
    description: string;
    source: RecordSource;
  }[];
}

export interface ManualCorrection {
  correctedBy: string;
  correctedAt: number;
  originalContent: string;
  correctedContent: string;
  correctionReason: string;
}

export interface WrongNoteRecord {
  id: string;
  timelineRecordId: string;
  timestamp: number;
  measureNumber: number;
  beatNumber: number;
  expectedNote: string;
  actualNote: string;
  autoAnalysis?: AutoAnalysis;
  manualCorrection?: ManualCorrection;
  source: RecordSource;
  keyMismatchInfo?: {
    expectedKey: string;
    actualKey: string;
    mismatchSource: 'recording' | 'section_leader';
    followUpContact: string;
  };
  status: RecordStatus;
  nextStep: string;
}

export interface DuplicateInfo {
  duplicateOfId: string;
  detectedAt: number;
  matchConfidence: number;
  matchReasons: string[];
}

export interface LateArrivalInfo {
  originalExpectedTimestamp: number;
  actualArrivalTimestamp: number;
  delayReason: string;
}

export interface RehearsalSummary {
  rehearsalDate: string;
  totalRecords: number;
  confirmedCount: number;
  pendingCount: number;
  correctedCount: number;
  wrongNoteCount: number;
  keyMismatchCount: number;
  processingPolicy: string;
  confirmedRecords: WrongNoteRecord[];
  pendingRecords: WrongNoteRecord[];
  correctedRecords: WrongNoteRecord[];
}
