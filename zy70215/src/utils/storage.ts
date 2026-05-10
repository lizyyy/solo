import type { DataState } from '../types';

const STORAGE_KEY = 'cinema_cleaning_desk_data';
const EXPORT_HASH_KEY = 'cinema_cleaning_desk_export_hash';

export function loadData(): DataState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('加载数据失败:', e);
  }
  return {
    screenings: [],
    cleaningTasks: [],
    lostItems: [],
    equipmentIssues: [],
  };
}

export function saveData(state: DataState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('保存数据失败:', e);
  }
}

export function getLastExportHash(): string | null {
  return localStorage.getItem(EXPORT_HASH_KEY);
}

export function setLastExportHash(hash: string): void {
  localStorage.setItem(EXPORT_HASH_KEY, hash);
}

export function clearData(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(EXPORT_HASH_KEY);
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function formatDateTime(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function formatDate(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDateTime(str: string): Date {
  return new Date(str.replace(' ', 'T'));
}
