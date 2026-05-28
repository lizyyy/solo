import type { Shelf } from '../types';

const FLOOR_HEIGHT = 4;
const TOTAL_SHELVES = 100;

const zoneNames = [
  'A区-存储区', 'B区-拣选区', 'A区-存储区',
  'D区-存储区', 'E区-存储区', 'F区-拣选区',
  'G区-高值存储区', 'H区-分拣区', 'G区-高值存储区',
];

const generateShelf = (index: number): Shelf => {
  const floorLevel = index < 35 ? 1 : (index < 70 ? 2 : 3);
  const floorId = `floor-${floorLevel}`;
  const zBase = (floorLevel - 1) * FLOOR_HEIGHT;
  const localIndex = index < 35 ? index : (index < 70 ? index - 35 : index - 70);

  const zoneIndex = (floorLevel - 1) * 3 + (localIndex % 3);
  const zone = zoneNames[zoneIndex];

  const col = localIndex % 6;
  const row = Math.floor(localIndex / 6);

  let xOffset = 0;
  if (zone.includes('B') || zone.includes('F') || zone.includes('H')) xOffset = 18;
  if (zone.includes('G') || zone.includes('I')) xOffset = 0;

  const x = 3 + xOffset + col * 2.5;
  const y = 3 + row * 3;

  const capacity = 150 + Math.floor(Math.random() * 150);
  const currentStock = Math.floor(Math.random() * capacity);
  const congestionLevel = Math.floor(Math.random() * 5);

  const skuCount = 3 + Math.floor(Math.random() * 10);
  const skuList = Array.from({ length: skuCount }, (_, j) =>
    `SKU-${String(index * 100 + j).padStart(6, '0')}`
  );

  return {
    id: `shelf-${String(index + 1).padStart(3, '0')}`,
    floorId,
    position: { x, y, z: zBase },
    dimensions: { width: 2, depth: 2.5, height: 3 },
    capacity,
    currentStock,
    skuList,
    zone,
    congestionLevel,
    isMissingData: false,
  };
};

export const shelves: Shelf[] = Array.from({ length: TOTAL_SHELVES }, (_, i) => generateShelf(i));

shelves[15].isMissingData = true;
shelves[15].capacity = 0;
shelves[15].currentStock = 0;
shelves[15].skuList = [];
shelves[15].congestionLevel = 0;

shelves[42].currentStock = -5;
shelves[42].capacity = 200;

shelves[68].capacity = 100;
shelves[68].currentStock = 150;

shelves[88].position.z = FLOOR_HEIGHT * 1.5;

const highCongestionIndices = [8, 22, 33, 51, 56, 77, 82, 91];
highCongestionIndices.forEach(i => {
  if (shelves[i]) {
    shelves[i].congestionLevel = 4;
  }
});

const lowCongestionIndices = [5, 18, 29, 45, 62, 73, 95];
lowCongestionIndices.forEach(i => {
  if (shelves[i]) {
    shelves[i].congestionLevel = 0;
  }
});

export const getShelvesByFloor = (floorLevel: number): Shelf[] => {
  const floorId = `floor-${floorLevel}`;
  return shelves.filter(s => s.floorId === floorId);
};

export const getShelvesByZone = (zoneName: string): Shelf[] => {
  return shelves.filter(s => s.zone === zoneName);
};

export const getHighCongestionShelves = (threshold: number = 3): Shelf[] => {
  return shelves.filter(s => (s.congestionLevel || 0) >= threshold);
};

export const getMissingDataShelves = (): Shelf[] => {
  return shelves.filter(s => s.isMissingData);
};

export const getShelvesBySku = (sku: string): Shelf[] => {
  return shelves.filter(s => s.skuList.includes(sku));
};

export default shelves;
