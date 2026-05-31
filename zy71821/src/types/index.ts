export interface PlayerFeedback {
  id: string;
  playerId: string;
  playerName: string;
  content: string;
  timestamp: string;
  source: 'manual' | 'file';
  status: 'pending' | 'confirmed' | 'resolved';
  attachments?: string[];
  isDuplicate?: boolean;
  duplicateOf?: string;
}

export interface Schedule {
  id: string;
  date: string;
  mineType: string;
  operator: string;
  status: 'normal' | 'abnormal' | 'completed';
  history: ScheduleHistory[];
  note?: string;
}

export interface ScheduleHistory {
  id: string;
  timestamp: string;
  before: Partial<Schedule>;
  after: Partial<Schedule>;
  operator: string;
  reason: string;
}

export interface Ranking {
  id: string;
  rank: number;
  playerName: string;
  score: number;
  modifications: Modification[];
}

export interface Modification {
  id: string;
  timestamp: string;
  before: Partial<Ranking>;
  after: Partial<Ranking>;
  reason: string;
  operator: string;
}

export interface CheckItem {
  id: string;
  name: string;
  checked: boolean;
  status: 'pass' | 'fail' | 'warning';
  message?: string;
}

export interface ImportedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadTime: string;
  status: 'processing' | 'completed' | 'error';
  data?: any[];
  errors?: string[];
}

export interface ExportConfig {
  type: 'summary' | 'detail' | 'all';
  dateRange: { start: string; end: string };
  includeRanking: boolean;
  includeSchedule: boolean;
  includeFeedback: boolean;
  format: 'excel' | 'csv' | 'json';
}
