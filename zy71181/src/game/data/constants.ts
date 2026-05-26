import { InjurySeverity } from '../types';

export const INJURY_SCORES: Record<InjurySeverity, number> = {
  minor: 100,
  moderate: 200,
  severe: 350,
  critical: 500,
};

export const INJURY_NAMES: Record<InjurySeverity, string> = {
  minor: '轻伤',
  moderate: '中度伤',
  severe: '重伤',
  critical: '危重伤',
};

export const WEATHER_NAMES: Record<string, string> = {
  clear: '晴天',
  light_snow: '小雪',
  heavy_snow: '大雪',
  blizzard: '暴风雪',
};

export const WEATHER_SPEED_PENALTY: Record<string, number> = {
  clear: 1.0,
  light_snow: 0.9,
  heavy_snow: 0.7,
  blizzard: 0.5,
};

export const WEATHER_VISIBILITY: Record<string, number> = {
  clear: 1.0,
  light_snow: 0.8,
  heavy_snow: 0.5,
  blizzard: 0.3,
};

export const SLOPE_NAMES: Record<string, string> = {
  green: '初级道',
  blue: '中级道',
  black: '高级道',
  double_black: '专家道',
};

export const EQUIPMENT_SPEED_BONUS = 50;
export const BASE_SCORE = 0;
export const EQUIPMENT_MATCH_BONUS = 50;
export const DETERIORATION_PENALTY = 100;
export const RESCUE_FAILURE_PENALTY = 200;

export const SNAPSHOT_INTERVAL = 5000;
export const REPLAY_MAX_STORAGE = 20;
