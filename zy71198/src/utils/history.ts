import { HistoryRecord } from '@/types/game';

const STORAGE_KEY = 'street_lamp_repair_history';

export function saveHistory(record: HistoryRecord): void {
  const history = loadHistory();
  history.unshift(record);
  if (history.length > 20) {
    history.length = 20;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

export function loadHistory(): HistoryRecord[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function clearHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function generateHistoryId(): string {
  return `hist_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}
