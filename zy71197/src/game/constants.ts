import { Level, Mold, Order } from './types';

export const COLORS = {
  primary: '#1e3a5f',
  secondary: '#f59e0b',
  success: '#10b981',
  danger: '#ef4444',
  warning: '#f59e0b',
  dark: '#0f172a',
  light: '#f1f5f9',
  grid: '#334155',
  background: '#1e293b'
};

export const MOLD_COLORS: Record<string, string> = {
  'A': '#3b82f6',
  'B': '#10b981',
  'C': '#f59e0b',
  'D': '#ef4444',
  'E': '#8b5cf6',
  'F': '#ec4899'
};

export const SCORE_RATINGS = ['S', 'A', 'B', 'C', 'D'] as const;

export const STORAGE_KEYS = {
  LEVEL_PROGRESS: 'factory_game_progress',
  HIGH_SCORES: 'factory_game_highscores',
  HISTORY: 'factory_game_history'
};

export const MAX_HISTORY = 20;

export const GAME_SPEEDS = [1, 2, 4] as const;
