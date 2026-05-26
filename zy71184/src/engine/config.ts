import { RainIntensity } from './types';

export const CONFIG = {
  GRID_SIZE: 10,
  CELL_SIZE: 10,
  MAX_TURNS: 15,
  WATER_FLOW_RATE: 0.8,
  DRAIN_BASE_CAPACITY: 10,
  PUMP_BASE_POWER: 15,
  BLOCKAGE_GROWTH_RATE: 0.15,
  OVERLOAD_THRESHOLD: 0.9,
  OVERLOAD_DAMAGE_THRESHOLD: 3,
  LOWLAND_DANGER_THRESHOLD: 8,
  LOWLAND_FAIL_THRESHOLD: 3,
  FLOOD_FAIL_PERCENT: 0.5,
  FLOOD_FAIL_DURATION: 2,
  
  SCORE_PER_TURN: 100,
  SCORE_CLEAR_BLOCKAGE: 50,
  SCORE_PUMP_EFFICIENT: 30,
  SCORE_FLOOD_PENALTY: -50,
  SCORE_FACILITY_BROKEN: -200,
  SCORE_PREPARE_BONUS: 100,

  RAIN_INTENSITY_MAP: {
    light: { rainfall: 2, color: '#87CEEB', name: '小雨' },
    moderate: { rainfall: 4, color: '#4169E1', name: '中雨' },
    heavy: { rainfall: 7, color: '#1E90FF', name: '大雨' },
    storm: { rainfall: 12, color: '#000080', name: '暴雨' },
  } as Record<RainIntensity, { rainfall: number; color: string; name: string }>,
};

export const COLORS = {
  primary: '#165DFF',
  primaryDark: '#0E42D2',
  warning: '#FF7D00',
  danger: '#F53F3F',
  success: '#00B42A',
  building: '#4E5969',
  road: '#C9CDD4',
  water: 'rgba(22, 93, 255, 0.6)',
  waterDeep: 'rgba(14, 66, 210, 0.8)',
  lowland: '#9CA3AF',
  gridLine: '#E5E6EB',
};
