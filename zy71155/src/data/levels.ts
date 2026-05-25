import type { Level } from '../types/game';

export const levels: Level[] = [
  {
    id: 'level_1',
    name: '新手入门',
    difficulty: 1,
    timeLimit: 0,
    boxTypeId: 'small',
    commodityIds: ['book', 'clothes', 'shoes', 'book', 'clothes'],
    passScore: 60,
    description: '熟悉基本操作，将5件商品正确放入箱中',
    specialRule: '无重物易碎混装，练习基础操作',
  },
  {
    id: 'level_2',
    name: '小心轻放',
    difficulty: 2,
    timeLimit: 0,
    boxTypeId: 'medium',
    commodityIds: ['glass', 'dumbbell', 'eggs', 'book', 'glass', 'clothes', 'book', 'rice'],
    passScore: 60,
    description: '学习处理易碎品，正确的叠放顺序',
    specialRule: '易碎品与重物混装，注意重物不能压易碎品',
  },
  {
    id: 'level_3',
    name: '时效速递',
    difficulty: 2,
    timeLimit: 0,
    boxTypeId: 'medium',
    commodityIds: ['medicine', 'document', 'flower', 'book', 'clothes', 'electronics', 'shoes', 'rice'],
    passScore: 60,
    description: '优先处理时效件，放在易取位置',
    specialRule: '时效件需要放在最上层或靠近外侧',
  },
  {
    id: 'level_4',
    name: '空间大师',
    difficulty: 3,
    timeLimit: 0,
    boxTypeId: 'medium',
    commodityIds: ['tv', 'chair', 'water', 'refrigerator', 'book', 'clothes', 'shoes', 'book', 'rice', 'water'],
    passScore: 60,
    description: '提高空间利用率，达到85%以上',
    specialRule: '商品尺寸差异大，需要合理规划空间',
  },
  {
    id: 'level_5',
    name: '综合挑战',
    difficulty: 4,
    timeLimit: 0,
    boxTypeId: 'large',
    commodityIds: ['glass', 'dumbbell', 'eggs', 'medicine', 'electronics', 'tv', 'water', 'chair', 'flower', 'document'],
    passScore: 60,
    description: '所有规则同时生效，考验综合能力',
    specialRule: '易碎、时效、重物全部混装',
  },
  {
    id: 'level_6',
    name: '大师考核',
    difficulty: 5,
    timeLimit: 180,
    boxTypeId: 'xlarge',
    commodityIds: [
      'glass', 'dumbbell', 'eggs', 'medicine', 'electronics',
      'tv', 'water', 'chair', 'flower', 'document',
      'refrigerator', 'rice', 'book', 'clothes', 'shoes'
    ],
    passScore: 70,
    description: '限时3分钟完成15件商品装箱',
    specialRule: '限时挑战，全规则生效',
  },
];

export const getLevelById = (id: string): Level | undefined => {
  return levels.find(l => l.id === id);
};

export const getNextLevel = (currentLevelId: string): Level | undefined => {
  const currentIndex = levels.findIndex(l => l.id === currentLevelId);
  if (currentIndex < levels.length - 1) {
    return levels[currentIndex + 1];
  }
  return undefined;
};
