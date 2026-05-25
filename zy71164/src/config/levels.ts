import type { LevelConfig, ScanConfig } from '@/types/game';

const baseScanConfigs: Record<string, ScanConfig> = {
  active: {
    type: 'active',
    name: '主动扫描',
    energyCost: 5,
    cooldown: 3,
    range: 3,
    accuracy: 0.9,
    description: '3x3范围高精度扫描，能量消耗中等',
    icon: '📡',
  },
  fan: {
    type: 'fan',
    name: '扇形扫描',
    energyCost: 8,
    cooldown: 2,
    range: 6,
    accuracy: 0.7,
    description: '60度扇形远距离扫描，精度中等',
    icon: '🔍',
  },
  passive: {
    type: 'passive',
    name: '被动监听',
    energyCost: 0,
    cooldown: 1,
    range: 99,
    accuracy: 0.4,
    description: '全图被动监听，不消耗能量但精度低',
    icon: '👂',
  },
  attack: {
    type: 'attack',
    name: '深水炸弹',
    energyCost: 10,
    cooldown: 1,
    range: 0,
    accuracy: 1.0,
    description: '对选中格子投放深水炸弹',
    icon: '💣',
  },
};

export const levels: LevelConfig[] = [
  {
    id: 'easy',
    name: '初级海域',
    difficulty: 'easy',
    gridSize: 10,
    initialEnergy: 100,
    targetCount: 2,
    noiseSourceCount: 2,
    standardTurns: 20,
    hasCivilianTargets: false,
    description: '10x10海域，2艘敌方潜艇，低噪声干扰，适合新手熟悉操作',
    scanConfigs: {
      active: { ...baseScanConfigs.active },
      fan: { ...baseScanConfigs.fan },
      passive: { ...baseScanConfigs.passive },
      attack: { ...baseScanConfigs.attack },
    },
  },
  {
    id: 'medium',
    name: '中级海域',
    difficulty: 'medium',
    gridSize: 12,
    initialEnergy: 80,
    targetCount: 3,
    noiseSourceCount: 4,
    standardTurns: 25,
    hasCivilianTargets: false,
    description: '12x12海域，3艘敌方潜艇，中等噪声干扰，目标移动更灵活',
    scanConfigs: {
      active: { ...baseScanConfigs.active, cooldown: 4 },
      fan: { ...baseScanConfigs.fan, accuracy: 0.65 },
      passive: { ...baseScanConfigs.passive, accuracy: 0.35 },
      attack: { ...baseScanConfigs.attack },
    },
  },
  {
    id: 'hard',
    name: '高级海域',
    difficulty: 'hard',
    gridSize: 14,
    initialEnergy: 60,
    targetCount: 4,
    noiseSourceCount: 6,
    standardTurns: 30,
    hasCivilianTargets: true,
    description: '14x14海域，4艘敌方潜艇，强噪声干扰，目标规避能力强，注意区分民用目标',
    scanConfigs: {
      active: { ...baseScanConfigs.active, energyCost: 6, cooldown: 4, accuracy: 0.85 },
      fan: { ...baseScanConfigs.fan, energyCost: 10, accuracy: 0.6 },
      passive: { ...baseScanConfigs.passive, accuracy: 0.3 },
      attack: { ...baseScanConfigs.attack, energyCost: 12 },
    },
  },
];

export const getLevelById = (id: string): LevelConfig | undefined => {
  return levels.find(level => level.id === id);
};

export const getDifficultyColor = (difficulty: string): string => {
  switch (difficulty) {
    case 'easy': return 'var(--sonar-green)';
    case 'medium': return 'var(--sonar-amber)';
    case 'hard': return 'var(--sonar-red)';
    default: return 'var(--sonar-green)';
  }
};

export const getDifficultyText = (difficulty: string): string => {
  switch (difficulty) {
    case 'easy': return '初级';
    case 'medium': return '中级';
    case 'hard': return '高级';
    default: return difficulty;
  }
};
