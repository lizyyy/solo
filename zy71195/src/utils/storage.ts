import { GameHistory } from '../types';
import { STORAGE_KEYS } from '../data/constants';

export function getGameHistory(): GameHistory[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.GAME_HISTORY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveGameHistory(history: GameHistory): void {
  try {
    const histories = getGameHistory();
    histories.unshift(history);
    const limitedHistories = histories.slice(0, 50);
    localStorage.setItem(STORAGE_KEYS.GAME_HISTORY, JSON.stringify(limitedHistories));
  } catch {
    console.error('Failed to save game history');
  }
}

export function clearGameHistory(): void {
  localStorage.removeItem(STORAGE_KEYS.GAME_HISTORY);
}

export function getBestScores(): Record<number, number> {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.BEST_SCORES);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export function saveBestScore(levelId: number, score: number): void {
  try {
    const bestScores = getBestScores();
    if (!bestScores[levelId] || score > bestScores[levelId]) {
      bestScores[levelId] = score;
      localStorage.setItem(STORAGE_KEYS.BEST_SCORES, JSON.stringify(bestScores));
    }
  } catch {
    console.error('Failed to save best score');
  }
}

export function getUnlockedLevels(): number[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.UNLOCKED_LEVELS);
    return data ? JSON.parse(data) : [1];
  } catch {
    return [1];
  }
}

export function unlockLevel(levelId: number): void {
  try {
    const unlocked = getUnlockedLevels();
    if (!unlocked.includes(levelId)) {
      unlocked.push(levelId);
      localStorage.setItem(STORAGE_KEYS.UNLOCKED_LEVELS, JSON.stringify(unlocked));
    }
  } catch {
    console.error('Failed to unlock level');
  }
}

export function deleteHistoryRecord(id: string): void {
  try {
    const histories = getGameHistory();
    const filtered = histories.filter(h => h.id !== id);
    localStorage.setItem(STORAGE_KEYS.GAME_HISTORY, JSON.stringify(filtered));
  } catch {
    console.error('Failed to delete history record');
  }
}
