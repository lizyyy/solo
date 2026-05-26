import type { LevelConfig, ToolConfig, ToolType } from './types';

export const TOOL_CONFIG: Record<ToolType, ToolConfig> = {
  inspect: {
    cost: 1,
    name: '巡检',
    icon: '🔍',
    description: '检查排水口或低洼区，发现隐藏隐患',
    shortcut: '1',
  },
  unclog: {
    cost: 2,
    name: '疏通',
    icon: '🔧',
    description: '疏通堵塞的排水口，恢复排水能力',
    shortcut: '2',
  },
  pump: {
    cost: 3,
    name: '抽水',
    icon: '💧',
    description: '抽取低洼区积水，防止溢出',
    shortcut: '3',
  },
  reinforce: {
    cost: 2,
    name: '加固',
    icon: '🛡️',
    description: '加固薄弱区域，临时提升排水能力',
    shortcut: '4',
  },
};

export const LEVELS: LevelConfig[] = [
  {
    id: 1,
    name: '新手训练',
    difficulty: 'easy',
    roofSize: { width: 10, height: 8 },
    drainCount: 4,
    lowAreaCount: 2,
    obstacleCount: 3,
    initialBlockageChance: 0.4,
    totalRounds: 5,
    maxActionPoints: 8,
    rainfallPattern: [20, 30, 40, 50, 60],
    description: '适合新人上手，学习基本巡检流程',
  },
  {
    id: 2,
    name: '常规巡检',
    difficulty: 'easy',
    roofSize: { width: 12, height: 10 },
    drainCount: 6,
    lowAreaCount: 3,
    obstacleCount: 5,
    initialBlockageChance: 0.5,
    totalRounds: 6,
    maxActionPoints: 10,
    rainfallPattern: [25, 35, 45, 55, 65, 75],
    description: '标准屋顶巡检任务',
  },
  {
    id: 3,
    name: '雨季预警',
    difficulty: 'medium',
    roofSize: { width: 14, height: 12 },
    drainCount: 8,
    lowAreaCount: 4,
    obstacleCount: 6,
    initialBlockageChance: 0.6,
    totalRounds: 7,
    maxActionPoints: 12,
    rainfallPattern: [40, 50, 60, 70, 80, 85, 90],
    description: '雨季来临，需要更高效的巡检',
  },
  {
    id: 4,
    name: '暴雨将至',
    difficulty: 'medium',
    roofSize: { width: 16, height: 14 },
    drainCount: 10,
    lowAreaCount: 5,
    obstacleCount: 8,
    initialBlockageChance: 0.7,
    totalRounds: 8,
    maxActionPoints: 14,
    rainfallPattern: [50, 60, 70, 80, 90, 95, 100, 100],
    description: '特大暴雨即将来临，时间紧迫',
  },
  {
    id: 5,
    name: '紧急抢修',
    difficulty: 'hard',
    roofSize: { width: 18, height: 16 },
    drainCount: 12,
    lowAreaCount: 6,
    obstacleCount: 10,
    initialBlockageChance: 0.8,
    totalRounds: 6,
    maxActionPoints: 12,
    rainfallPattern: [60, 75, 90, 100, 100, 100],
    description: '多处隐患，行动点数有限，需要精准判断',
  },
];

export const GAME_CONSTANTS = {
  BASE_FLOW_RATE: 10,
  BLOCKED_FLOW_PENALTY: 0.3,
  WATER_LEVEL_PER_RAIN: 5,
  LEAK_THRESHOLD: 90,
  INSPECTION_SCORE_PER_DRAIN: 10,
  RESOLUTION_SCORE_PER_BLOCKAGE: 20,
  RESOLUTION_SCORE_PER_FLOOD: 15,
  EFFICIENCY_SCORE_PER_AP: 5,
  LEAK_PENALTY: 50,
  MAX_WATER_LEVEL: 100,
  MIN_DRAIN_DISTANCE: 2,
  MIN_LOWAREA_DISTANCE: 3,
} as const;

export const RAIN_INTENSITY_LABELS: Record<number, string> = {
  0: '无雨',
  20: '小雨',
  40: '中雨',
  60: '大雨',
  80: '暴雨',
  100: '特大暴雨',
};

export const getRainIntensityLabel = (intensity: number): string => {
  if (intensity <= 10) return RAIN_INTENSITY_LABELS[0];
  if (intensity <= 30) return RAIN_INTENSITY_LABELS[20];
  if (intensity <= 50) return RAIN_INTENSITY_LABELS[40];
  if (intensity <= 70) return RAIN_INTENSITY_LABELS[60];
  if (intensity <= 90) return RAIN_INTENSITY_LABELS[80];
  return RAIN_INTENSITY_LABELS[100];
};

export const getGradeFromScore = (score: number): 'S' | 'A' | 'B' | 'C' | 'D' | 'F' => {
  if (score >= 900) return 'S';
  if (score >= 800) return 'A';
  if (score >= 700) return 'B';
  if (score >= 600) return 'C';
  if (score >= 400) return 'D';
  return 'F';
};
