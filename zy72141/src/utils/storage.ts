import { AppState, WeeklyRecord, FileItem, Track, Annotation, Conflict, Note, WeeklyReport } from '@/types';

const STORAGE_VERSION = '1.0.0';
const KEYS = {
  VERSION: 'piano-coach:version',
  RECORDS: 'piano-coach:records',
  RECORD: (id: string) => `piano-coach:record:${id}`,
};

interface StoredRecordData {
  record: WeeklyRecord;
  files: FileItem[];
  tracks: Track[];
  annotations: Annotation[];
  conflicts: Conflict[];
  notes: Note[];
  report?: WeeklyReport;
}

export const storage = {
  getVersion(): string | null {
    return localStorage.getItem(KEYS.VERSION);
  },

  setVersion(version: string): void {
    localStorage.setItem(KEYS.VERSION, version);
  },

  saveRecordsIndex(records: WeeklyRecord[]): void {
    localStorage.setItem(KEYS.RECORDS, JSON.stringify(records));
  },

  getRecordsIndex(): WeeklyRecord[] {
    const data = localStorage.getItem(KEYS.RECORDS);
    return data ? JSON.parse(data) : [];
  },

  saveRecordData(recordId: string, data: StoredRecordData): void {
    localStorage.setItem(KEYS.RECORD(recordId), JSON.stringify(data));
  },

  getRecordData(recordId: string): StoredRecordData | null {
    const data = localStorage.getItem(KEYS.RECORD(recordId));
    return data ? JSON.parse(data) : null;
  },

  deleteRecordData(recordId: string): void {
    localStorage.removeItem(KEYS.RECORD(recordId));
  },

  saveFullState(state: AppState): void {
    this.setVersion(STORAGE_VERSION);
    this.saveRecordsIndex(state.records);
    
    state.records.forEach(record => {
      const data: StoredRecordData = {
        record,
        files: state.files.filter(f => f.recordId === record.id),
        tracks: state.tracks.filter(t => t.recordId === record.id),
        annotations: state.annotations.filter(a => a.recordId === record.id),
        conflicts: state.conflicts.filter(c => c.recordId === record.id),
        notes: state.notes.filter(n => n.recordId === record.id),
        report: state.reports[record.id],
      };
      this.saveRecordData(record.id, data);
    });
  },

  loadFullState(): AppState | null {
    const version = this.getVersion();
    if (!version) return null;

    const records = this.getRecordsIndex();
    if (records.length === 0) return null;

    const state: AppState = {
      currentRecordId: null,
      records,
      files: [],
      tracks: [],
      annotations: [],
      conflicts: [],
      notes: [],
      reports: {},
    };

    records.forEach(record => {
      const data = this.getRecordData(record.id);
      if (data) {
        state.files.push(...data.files);
        state.tracks.push(...data.tracks);
        state.annotations.push(...data.annotations);
        state.conflicts.push(...data.conflicts);
        state.notes.push(...data.notes);
        if (data.report) {
          state.reports[record.id] = data.report;
        }
      }
    });

    return state;
  },

  clearAll(): void {
    const version = this.getVersion();
    const records = this.getRecordsIndex();
    
    records.forEach(r => this.deleteRecordData(r.id));
    localStorage.removeItem(KEYS.RECORDS);
    localStorage.removeItem(KEYS.VERSION);
    
    if (version) {
      localStorage.setItem(`piano-coach:backup:${Date.now()}`, JSON.stringify({ version, records }));
    }
  },
};

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export const STORAGE_CONSTANTS = {
  VERSION: STORAGE_VERSION,
};
