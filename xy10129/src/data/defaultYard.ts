import { YardConfig, YardSlot, ForbiddenZone } from '../types';

export const createDefaultSlots = (): YardSlot[] => {
  const slots: YardSlot[] = [];
  const slotWidth = 6;
  const slotLength = 12;
  const slotHeight = 3;

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      const x = col * (slotWidth + 2) - 20;
      const z = row * (slotLength + 4) - 15;
      
      slots.push({
        id: `slot-${row}-${col}`,
        name: `货位 ${String.fromCharCode(65 + row)}${col + 1}`,
        position: { x, y: slotHeight / 2, z },
        width: slotWidth,
        length: slotLength,
        height: slotHeight,
        type: 'storage',
        occupied: (row + col) % 3 === 0,
        cargo: (row + col) % 3 === 0 ? {
          id: `cargo-${row}-${col}`,
          name: `货物 ${row + 1}-${col + 1}`,
          weight: 5000 + Math.random() * 5000,
          dimensions: { x: 4, y: 2.5, z: 10 }
        } : undefined
      });
    }
  }

  return slots;
};

export const createDefaultForbiddenZones = (): ForbiddenZone[] => [
  {
    id: 'forbidden-1',
    name: '临时施工区 A',
    position: { x: 0, y: 1, z: 15 },
    width: 10,
    length: 8,
    height: 2,
    reason: '临时设备维护'
  },
  {
    id: 'forbidden-2',
    name: '禁行区 B',
    position: { x: -15, y: 1, z: 0 },
    width: 6,
    length: 12,
    height: 2,
    reason: '高压电缆区域'
  }
];

export const defaultYardConfig: YardConfig = {
  id: 'yard-default',
  name: '标准堆场 A',
  width: 60,
  length: 50,
  height: 5,
  slots: createDefaultSlots(),
  forbiddenZones: createDefaultForbiddenZones()
};
