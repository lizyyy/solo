import type { HistoryRecord } from "@/types";

const KEY = "cold-chain-history";

export function loadHistory(): HistoryRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HistoryRecord[];
  } catch {
    return [];
  }
}

export function saveHistory(list: HistoryRecord[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function appendHistory(rec: HistoryRecord): HistoryRecord[] {
  const list = loadHistory();
  list.unshift(rec);
  saveHistory(list.slice(0, 100));
  return list;
}

export function getHistoryRecord(id: string): HistoryRecord | undefined {
  return loadHistory().find((r) => r.id === id);
}

export function clearHistory(): void {
  saveHistory([]);
}
