import { HistoryEntry, TableState } from '../types';
import { statesEqual } from './urlState';

const STORAGE_KEY = 'table_filter_history';
const MAX_ENTRIES = 50;

export function getHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveHistory(history: HistoryEntry[]): void {
  try {
    const toSave = history.slice(0, MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch {
  }
}

export function addToHistory(state: TableState, label?: string): HistoryEntry {
  const history = getHistory();
  
  const existingIndex = history.findIndex(h => statesEqual(h.state, state));
  if (existingIndex !== -1) {
    const entry = {
      ...history[existingIndex],
      timestamp: Date.now(),
      label: label || history[existingIndex].label,
    };
    const newHistory = [entry, ...history.filter((_, i) => i !== existingIndex)];
    saveHistory(newHistory);
    return entry;
  }

  const entry: HistoryEntry = {
    id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    timestamp: Date.now(),
    state: { ...state },
    label,
  };

  const newHistory = [entry, ...history];
  saveHistory(newHistory);
  return entry;
}

export function removeFromHistory(id: string): void {
  const history = getHistory();
  saveHistory(history.filter(h => h.id !== id));
}

export function clearHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function updateHistoryLabel(id: string, label: string): void {
  const history = getHistory();
  const index = history.findIndex(h => h.id === id);
  if (index !== -1) {
    history[index].label = label;
    saveHistory(history);
  }
}

export function formatHistoryTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
}
