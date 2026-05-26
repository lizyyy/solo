import { GameHistory, LevelProgress, GameState, Level } from './types';
import { STORAGE_KEYS, MAX_HISTORY } from './constants';
import { CostCalculator } from './calculator';

export class HistoryRecorder {
  static saveHistory(history: GameHistory): void {
    const existing = this.getHistory();
    existing.unshift(history);
    
    if (existing.length > MAX_HISTORY) {
      existing.pop();
    }
    
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(existing));
  }

  static getHistory(): GameHistory[] {
    const data = localStorage.getItem(STORAGE_KEYS.HISTORY);
    if (!data) return [];
    
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  static getHistoryByLevel(levelId: number): GameHistory[] {
    return this.getHistory().filter(h => h.levelId === levelId);
  }

  static getHistoryById(id: string): GameHistory | undefined {
    return this.getHistory().find(h => h.id === id);
  }

  static saveLevelProgress(
    levelId: number,
    result: { isWin: boolean; score: string; stars: number; finalCost: number }
  ): void {
    const progress = this.getLevelProgress();
    
    const existing = progress[levelId];
    const currentStars = CostCalculator.calculateStars(result.score);
    
    if (!existing || 
        result.finalCost < existing.bestCost ||
        currentStars > existing.stars) {
      progress[levelId] = {
        completed: result.isWin || existing?.completed || false,
        bestScore: !existing || currentStars > existing.stars ? result.score : existing.bestScore,
        bestCost: !existing || result.finalCost < existing.bestCost ? result.finalCost : existing.bestCost,
        stars: Math.max(existing?.stars || 0, currentStars)
      };
      
      localStorage.setItem(STORAGE_KEYS.LEVEL_PROGRESS, JSON.stringify(progress));
    }
  }

  static getLevelProgress(): Record<number, LevelProgress> {
    const data = localStorage.getItem(STORAGE_KEYS.LEVEL_PROGRESS);
    if (!data) return {};
    
    try {
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  static getLevelProgressById(levelId: number): LevelProgress | undefined {
    return this.getLevelProgress()[levelId];
  }

  static createHistoryFromGameState(
    state: GameState,
    level: Level,
    result: { isWin: boolean; score: string; stars: number }
  ): GameHistory {
    return {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      levelId: level.id,
      timestamp: Date.now(),
      finalCost: Math.floor(state.costs.total),
      targetCost: level.targetCost,
      score: result.score,
      scheduledOrders: [...state.scheduledOrders],
      events: [...state.events],
      isWin: result.isWin
    };
  }
}
