import type { LevelConfig } from './types';

export const LEVELS: LevelConfig[] = [
  {
    id: 'level1',
    name: '新手训练',
    difficulty: 1,
    orderCount: 20,
    allergenRatio: 0.1,
    windowCount: 2,
    durationSeconds: 180,
    targetScore: 200,
    description: '适合首次接触备餐流程的新人，订单量少，过敏原比例低',
  },
  {
    id: 'level2',
    name: '进阶挑战',
    difficulty: 2,
    orderCount: 40,
    allergenRatio: 0.25,
    windowCount: 3,
    durationSeconds: 300,
    targetScore: 500,
    description: '中等难度，需要合理分配备餐和取餐时间',
  },
  {
    id: 'level3',
    name: '高峰时段',
    difficulty: 3,
    orderCount: 60,
    allergenRatio: 0.35,
    windowCount: 4,
    durationSeconds: 420,
    targetScore: 800,
    description: '模拟午餐高峰，大量订单涌入，需高效分配取餐窗口',
  },
  {
    id: 'level4',
    name: '过敏演练',
    difficulty: 3,
    orderCount: 30,
    allergenRatio: 0.5,
    windowCount: 2,
    durationSeconds: 240,
    targetScore: 400,
    description: '高过敏原比例，重点训练过敏餐识别和规避',
  },
];

export const GRADE_COLORS: Record<number, string> = {
  1: '#3498DB',
  2: '#E67E22',
  3: '#9B59B6',
};

export const GRADE_NAMES: Record<number, string> = {
  1: '一年级',
  2: '二年级',
  3: '三年级',
};