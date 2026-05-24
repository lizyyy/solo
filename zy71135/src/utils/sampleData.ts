import { Cargo, Bay } from '../types';

export const sampleCargoList: Cargo[] = [
  {
    id: 'cargo-1',
    name: '重型机械A',
    type: 'heavy',
    weight: 28,
    size: { x: 2, y: 1, z: 1 },
  },
  {
    id: 'cargo-2',
    name: '重型机械B',
    type: 'heavy',
    weight: 32,
    size: { x: 2, y: 1, z: 1 },
  },
  {
    id: 'cargo-3',
    name: '钢材卷',
    type: 'heavy',
    weight: 25,
    size: { x: 2, y: 1, z: 1 },
  },
  {
    id: 'cargo-4',
    name: '冷藏海鲜',
    type: 'reefer',
    weight: 12,
    size: { x: 2, y: 1, z: 1 },
    requiresPower: true,
  },
  {
    id: 'cargo-5',
    name: '冷藏水果',
    type: 'reefer',
    weight: 8,
    size: { x: 2, y: 1, z: 1 },
    requiresPower: true,
  },
  {
    id: 'cargo-6',
    name: '冷藏医药',
    type: 'reefer',
    weight: 6,
    size: { x: 2, y: 1, z: 1 },
    requiresPower: true,
  },
  {
    id: 'cargo-7',
    name: '易燃液体',
    type: 'dangerous',
    weight: 15,
    size: { x: 2, y: 1, z: 1 },
    dangerLevel: 'class3',
  },
  {
    id: 'cargo-8',
    name: '氧化剂',
    type: 'dangerous',
    weight: 18,
    size: { x: 2, y: 1, z: 1 },
    dangerLevel: 'class2',
  },
  {
    id: 'cargo-9',
    name: '腐蚀性物品',
    type: 'dangerous',
    weight: 10,
    size: { x: 2, y: 1, z: 1 },
    dangerLevel: 'class4',
  },
  {
    id: 'cargo-10',
    name: '普通货物A',
    type: 'heavy',
    weight: 15,
    size: { x: 2, y: 1, z: 1 },
  },
  {
    id: 'cargo-11',
    name: '普通货物B',
    type: 'heavy',
    weight: 12,
    size: { x: 2, y: 1, z: 1 },
  },
  {
    id: 'cargo-12',
    name: '冷藏蔬菜',
    type: 'reefer',
    weight: 9,
    size: { x: 2, y: 1, z: 1 },
    requiresPower: true,
  },
];

export function generateSampleBays(): Bay[] {
  const bays: Bay[] = [];
  const rows = 3;
  const tiers = 2;
  const stacks = 4;

  for (let row = 0; row < rows; row++) {
    for (let tier = 0; tier < tiers; tier++) {
      for (let stack = 0; stack < stacks; stack++) {
        const hasPower = (row === 0 || row === 2) && tier === 0;
        bays.push({
          id: `bay-${row}-${tier}-${stack}`,
          position: { row, tier, stack },
          size: { x: 2, y: 1, z: 1 },
          maxWeight: 35,
          hasPower,
        });
      }
    }
  }
  return bays;
}

export const dangerLevelNames: Record<string, string> = {
  class1: '爆炸品',
  class2: '气体',
  class3: '易燃液体',
  class4: '易燃固体',
};

export const cargoTypeNames: Record<string, string> = {
  heavy: '重货',
  reefer: '冷藏箱',
  dangerous: '危险品',
};
