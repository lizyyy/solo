import fs from 'fs';
import path from 'path';
import { AnnotationRecord, SelfCheckResult } from './types';

interface DatabaseData {
  annotation_records: AnnotationRecord[];
  self_check_results: SelfCheckResult[];
}

let dbPath: string;
let data: DatabaseData;

export function initDatabase() {
  const DATA_DIR = path.resolve(__dirname, '..', 'data');
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  dbPath = path.join(DATA_DIR, 'chatbot.json');

  if (fs.existsSync(dbPath)) {
    try {
      const raw = fs.readFileSync(dbPath, 'utf-8');
      data = JSON.parse(raw);
    } catch (e) {
      data = { annotation_records: [], self_check_results: [] };
      saveData();
    }
  } else {
    data = { annotation_records: [], self_check_results: [] };
    saveData();
  }
}

export function saveData() {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf-8');
}

function cloneRecord(r: AnnotationRecord): AnnotationRecord {
  return JSON.parse(JSON.stringify(r));
}

export const records = {
  getAll: (): AnnotationRecord[] => data.annotation_records.map(cloneRecord),
  getById: (id: string): AnnotationRecord | undefined => {
    const r = data.annotation_records.find((x) => x.id === id);
    return r ? cloneRecord(r) : undefined;
  },
  add: (record: AnnotationRecord): void => {
    data.annotation_records.push(cloneRecord(record));
    saveData();
  },
  update: (id: string, updates: Partial<AnnotationRecord>): boolean => {
    const idx = data.annotation_records.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    data.annotation_records[idx] = cloneRecord({ ...data.annotation_records[idx], ...updates });
    saveData();
    return true;
  },
  getSessionIds: (): Set<string> => new Set(data.annotation_records.map((r) => r.session_id)),
  getByMaskedPhone: (maskedPhone: string): AnnotationRecord[] => {
    return data.annotation_records
      .filter((r) => {
        const phone = r.phone_number || '';
        const clean = phone.replace(/\D/g, '');
        if (clean.length < 7) return false;
        const masked = clean.slice(0, 3) + '****' + clean.slice(-4);
        return masked === maskedPhone;
      })
      .map(cloneRecord);
  },
  getRawData: (): DatabaseData => data,
};

export const selfCheck = {
  getAll: (): SelfCheckResult[] => [...data.self_check_results],
  add: (result: SelfCheckResult): void => {
    data.self_check_results.push(result);
    saveData();
  },
  clear: (): void => {
    data.self_check_results = [];
    saveData();
  },
  resolve: (id: string): boolean => {
    const idx = data.self_check_results.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    data.self_check_results[idx].is_resolved = true;
    saveData();
    return true;
  },
};
