export interface SubtitleCue {
  id: string;
  index: number;
  startTime: number;
  endTime: number;
  startTimeStr: string;
  endTimeStr: string;
  text: string;
  language?: string;
}

export interface SubtitleFile {
  id: string;
  name: string;
  path: string;
  format: 'srt' | 'vtt';
  language: 'zh' | 'en' | 'bilingual';
  cues: SubtitleCue[];
  importTime: number;
  checksum: string;
}

export interface VideoMetadata {
  id: string;
  videoId: string;
  title: string;
  duration: number;
  durationStr: string;
  format: string;
  importTime: number;
}

export interface SensitiveWord {
  id: string;
  word: string;
  category: string;
  level: 'high' | 'medium' | 'low';
  replacement?: string;
  description?: string;
}

export interface TermItem {
  id: string;
  source: string;
  target: string;
  category: string;
  language: 'zh' | 'en';
}

export type IssueType = 
  | 'typo'
  | 'timeline_overlap'
  | 'sensitive_word'
  | 'missing_segment'
  | 'encoding_error'
  | 'time_format_error'
  | 'empty_segment';

export type IssueSeverity = 'blocker' | 'warning' | 'info';
export type IssueStatus = 'open' | 'fixed' | 'ignored';

export interface Issue {
  id: string;
  subtitleId: string;
  cueIndex?: number;
  type: IssueType;
  severity: IssueSeverity;
  status: IssueStatus;
  message: string;
  context: {
    startTime?: string;
    endTime?: string;
    originalText?: string;
    suggestedFix?: string;
    canAutoFix: boolean;
    requiresHumanReview: boolean;
    segmentPosition?: number;
  };
  createdAt: number;
  updatedAt: number;
  history: IssueHistory[];
}

export interface IssueHistory {
  id: string;
  timestamp: number;
  action: 'detected' | 'auto_fixed' | 'manual_fixed' | 'ignored' | 'reopened';
  operator: string;
  before?: string;
  after?: string;
  comment?: string;
}

export interface CheckSession {
  id: string;
  timestamp: number;
  subtitleIds: string[];
  issues: Issue[];
  summary: {
    total: number;
    blockers: number;
    warnings: number;
    infos: number;
    autoFixable: number;
    requiresReview: number;
  };
}

export interface QCState {
  version: string;
  initialized: boolean;
  initializedAt: number;
  subtitles: Record<string, SubtitleFile>;
  metadata: Record<string, VideoMetadata>;
  sensitiveWords: Record<string, SensitiveWord>;
  terms: Record<string, TermItem>;
  issues: Record<string, Issue>;
  sessions: Record<string, CheckSession>;
  operators: string[];
}
