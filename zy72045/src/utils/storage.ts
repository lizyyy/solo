import type { GameState } from '../types/game';
import type { HistoryRecord } from '../types/history';

const GAME_STORAGE_KEY = 'stock-news-game-state';
const HISTORY_STORAGE_KEY = 'stock-news-history';

export const saveGameState = (state: Partial<GameState>): void => {
  try {
    const serialized = JSON.stringify(state);
    localStorage.setItem(GAME_STORAGE_KEY, serialized);
  } catch (e) {
    console.error('Failed to save game state:', e);
  }
};

export const loadGameState = (): Partial<GameState> | null => {
  try {
    const serialized = localStorage.getItem(GAME_STORAGE_KEY);
    if (!serialized) return null;
    return JSON.parse(serialized);
  } catch (e) {
    console.error('Failed to load game state:', e);
    return null;
  }
};

export const clearGameState = (): void => {
  localStorage.removeItem(GAME_STORAGE_KEY);
};

export const saveHistoryRecord = (record: HistoryRecord): void => {
  try {
    const records = loadHistoryRecords();
    records.unshift(record);
    const serialized = JSON.stringify(records.slice(0, 100));
    localStorage.setItem(HISTORY_STORAGE_KEY, serialized);
  } catch (e) {
    console.error('Failed to save history record:', e);
  }
};

export const loadHistoryRecords = (): HistoryRecord[] => {
  try {
    const serialized = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!serialized) return [];
    return JSON.parse(serialized);
  } catch (e) {
    console.error('Failed to load history records:', e);
    return [];
  }
};

export const loadHistoryRecordById = (id: string): HistoryRecord | undefined => {
  const records = loadHistoryRecords();
  return records.find((r) => r.id === id);
};

export const deleteHistoryRecord = (id: string): void => {
  try {
    const records = loadHistoryRecords();
    const filtered = records.filter((r) => r.id !== id);
    const serialized = JSON.stringify(filtered);
    localStorage.setItem(HISTORY_STORAGE_KEY, serialized);
  } catch (e) {
    console.error('Failed to delete history record:', e);
  }
};

export const clearHistoryRecords = (): void => {
  localStorage.removeItem(HISTORY_STORAGE_KEY);
};
