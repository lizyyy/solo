import { HazardCategory, CorrosiveSubType, AdjacencyRule } from '../types';

export const ADJACENCY_RULES: AdjacencyRule[] = [
  {
    category1: HazardCategory.EXPLOSIVE,
    category2: HazardCategory.EXPLOSIVE,
    severity: 'warning',
    penalty: 100,
    description: '爆炸品之间应保持足够隔离距离'
  },
  {
    category1: HazardCategory.EXPLOSIVE,
    category2: HazardCategory.FLAMMABLE,
    severity: 'severe',
    penalty: 0,
    description: '爆炸品与易燃液体相邻会引发严重爆炸事故'
  },
  {
    category1: HazardCategory.EXPLOSIVE,
    category2: HazardCategory.OXIDIZER,
    severity: 'severe',
    penalty: 0,
    description: '爆炸品与氧化剂接触会发生剧烈爆炸'
  },
  {
    category1: HazardCategory.EXPLOSIVE,
    category2: HazardCategory.TOXIC,
    severity: 'warning',
    penalty: 100,
    description: '爆炸品与毒害品应分开存放'
  },
  {
    category1: HazardCategory.EXPLOSIVE,
    category2: HazardCategory.CORROSIVE,
    severity: 'severe',
    penalty: 0,
    description: '腐蚀品可能导致爆炸品不稳定引发爆炸'
  },
  {
    category1: HazardCategory.EXPLOSIVE,
    category2: HazardCategory.COMPRESSED_GAS,
    severity: 'severe',
    penalty: 0,
    description: '压缩气体与爆炸品相邻风险极高'
  },
  {
    category1: HazardCategory.FLAMMABLE,
    category2: HazardCategory.OXIDIZER,
    severity: 'severe',
    penalty: 0,
    description: '易燃物与氧化剂接触会剧烈燃烧爆炸'
  },
  {
    category1: HazardCategory.FLAMMABLE,
    category2: HazardCategory.TOXIC,
    severity: 'warning',
    penalty: 100,
    description: '易燃液体与毒害品应保持距离'
  },
  {
    category1: HazardCategory.FLAMMABLE,
    category2: HazardCategory.CORROSIVE,
    severity: 'severe',
    penalty: 0,
    description: '腐蚀品可能释放热量引燃易燃液体'
  },
  {
    category1: HazardCategory.FLAMMABLE,
    category2: HazardCategory.COMPRESSED_GAS,
    severity: 'warning',
    penalty: 100,
    description: '易燃液体与易燃气体相邻增加火灾风险'
  },
  {
    category1: HazardCategory.OXIDIZER,
    category2: HazardCategory.TOXIC,
    severity: 'warning',
    penalty: 100,
    description: '氧化剂与毒害品应分开存放'
  },
  {
    category1: HazardCategory.OXIDIZER,
    category2: HazardCategory.CORROSIVE,
    severity: 'warning',
    penalty: 100,
    description: '氧化剂与腐蚀品应保持距离'
  },
  {
    category1: HazardCategory.OXIDIZER,
    category2: HazardCategory.COMPRESSED_GAS,
    severity: 'severe',
    penalty: 0,
    description: '氧化剂与压缩气体相邻会引发爆炸'
  },
  {
    category1: HazardCategory.TOXIC,
    category2: HazardCategory.TOXIC,
    severity: 'allowed',
    penalty: 0,
    description: '同类毒害品可同区存放'
  },
  {
    category1: HazardCategory.TOXIC,
    category2: HazardCategory.CORROSIVE,
    severity: 'warning',
    penalty: 100,
    description: '毒害品与腐蚀品应保持距离'
  },
  {
    category1: HazardCategory.TOXIC,
    category2: HazardCategory.COMPRESSED_GAS,
    severity: 'warning',
    penalty: 100,
    description: '毒害品与压缩气体应分开存放'
  },
  {
    category1: CorrosiveSubType.ACID,
    category2: CorrosiveSubType.ALKALI,
    severity: 'severe',
    penalty: 0,
    description: '强酸与强碱剧烈中和反应，释放大量热量，可能发生喷溅'
  },
  {
    category1: HazardCategory.CORROSIVE,
    category2: HazardCategory.CORROSIVE,
    severity: 'allowed',
    penalty: 0,
    description: '同类腐蚀品可同区存放（酸碱除外）'
  },
  {
    category1: HazardCategory.COMPRESSED_GAS,
    category2: HazardCategory.COMPRESSED_GAS,
    severity: 'allowed',
    penalty: 0,
    description: '压缩气体可同区存放'
  },
  {
    category1: HazardCategory.FLAMMABLE,
    category2: HazardCategory.FLAMMABLE,
    severity: 'allowed',
    penalty: 0,
    description: '同类易燃液体可同区存放'
  },
  {
    category1: HazardCategory.OXIDIZER,
    category2: HazardCategory.OXIDIZER,
    severity: 'allowed',
    penalty: 0,
    description: '同类氧化剂可同区存放'
  }
];

export const getAdjacencyRule = (
  category1: HazardCategory | CorrosiveSubType,
  category2: HazardCategory | CorrosiveSubType
): AdjacencyRule | undefined => {
  return ADJACENCY_RULES.find(
    rule =>
      (rule.category1 === category1 && rule.category2 === category2) ||
      (rule.category1 === category2 && rule.category2 === category1)
  );
};

export const PENALTIES = {
  ADJACENCY_FIRST: 100,
  ADJACENCY_PER_SECOND: 5,
  TEMPERATURE_FIRST: 50,
  TEMPERATURE_PER_SECOND: 3,
  ISOLATION: 80,
  ZONE: 60,
  TIME_OVER_PER_SECOND: 20,
  PLACEMENT_CORRECT: 50,
  ISOLATION_BONUS: 20,
  TEMPERATURE_BONUS: 30,
  TIME_BONUS_PER_SECOND: 10
};
