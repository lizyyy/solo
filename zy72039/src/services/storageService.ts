import type { GameState, GameRecord } from '../types';

const STORAGE_KEY = 'bridge-load-game-state';
const RECORDS_KEY = 'bridge-load-game-records';

export function saveState(state: GameState): void {
  try {
    const stateToSave = {
      ...state,
      config: state.config,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
  } catch (error) {
    console.error('保存游戏状态失败:', error);
  }
}

export function loadState(): GameState | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    return JSON.parse(saved) as GameState;
  } catch (error) {
    console.error('加载游戏状态失败:', error);
    return null;
  }
}

export function saveRecords(records: GameRecord[]): void {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  } catch (error) {
    console.error('保存记录失败:', error);
  }
}

export function loadRecords(): GameRecord[] {
  try {
    const saved = localStorage.getItem(RECORDS_KEY);
    if (!saved) return [];
    return JSON.parse(saved) as GameRecord[];
  } catch (error) {
    console.error('加载记录失败:', error);
    return [];
  }
}

export function clearStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(RECORDS_KEY);
  } catch (error) {
    console.error('清除存储失败:', error);
  }
}

export function exportToJson(state: GameState): string {
  const exportData = {
    exportVersion: '1.0',
    exportTime: new Date().toISOString(),
    gameState: state,
    records: state.records,
  };
  return JSON.stringify(exportData, null, 2);
}

export function downloadJson(data: string, filename: string): void {
  try {
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('下载JSON失败:', error);
    throw error;
  }
}
