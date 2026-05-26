import type { LevelConfig, ScoreRule } from '../types';

export const LEVELS: LevelConfig[] = [
  {
    id: 1,
    name: '新手仓库',
    difficulty: 'easy',
    timeLimit: 120,
    mapSize: { width: 16, height: 12 },
    hazardCount: 3,
    normalItemCount: 4,
    shelfCount: 6,
    description: '熟悉仓库环境，学习识别基础消防隐患'
  },
  {
    id: 2,
    name: '标准仓库',
    difficulty: 'medium',
    timeLimit: 150,
    mapSize: { width: 20, height: 14 },
    hazardCount: 5,
    normalItemCount: 6,
    shelfCount: 10,
    description: '更大的仓库，更多的隐患需要发现'
  },
  {
    id: 3,
    name: '大型物流中心',
    difficulty: 'hard',
    timeLimit: 180,
    mapSize: { width: 24, height: 16 },
    hazardCount: 8,
    normalItemCount: 8,
    shelfCount: 14,
    description: '复杂环境，考验你的巡检能力'
  }
];

export const SCORE_RULES: ScoreRule = {
  baseScore: 1000,
  correctMark: 100,
  wrongMark: -50,
  duplicateMark: -30,
  overtimePerSecond: -10,
  timeBonusPerSecond: 2,
  missedHazard: -100,
  resourceWaste: -30
};

export const HAZARD_DESCRIPTIONS: Record<string, { name: string; hazard: boolean }> = {
  'blocked_path': { name: '通道堵塞', hazard: true },
  'expired_extinguisher': { name: '过期灭火器', hazard: true },
  'illegal_charging': { name: '违规充电', hazard: true },
  'normal_extinguisher': { name: '正常灭火器', hazard: false },
  'normal_charging': { name: '正常充电点', hazard: false },
  'empty_path': { name: '正常通道', hazard: false }
};
