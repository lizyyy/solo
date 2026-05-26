import { Level } from '../types';

export const levels: Level[] = [
  {
    id: 'level-1',
    name: '新手训练营',
    difficulty: 'easy',
    description: '入门关卡：水质稳定，药剂效果明显，学习基本投加操作。无反弹效应，适合新手熟悉操作。',
    maxRounds: 8,
    initialWaterQuality: {
      cod: 150,
      nh3n: 25,
      tp: 4,
      ph: 7.2
    },
    targetThresholds: {
      cod: 50,
      nh3n: 8,
      tp: 0.5,
      ph: 7.5
    },
    chemicalCost: 10,
    stirringCostPerSecond: 1,
    parameters: {
      chemicalEfficiency: 0.85,
      reboundFactor: 0,
      minStirringTime: 3,
      maxChemicalDose: 100,
      incomingWaterVariation: 0.05,
      optimalDosePerUnit: {
        cod: 0.4,
        nh3n: 1.5,
        tp: 8
      }
    }
  },
  {
    id: 'level-2',
    name: '反弹挑战',
    difficulty: 'medium',
    description: '进阶关卡：超量投加会导致指标反弹。需要精确控制药剂投加量，避免过度投加造成成本浪费和水质反弹。',
    maxRounds: 10,
    initialWaterQuality: {
      cod: 200,
      nh3n: 35,
      tp: 6,
      ph: 7.5
    },
    targetThresholds: {
      cod: 50,
      nh3n: 8,
      tp: 0.5,
      ph: 7.5
    },
    chemicalCost: 12,
    stirringCostPerSecond: 1.5,
    parameters: {
      chemicalEfficiency: 0.75,
      reboundFactor: 0.15,
      minStirringTime: 5,
      maxChemicalDose: 120,
      incomingWaterVariation: 0.1,
      optimalDosePerUnit: {
        cod: 0.5,
        nh3n: 1.8,
        tp: 10
      }
    }
  },
  {
    id: 'level-3',
    name: '波动工况',
    difficulty: 'hard',
    description: '专家关卡：进水水质波动大，反弹效应明显，搅拌时间要求严格。考验玩家对复杂工况的判断和应变能力。',
    maxRounds: 12,
    initialWaterQuality: {
      cod: 280,
      nh3n: 50,
      tp: 8,
      ph: 7.8
    },
    targetThresholds: {
      cod: 50,
      nh3n: 8,
      tp: 0.5,
      ph: 7.5
    },
    chemicalCost: 15,
    stirringCostPerSecond: 2,
    parameters: {
      chemicalEfficiency: 0.65,
      reboundFactor: 0.25,
      minStirringTime: 7,
      maxChemicalDose: 150,
      incomingWaterVariation: 0.2,
      optimalDosePerUnit: {
        cod: 0.6,
        nh3n: 2.2,
        tp: 12
      }
    }
  }
];

export const getLevelById = (id: string): Level | undefined => {
  return levels.find(level => level.id === id);
};

export const getDifficultyColor = (difficulty: string): string => {
  switch (difficulty) {
    case 'easy': return 'text-green-500';
    case 'medium': return 'text-yellow-500';
    case 'hard': return 'text-red-500';
    default: return 'text-gray-500';
  }
};

export const getDifficultyLabel = (difficulty: string): string => {
  switch (difficulty) {
    case 'easy': return '简单';
    case 'medium': return '中等';
    case 'hard': return '困难';
    default: return '未知';
  }
};
