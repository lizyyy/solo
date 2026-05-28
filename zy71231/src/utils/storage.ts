import type { GameState, GameHistory } from '../types/game';
import { calculateGameStats } from './gameLogic';

const GAME_STATE_KEY = 'vinyl_store_game_state';
const GAME_HISTORY_KEY = 'vinyl_store_game_history';

export const saveGameState = (state: GameState): void => {
  try {
    const stateToSave = { ...state, lastSavedAt: Date.now() };
    localStorage.setItem(GAME_STATE_KEY, JSON.stringify(stateToSave));
  } catch (error) {
    console.error('保存游戏状态失败:', error);
  }
};

export const loadGameState = (): GameState | null => {
  try {
    const saved = localStorage.getItem(GAME_STATE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
    return null;
  } catch (error) {
    console.error('加载游戏状态失败:', error);
    return null;
  }
};

export const clearGameState = (): void => {
  localStorage.removeItem(GAME_STATE_KEY);
};

export const saveToHistory = (state: GameState): void => {
  try {
    const stats = calculateGameStats(state);
    const history = loadGameHistory();
    
    const historyEntry = {
      gameId: state.gameId,
      date: state.lastSavedAt,
      finalCash: state.cash,
      totalDays: state.day - 1,
      profit: stats.profit,
      isWin: stats.isWin
    };

    const existingIndex = history.games.findIndex(g => g.gameId === state.gameId);
    if (existingIndex >= 0) {
      history.games[existingIndex] = historyEntry;
    } else {
      history.games.unshift(historyEntry);
    }

    history.games = history.games.slice(0, 50);
    localStorage.setItem(GAME_HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    console.error('保存游戏历史失败:', error);
  }
};

export const loadGameHistory = (): GameHistory => {
  try {
    const saved = localStorage.getItem(GAME_HISTORY_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
    return { games: [] };
  } catch (error) {
    console.error('加载游戏历史失败:', error);
    return { games: [] };
  }
};

export const saveFullGameRecord = (state: GameState): void => {
  try {
    const key = `vinyl_store_game_record_${state.gameId}`;
    localStorage.setItem(key, JSON.stringify(state));
  } catch (error) {
    console.error('保存完整游戏记录失败:', error);
  }
};

export const loadFullGameRecord = (gameId: string): GameState | null => {
  try {
    const key = `vinyl_store_game_record_${gameId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      return JSON.parse(saved);
    }
    return null;
  } catch (error) {
    console.error('加载完整游戏记录失败:', error);
    return null;
  }
};

export const exportGameData = (state: GameState): string => {
  const exportData = {
    gameId: state.gameId,
    exportedAt: new Date().toISOString(),
    gameState: state,
    summary: calculateGameStats(state)
  };
  return JSON.stringify(exportData, null, 2);
};

export const downloadGameReport = (state: GameState): void => {
  const data = exportGameData(state);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vinyl_store_report_${state.gameId}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
