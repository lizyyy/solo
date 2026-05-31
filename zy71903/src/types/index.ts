export enum DataSource {
  METRONOME = 'metronome',
  MUSIC_SHEET = 'musicSheet',
  MANUAL = 'manual',
}

export enum RecordStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  TO_FILL = 'toFill',
  MANUAL_EDITED = 'manualEdited',
}

export enum MismatchType {
  DISCONTINUOUS = 'discontinuous',
  OVERLAP = 'overlap',
  REVERSED = 'reversed',
}

export enum ChangeType {
  SYSTEM = 'system',
  MANUAL = 'manual',
}

export interface Student {
  id: string;
  name: string;
  sectionId: string;
  instrument: string;
}

export interface Section {
  id: string;
  name: string;
  leaderId: string;
  leaderName: string;
}

export interface BeatRecord {
  id: string;
  studentId: string;
  studentName: string;
  sectionId: string;
  sectionName: string;
  rehearsalDate: string;
  measureStart: number;
  measureEnd: number;
  tempo: number;
  source: DataSource;
  status: RecordStatus;
  remarks: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isDuplicate: boolean;
  duplicateOfId?: string;
}

export interface ChangeLog {
  id: string;
  recordId: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  changedBy: string;
  changeType: ChangeType;
  changedAt: string;
  reason: string;
}

export interface MismatchRecord {
  id: string;
  recordId: string;
  mismatchType: MismatchType;
  source: DataSource;
  description: string;
  suggestedHandler: string;
  status: 'pending' | 'fixed' | 'ignored';
  detectedAt: string;
}

export interface SummaryItem {
  id: string;
  recordId: string;
  category: RecordStatus;
  handlingCaliber: string;
  remarks: string;
}

export interface RehearsalSummary {
  id: string;
  date: string;
  totalRecords: number;
  confirmedCount: number;
  toFillCount: number;
  manualEditedCount: number;
  items: SummaryItem[];
  generatedAt: string;
}

export interface FriendlyError {
  id: string;
  level: 'error' | 'warning' | 'info';
  message: string;
  suggestion: string;
  field?: string;
  relatedRecordId?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: FriendlyError[];
  warnings: FriendlyError[];
}

export interface FilterOptions {
  sectionId?: string;
  studentId?: string;
  date?: string;
  status?: RecordStatus;
  source?: DataSource;
  search?: string;
}
