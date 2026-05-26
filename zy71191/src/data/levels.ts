import type { LevelConfig } from '@/types/game';

export const LEVELS: LevelConfig[] = [
  {
    id: 1,
    name: '小型单展位',
    description: '单个展位的搭建任务，适合熟悉操作流程',
    boothCount: 1,
    crewCount: 2,
    maxTurns: 20,
    materialDelayChance: 0.1,
    difficulty: 'easy',
  },
  {
    id: 2,
    name: '中型双展位',
    description: '两个展位同时施工，需要合理分配施工队',
    boothCount: 2,
    crewCount: 3,
    maxTurns: 25,
    materialDelayChance: 0.2,
    difficulty: 'medium',
  },
  {
    id: 3,
    name: '大型多展位',
    description: '四个展位的复杂项目，考验排程能力',
    boothCount: 4,
    crewCount: 4,
    maxTurns: 30,
    materialDelayChance: 0.3,
    difficulty: 'hard',
  },
];

export const CREW_NAMES = ['施工队 A', '施工队 B', '施工队 C', '施工队 D'];
export const BOOTH_NAMES = ['展位 1', '展位 2', '展位 3', '展位 4'];

export const MATERIAL_NAMES = {
  utilities: ['电缆线盘', '配电箱', '水管接头'],
  structure: ['铝型材', '展板', '连接件'],
  fire: ['灭火器', '烟雾报警器', '应急指示灯'],
} as const;
