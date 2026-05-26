import type { GameRecord } from '../types';

const RECORDS_KEY = 'inspection_game_records';

export function getGameRecords(): GameRecord[] {
  try {
    const data = localStorage.getItem(RECORDS_KEY);
    if (!data) return [];
    return JSON.parse(data) as GameRecord[];
  } catch {
    return [];
  }
}

export function saveGameRecord(record: GameRecord): void {
  try {
    const records = getGameRecords();
    records.push(record);
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  } catch (error) {
    console.error('Failed to save game record:', error);
  }
}

export function getHighScore(levelId: string): number {
  const records = getGameRecords();
  const levelRecords = records.filter(r => r.levelId === levelId);
  if (levelRecords.length === 0) return 0;
  return Math.max(...levelRecords.map(r => r.score));
}

export function getLevelRecords(levelId: string): GameRecord[] {
  const records = getGameRecords();
  return records
    .filter(r => r.levelId === levelId)
    .sort((a, b) => b.score - a.score);
}

export function clearRecords(): void {
  localStorage.removeItem(RECORDS_KEY);
}
