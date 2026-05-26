import type { LevelConfig, PhysicsConfig, ScoreConfig } from './types';

export const PHYSICS_CONFIG: PhysicsConfig = {
  HEAT_RATE: 0.8,
  COP_BASE: 3.5,
  INFILTRATION_RATE: 0.15,
  DIFFUSION_RATE: 0.25,
  HEAT_CAPACITY: 12,
  WARNING_TEMP: 32,
  DANGER_TEMP: 38,
  FAULT_TEMP: 42,
  OVERLOAD_THRESHOLD: 1.2,
  MIGRATE_SUCCESS_RATE: 0.92,
};

export const SCORE_CONFIG: ScoreConfig = {
  SURVIVAL_BONUS: 100,
  TEMP_BONUS_PER_DEGREE: 50,
  TEMP_BONUS_THRESHOLD: 30,
  COST_PENALTY_RATE: 10,
  WARNING_PENALTY: 200,
  BALANCE_BONUS_MAX: 300,
};

export const ELECTRICITY_PRICES = {
  peak: 0.8,
  flat: 0.5,
  valley: 0.2,
};

export const ROOM_DIMENSIONS = {
  width: 16,
  depth: 12,
  height: 4,
};

function generateTempCurve(base: number, variation: number): number[] {
  return Array.from({ length: 24 }, (_, i) => {
    const hour = i;
    const dayVariation = Math.sin(((hour - 6) / 24) * Math.PI * 2) * variation;
    return Math.round((base + dayVariation) * 10) / 10;
  });
}

export const LEVELS: LevelConfig[] = [
  {
    id: 'level-1',
    name: '新手入门',
    description: '学习基础操作：开关空调、调节温度。8个机柜，2台空调，稳定运行24回合。',
    difficulty: 'easy',
    rackCount: 8,
    acCount: 2,
    totalTurns: 24,
    budget: 800,
    initialTemp: 24,
    outdoorTempCurve: generateTempCurve(25, 6),
    peakHours: [10, 11, 12, 13, 14, 15],
    valleyHours: [0, 1, 2, 3, 4, 5],
    eventProbability: 0.05,
    targetScore: 1500,
  },
  {
    id: 'level-2',
    name: '负载均衡',
    description: '学习负载迁移，应对热点扩散。12个机柜，3台空调，注意电价时段优化成本。',
    difficulty: 'medium',
    rackCount: 12,
    acCount: 3,
    totalTurns: 36,
    budget: 1200,
    initialTemp: 25,
    outdoorTempCurve: generateTempCurve(28, 8),
    peakHours: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
    valleyHours: [0, 1, 2, 3, 4, 5, 6],
    eventProbability: 0.1,
    targetScore: 2500,
  },
  {
    id: 'level-3',
    name: '资深运维',
    description: '高温天气+高负载挑战。16个机柜，4台空调，严格控制预算，应对随机故障。',
    difficulty: 'hard',
    rackCount: 16,
    acCount: 4,
    totalTurns: 48,
    budget: 1800,
    initialTemp: 26,
    outdoorTempCurve: generateTempCurve(32, 10),
    peakHours: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    valleyHours: [0, 1, 2, 3, 4, 5],
    eventProbability: 0.15,
    targetScore: 4000,
  },
];

export function getLevelById(id: string): LevelConfig | undefined {
  return LEVELS.find((l) => l.id === id);
}

export function getElectricityPrice(hour: number, level: LevelConfig): { price: number; period: 'peak' | 'flat' | 'valley' } {
  if (level.peakHours.includes(hour)) {
    return { price: ELECTRICITY_PRICES.peak, period: 'peak' };
  }
  if (level.valleyHours.includes(hour)) {
    return { price: ELECTRICITY_PRICES.valley, period: 'valley' };
  }
  return { price: ELECTRICITY_PRICES.flat, period: 'flat' };
}
