import { Level, WeatherType } from './types';

export const LEVELS: Level[] = [
  {
    id: 1,
    name: '入门：初识水渠',
    description: '学习基本的阀门操作，让水流到达唯一的地块',
    boardSize: { rows: 5, cols: 5 },
    initialWater: 20,
    maxRounds: 5,
    targetScore: 80,
    weatherPool: ['sunny', 'sunny', 'cloudy', 'sunny', 'cloudy'] as WeatherType[],
    boardLayout: [
      ['source', 'canal-h', 'canal-h', 'canal-h', 'plot-rice'],
      [null, null, null, null, null],
      [null, null, null, null, null],
      [null, null, null, null, null],
      [null, null, null, null, null],
    ],
  },
  {
    id: 2,
    name: '初级：学会分流水',
    description: '使用阀门控制水流方向，同时灌溉两块农田',
    boardSize: { rows: 6, cols: 6 },
    initialWater: 30,
    maxRounds: 6,
    targetScore: 150,
    weatherPool: ['sunny', 'cloudy', 'sunny', 'rainy', 'sunny', 'cloudy'] as WeatherType[],
    boardLayout: [
      [null, null, 'source', null, null, null],
      [null, null, 'canal-v', null, null, null],
      [null, null, 'valve-h', 'canal-h', 'canal-h', 'plot-wheat'],
      [null, null, 'canal-v', null, null, null],
      [null, null, 'canal-v', null, null, null],
      [null, null, 'plot-corn', null, null, null],
    ],
  },
  {
    id: 3,
    name: '中级：多地块管理',
    description: '管理多个阀门，避免下游断水和重复灌溉',
    boardSize: { rows: 7, cols: 7 },
    initialWater: 50,
    maxRounds: 8,
    targetScore: 250,
    weatherPool: ['sunny', 'drought', 'sunny', 'cloudy', 'rainy', 'sunny', 'cloudy', 'sunny'] as WeatherType[],
    boardLayout: [
      ['source', 'canal-h', 'valve-h', 'canal-h', 'canal-h', 'canal-h', 'plot-rice'],
      [null, null, 'canal-v', null, null, null, null],
      [null, null, 'canal-v', null, null, null, null],
      [null, null, 'valve-h', 'canal-h', 'canal-h', 'plot-vegetable', null],
      [null, null, 'canal-v', null, null, null, null],
      [null, null, 'canal-v', null, null, null, null],
      [null, null, 'plot-wheat', null, null, null, null],
    ],
  },
  {
    id: 4,
    name: '高级：复杂水网',
    description: '在复杂的水渠网络中优化灌溉策略',
    boardSize: { rows: 8, cols: 8 },
    initialWater: 80,
    maxRounds: 10,
    targetScore: 400,
    weatherPool: ['sunny', 'cloudy', 'drought', 'sunny', 'rainy', 'sunny', 'cloudy', 'sunny', 'drought', 'sunny'] as WeatherType[],
    boardLayout: [
      ['source', 'canal-h', 'canal-h', 'valve-h', 'canal-h', 'canal-h', 'plot-rice', null],
      [null, null, null, 'canal-v', null, null, null, null],
      [null, null, null, 'valve-h', 'canal-h', 'canal-h', 'canal-h', 'plot-wheat'],
      [null, null, null, 'canal-v', null, null, null, null],
      [null, null, null, 'canal-v', null, null, null, null],
      [null, 'plot-vegetable', 'canal-h', 'valve-h', 'canal-h', 'canal-h', 'plot-corn', null],
      [null, null, null, 'canal-v', null, null, null, null],
      [null, null, null, 'plot-rice', null, null, null, null],
    ],
  },
  {
    id: 5,
    name: '专家：极限挑战',
    description: '干旱天气频发，精准控制每一滴水',
    boardSize: { rows: 8, cols: 8 },
    initialWater: 60,
    maxRounds: 10,
    targetScore: 500,
    weatherPool: ['drought', 'sunny', 'drought', 'sunny', 'cloudy', 'drought', 'sunny', 'rainy', 'drought', 'sunny'] as WeatherType[],
    boardLayout: [
      ['source', 'valve-h', 'canal-h', 'canal-h', 'valve-h', 'canal-h', 'plot-rice', null],
      [null, 'canal-v', null, null, 'canal-v', null, null, null],
      [null, 'valve-h', 'canal-h', 'plot-wheat', 'valve-h', 'canal-h', 'canal-h', 'plot-corn'],
      [null, 'canal-v', null, null, 'canal-v', null, null, null],
      [null, 'canal-v', null, null, 'canal-v', null, null, null],
      [null, 'valve-h', 'canal-h', 'canal-h', 'valve-h', 'canal-h', 'plot-vegetable', null],
      [null, 'canal-v', null, null, null, null, null, null],
      [null, 'plot-rice', null, null, null, null, null, null],
    ],
  },
];

export function getLevelById(id: number): Level | undefined {
  return LEVELS.find(level => level.id === id);
}

export function getTotalLevels(): number {
  return LEVELS.length;
}
