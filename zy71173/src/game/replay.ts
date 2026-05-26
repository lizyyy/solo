import type { GameRecord } from './types';

const STORAGE_KEY = 'museum_escort_records';
const MAX_RECORDS = 10;

export function saveRecord(record: GameRecord): void {
  const records = loadRecords();
  records.unshift(record);
  if (records.length > MAX_RECORDS) {
    records.splice(MAX_RECORDS);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function loadRecords(): GameRecord[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const records = JSON.parse(data);
    return Array.isArray(records) ? records : [];
  } catch {
    return [];
  }
}

export function deleteRecord(id: string): void {
  const records = loadRecords().filter((r) => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function clearRecords(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getRecordById(id: string): GameRecord | null {
  const records = loadRecords();
  return records.find((r) => r.id === id) ?? null;
}
