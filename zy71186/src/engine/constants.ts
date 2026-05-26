import type { GameConfig } from './types';

export const GAME_CONFIG: GameConfig = {
  tickRate: 100,
  hoursPerTick: 1,
};

export const FAILURE_CONDITIONS = {
  OVERTOPPING_HOURS: 3,
  DOWNSTREAM_DANGER_HOURS: 6,
  DEAD_STORAGE_HOURS: 12,
};

export const SCORE_WEIGHTS = {
  STORAGE: 30,
  DOWNSTREAM: 40,
  EFFICIENCY: 20,
  STABILITY: 10,
};

export const COLORS = {
  water: '#2563eb',
  waterDark: '#1e40af',
  dam: '#6b7280',
  damDark: '#4b5563',
  safety: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  inflow: '#8b5cf6',
  outflow: '#06b6d4',
  storage: '#3b82f6',
};

export const GAME_SPEED_OPTIONS = [0.5, 1, 2, 4];
