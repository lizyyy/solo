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
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  dbPath = path.join(dataDir, 'chatbot.json');

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

export const records = {
  getAll: (): AnnotationRecord[] => [...data.annotation_records],
  getById: (id: string): AnnotationRecord | undefined =>
    data.annotation_records.find((r) => r.id === id),
  add: (record: AnnotationRecord): void => {
    data.annotation_records.push(record);
    saveData();
  },
  update: (id: string, updates: Partial<AnnotationRecord>): boolean => {
    const idx = data.annotation_records.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    data.annotation_records[idx] = { ...data.annotation_records[idx], ...updates };
    saveData();
    return true;
  },
  getSessionIds: (): Set<string> => new Set(data.annotation_records.map((r) => r.session_id)),
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
