import { LevelConfig } from '../types';

export const LEVELS: LevelConfig[] = [
  {
    id: 1,
    name: '新手仓库',
    description: '学习基础的化学品分类摆放，掌握常见禁忌相邻规则。',
    difficulty: 1,
    timeLimit: 120,
    baseScore: 1000,
    chemicalIds: [
      'ethanol',
      'acetone',
      'h2so4',
      'hcl',
      'naoh',
      'ca_oh_2',
      'kmno4',
      'co2'
    ],
    environment: {
      initialTemperature: 22,
      initialHumidity: 55,
      temperatureFluctuation: false
    },
    zones: [],
    targetScore: 1200
  },
  {
    id: 2,
    name: '标准仓储',
    description: '引入温湿度控制和隔离距离要求，处理更多种类的化学品。',
    difficulty: 2,
    timeLimit: 180,
    baseScore: 1000,
    chemicalIds: [
      'ethanol',
      'acetone',
      'gasoline',
      'h2so4',
      'hcl',
      'naoh',
      'kmno4',
      'h2o2',
      'nh3',
      'co2',
      'lpg',
      'ca_oh_2'
    ],
    environment: {
      initialTemperature: 24,
      initialHumidity: 60,
      temperatureFluctuation: true
    },
    zones: [
      { row: 0, col: 0, type: 'refrigerated' },
      { row: 0, col: 1, type: 'refrigerated' }
    ],
    targetScore: 1400
  },
  {
    id: 3,
    name: '高危仓库',
    description: '处理爆炸品、剧毒等高危化学品，需要使用特殊存储区域。',
    difficulty: 3,
    timeLimit: 240,
    baseScore: 1000,
    chemicalIds: [
      'picric_acid',
      'nitroglycerin',
      'ethanol',
      'gasoline',
      'acetone',
      'h2so4',
      'hcl',
      'naoh',
      'kmno4',
      'h2o2',
      'kcn',
      'as2o3',
      'nh3',
      'lpg',
      'co2',
      'ca_oh_2'
    ],
    environment: {
      initialTemperature: 20,
      initialHumidity: 50,
      temperatureFluctuation: true
    },
    zones: [
      { row: 0, col: 0, type: 'explosion_proof' },
      { row: 0, col: 1, type: 'explosion_proof' },
      { row: 0, col: 2, type: 'refrigerated' },
      { row: 0, col: 3, type: 'refrigerated' },
      { row: 3, col: 4, type: 'toxic' },
      { row: 3, col: 5, type: 'toxic' }
    ],
    targetScore: 1600
  }
];

export const getLevelById = (id: number): LevelConfig | undefined => {
  return LEVELS.find(l => l.id === id);
};
