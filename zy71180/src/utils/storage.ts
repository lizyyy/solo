import { GameHistory } from '../types/game';

const HISTORY_KEY = 'kitchen_oil_game_history';
const MAX_HISTORY_ITEMS = 50;

export const saveGameHistory = (history: GameHistory): void => {
  try {
    const allHistory = loadGameHistory();
    allHistory.unshift(history);
    
    if (allHistory.length > MAX_HISTORY_ITEMS) {
      allHistory.splice(MAX_HISTORY_ITEMS);
    }
    
    localStorage.setItem(HISTORY_KEY, JSON.stringify(allHistory));
  } catch (error) {
    console.error('Failed to save game history:', error);
  }
};

export const loadGameHistory = (): GameHistory[] => {
  try {
    const data = localStorage.getItem(HISTORY_KEY);
    if (data) {
      return JSON.parse(data) as GameHistory[];
    }
    return [];
  } catch (error) {
    console.error('Failed to load game history:', error);
    return [];
  }
};

export const getGameHistoryById = (id: string): GameHistory | undefined => {
  const allHistory = loadGameHistory();
  return allHistory.find(h => h.id === id);
};

export const clearGameHistory = (): void => {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch (error) {
    console.error('Failed to clear game history:', error);
  }
};

export const generateGameId = (): string => {
  const now = new Date();
  const timestamp = now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0') + '_' +
    now.getHours().toString().padStart(2, '0') +
    now.getMinutes().toString().padStart(2, '0') +
    now.getSeconds().toString().padStart(2, '0');
  return `game_${timestamp}_${Math.random().toString(36).substr(2, 6)}`;
};
