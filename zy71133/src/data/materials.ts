import { Material } from '@/types';

export const MATERIALS: Material[] = [
  {
    id: 'ore',
    name: '铁矿石',
    density: 3.5,
    color: '#B87333',
  },
  {
    id: 'coal',
    name: '煤炭',
    density: 1.3,
    color: '#2C2C2C',
  },
  {
    id: 'sand',
    name: '砂石',
    density: 1.6,
    color: '#C4A77D',
  },
  {
    id: 'limestone',
    name: '石灰石',
    density: 2.7,
    color: '#E8E4D9',
  },
  {
    id: 'clay',
    name: '黏土',
    density: 1.8,
    color: '#8B4513',
  },
  {
    id: 'gravel',
    name: '碎石',
    density: 1.7,
    color: '#696969',
  },
];

export const getMaterialById = (id: string): Material | undefined => {
  return MATERIALS.find(m => m.id === id);
};

export const getMaterialColor = (id: string): string => {
  return getMaterialById(id)?.color || '#165DFF';
};
