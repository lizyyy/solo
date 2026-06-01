import type { GameSnapshot } from '../types';

const STORAGE_KEYS = {
  SNAPSHOTS: 'carbon_farm_snapshots',
  CURRENT_STATE: 'carbon_farm_current_state',
  PENDING_TRANSACTIONS: 'carbon_farm_pending',
};

export function saveToLocalStorage<T>(key: string, data: T): void {
  try {
    const serialized = JSON.stringify(data);
    localStorage.setItem(key, serialized);
  } catch (error) {
    console.error('保存到LocalStorage失败:', error);
    throw new Error('数据持久化失败，请检查浏览器存储权限');
  }
}

export function loadFromLocalStorage<T>(key: string, defaultValue: T): T {
  try {
    const serialized = localStorage.getItem(key);
    if (serialized === null) {
      return defaultValue;
    }
    return JSON.parse(serialized) as T;
  } catch (error) {
    console.error('从LocalStorage加载失败:', error);
    return defaultValue;
  }
}

export function removeFromLocalStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error('删除LocalStorage数据失败:', error);
  }
}

export function saveSnapshot(snapshot: GameSnapshot): void {
  const snapshots = loadFromLocalStorage<GameSnapshot[]>(STORAGE_KEYS.SNAPSHOTS, []);
  const existingIndex = snapshots.findIndex(
    (s) => s.game.currentRound === snapshot.game.currentRound
  );
  if (existingIndex >= 0) {
    snapshots[existingIndex] = snapshot;
  } else {
    snapshots.push(snapshot);
  }
  saveToLocalStorage(STORAGE_KEYS.SNAPSHOTS, snapshots);
}

export function loadSnapshot(roundNumber: number): GameSnapshot | null {
  const snapshots = loadFromLocalStorage<GameSnapshot[]>(STORAGE_KEYS.SNAPSHOTS, []);
  return snapshots.find((s) => s.game.currentRound === roundNumber) || null;
}

export function loadAllSnapshots(): GameSnapshot[] {
  return loadFromLocalStorage<GameSnapshot[]>(STORAGE_KEYS.SNAPSHOTS, []);
}

export function clearAllSnapshots(): void {
  removeFromLocalStorage(STORAGE_KEYS.SNAPSHOTS);
}

export function clearAllData(): void {
  Object.values(STORAGE_KEYS).forEach((key) => removeFromLocalStorage(key));
}
