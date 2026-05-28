import { ReplayData, HistoryRecord } from '../game/types';

const STORAGE_KEYS = {
  HISTORY: 'museum_night_patrol_history',
  REPLAYS: 'museum_night_patrol_replays',
} as const;

const MAX_STORAGE_BYTES = 50 * 1024 * 1024;

function getStorageSize(): number {
  let total = 0;
  for (const key in localStorage) {
    if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
      const value = localStorage.getItem(key);
      if (value) {
        total += value.length * 2;
      }
    }
  }
  return total;
}

export function saveReplayToStorage(replay: ReplayData): string {
  const id = `replay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const replays = JSON.parse(localStorage.getItem(STORAGE_KEYS.REPLAYS) || '{}');
  
  const currentSize = getStorageSize();
  const replaySize = JSON.stringify(replay).length * 2;
  
  if (currentSize + replaySize > MAX_STORAGE_BYTES) {
    const replayKeys = Object.keys(replays).sort((a, b) => {
      const timeA = parseInt(a.split('_')[1]) || 0;
      const timeB = parseInt(b.split('_')[1]) || 0;
      return timeA - timeB;
    });
    
    for (const oldKey of replayKeys) {
      if (getStorageSize() + replaySize > MAX_STORAGE_BYTES) {
        delete replays[oldKey];
      } else {
        break;
      }
    }
  }
  
  replays[id] = replay;
  localStorage.setItem(STORAGE_KEYS.REPLAYS, JSON.stringify(replays));
  
  return id;
}

export function saveHistoryToStorage(record: HistoryRecord): void {
  const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY) || '[]');
  history.unshift(record);
  localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
}

export function loadReplayFromStorage(id: string): ReplayData | null {
  const replays = JSON.parse(localStorage.getItem(STORAGE_KEYS.REPLAYS) || '{}');
  return replays[id] || null;
}

export function loadHistoryFromStorage(): HistoryRecord[] {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY) || '[]');
}

export function clearAllStorage(): void {
  localStorage.removeItem(STORAGE_KEYS.HISTORY);
  localStorage.removeItem(STORAGE_KEYS.REPLAYS);
}
