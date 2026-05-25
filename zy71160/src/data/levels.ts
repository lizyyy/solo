import { LevelConfig } from '../types';

export const LEVELS: LevelConfig[] = [
  {
    id: 1,
    name: '新手培训',
    description: '基础垃圾分类练习，速度较慢，适合初学者',
    speed: 1,
    spawnRate: 2800,
    itemCount: 15,
    itemTypes: ['recyclable', 'kitchen', 'other'],
    pollutionRate: 0.1,
    dangerRate: 0,
    requiredAccuracy: 0.7,
  },
  {
    id: 2,
    name: '正式上岗',
    description: '速度提升，开始出现有害垃圾，需要更加谨慎',
    speed: 1.5,
    spawnRate: 2200,
    itemCount: 25,
    itemTypes: ['recyclable', 'hazardous', 'kitchen', 'other'],
    pollutionRate: 0.15,
    dangerRate: 0.15,
    requiredAccuracy: 0.8,
  },
  {
    id: 3,
    name: '分拣大师',
    description: '高速分拣，考验反应力和判断力，危险品频繁出现',
    speed: 2.2,
    spawnRate: 1600,
    itemCount: 40,
    itemTypes: ['recyclable', 'hazardous', 'kitchen', 'other'],
    pollutionRate: 0.2,
    dangerRate: 0.25,
    requiredAccuracy: 0.85,
  },
];

export const getLevelById = (id: number): LevelConfig | undefined => {
  return LEVELS.find(level => level.id === id);
};

export const getLevelDifficultyLabel = (level: LevelConfig): string => {
  if (level.id === 1) return '简单';
  if (level.id === 2) return '中等';
  return '困难';
};

export const getLevelDifficultyColor = (level: LevelConfig): string => {
  if (level.id === 1) return 'text-green-500';
  if (level.id === 2) return 'text-yellow-500';
  return 'text-red-500';
};
