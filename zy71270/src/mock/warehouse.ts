import type { Warehouse, Floor, Zone, Shelf, ChargingStation } from '../types';

const WAREHOUSE_WIDTH = 40;
const WAREHOUSE_DEPTH = 30;
const WAREHOUSE_HEIGHT = 12;
const FLOOR_HEIGHT = 4;

export const warehouse: Warehouse = {
  id: 'wh-001',
  name: '华南智能仓储中心A库',
  floorCount: 3,
  width: WAREHOUSE_WIDTH,
  depth: WAREHOUSE_DEPTH,
  height: WAREHOUSE_HEIGHT,
  floors: [],
};

export const floors: Floor[] = [
  {
    id: 'floor-1',
    warehouseId: 'wh-001',
    level: 1,
    zPosition: 0,
    shelves: [],
    chargingStations: [],
    zones: [
      {
        id: 'zone-1-1',
        name: 'A区-存储区',
        floorId: 'floor-1',
        bounds: { minX: 2, maxX: 18, minY: 2, maxY: 28, minZ: 0, maxZ: FLOOR_HEIGHT },
        type: 'storage',
      },
      {
        id: 'zone-1-2',
        name: 'B区-拣选区',
        floorId: 'floor-1',
        bounds: { minX: 20, maxX: 38, minY: 2, maxY: 20, minZ: 0, maxZ: FLOOR_HEIGHT },
        type: 'picking',
      },
      {
        id: 'zone-1-3',
        name: 'C区-充电区',
        floorId: 'floor-1',
        bounds: { minX: 20, maxX: 38, minY: 22, maxY: 28, minZ: 0, maxZ: FLOOR_HEIGHT },
        type: 'charging',
      },
      {
        id: 'zone-1-4',
        name: '主通道',
        floorId: 'floor-1',
        bounds: { minX: 18, maxX: 20, minY: 0, maxY: 30, minZ: 0, maxZ: FLOOR_HEIGHT },
        type: 'aisle',
      },
    ],
  },
  {
    id: 'floor-2',
    warehouseId: 'wh-001',
    level: 2,
    zPosition: FLOOR_HEIGHT,
    shelves: [],
    chargingStations: [],
    zones: [
      {
        id: 'zone-2-1',
        name: 'D区-存储区',
        floorId: 'floor-2',
        bounds: { minX: 2, maxX: 20, minY: 2, maxY: 14, minZ: FLOOR_HEIGHT, maxZ: FLOOR_HEIGHT * 2 },
        type: 'storage',
      },
      {
        id: 'zone-2-2',
        name: 'E区-存储区',
        floorId: 'floor-2',
        bounds: { minX: 2, maxX: 20, minY: 16, maxY: 28, minZ: FLOOR_HEIGHT, maxZ: FLOOR_HEIGHT * 2 },
        type: 'storage',
      },
      {
        id: 'zone-2-3',
        name: 'F区-拣选区',
        floorId: 'floor-2',
        bounds: { minX: 22, maxX: 38, minY: 2, maxY: 28, minZ: FLOOR_HEIGHT, maxZ: FLOOR_HEIGHT * 2 },
        type: 'picking',
      },
      {
        id: 'zone-2-4',
        name: '横向通道',
        floorId: 'floor-2',
        bounds: { minX: 0, maxX: 40, minY: 14, maxY: 16, minZ: FLOOR_HEIGHT, maxZ: FLOOR_HEIGHT * 2 },
        type: 'aisle',
      },
    ],
  },
  {
    id: 'floor-3',
    warehouseId: 'wh-001',
    level: 3,
    zPosition: FLOOR_HEIGHT * 2,
    shelves: [],
    chargingStations: [],
    zones: [
      {
        id: 'zone-3-1',
        name: 'G区-高值存储区',
        floorId: 'floor-3',
        bounds: { minX: 2, maxX: 14, minY: 2, maxY: 28, minZ: FLOOR_HEIGHT * 2, maxZ: FLOOR_HEIGHT * 3 },
        type: 'storage',
      },
      {
        id: 'zone-3-2',
        name: 'H区-分拣区',
        floorId: 'floor-3',
        bounds: { minX: 16, maxX: 30, minY: 2, maxY: 28, minZ: FLOOR_HEIGHT * 2, maxZ: FLOOR_HEIGHT * 3 },
        type: 'picking',
      },
      {
        id: 'zone-3-3',
        name: 'I区-快充区',
        floorId: 'floor-3',
        bounds: { minX: 32, maxX: 38, minY: 2, maxY: 28, minZ: FLOOR_HEIGHT * 2, maxZ: FLOOR_HEIGHT * 3 },
        type: 'charging',
      },
      {
        id: 'zone-3-4',
        name: '纵向通道',
        floorId: 'floor-3',
        bounds: { minX: 14, maxX: 16, minY: 0, maxY: 30, minZ: FLOOR_HEIGHT * 2, maxZ: FLOOR_HEIGHT * 3 },
        type: 'aisle',
      },
    ],
  },
];

const generateFloorShelves = (floorId: string, floorLevel: number, count: number, startIndex: number): Shelf[] => {
  const shelves: Shelf[] = [];
  const zones = floors.find(f => f.id === floorId)?.zones || [];
  const storageZones = zones.filter(z => z.type === 'storage');
  const zBase = (floorLevel - 1) * FLOOR_HEIGHT;

  for (let i = 0; i < count; i++) {
    const zone = storageZones[i % storageZones.length];
    const col = i % 6;
    const row = Math.floor(i / 6);
    const x = zone.bounds.minX + 1 + col * 2.5;
    const y = zone.bounds.minY + 1 + row * 3;

    shelves.push({
      id: `shelf-${String(startIndex + i).padStart(3, '0')}`,
      floorId,
      position: { x, y, z: zBase },
      dimensions: { width: 2, depth: 2.5, height: 3 },
      capacity: 200,
      currentStock: Math.floor(Math.random() * 200),
      skuList: Array.from({ length: 3 + Math.floor(Math.random() * 8) }, (_, j) => `SKU-${String((startIndex + i) * 10 + j).padStart(5, '0')}`),
      zone: zone.name,
      congestionLevel: Math.floor(Math.random() * 5),
      isMissingData: false,
    });
  }

  if (floorLevel === 2 && count > 15) {
    shelves[15].isMissingData = true;
    shelves[15].capacity = 0;
    shelves[15].currentStock = 0;
    shelves[15].skuList = [];
  }

  return shelves;
};

const generateFloorChargingStations = (floorId: string, floorLevel: number, count: number, startIndex: number): ChargingStation[] => {
  const stations: ChargingStation[] = [];
  const zones = floors.find(f => f.id === floorId)?.zones || [];
  const chargingZone = zones.find(z => z.type === 'charging');
  const zBase = (floorLevel - 1) * FLOOR_HEIGHT;

  if (!chargingZone) return stations;

  for (let i = 0; i < count; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = chargingZone.bounds.minX + 1.5 + col * 5;
    const y = chargingZone.bounds.minY + 2 + row * 4;

    stations.push({
      id: `station-${String(startIndex + i).padStart(3, '0')}`,
      floorId,
      position: { x, y, z: zBase },
      status: i === 2 ? 'offline' : (i % 2 === 0 ? 'available' : 'occupied'),
      power: 22 + Math.floor(Math.random() * 10),
      queue: [],
    });
  }

  return stations;
};

floors[0].shelves = generateFloorShelves('floor-1', 1, 35, 0);
floors[1].shelves = generateFloorShelves('floor-2', 2, 35, 35);
floors[2].shelves = generateFloorShelves('floor-3', 3, 30, 70);

floors[0].chargingStations = generateFloorChargingStations('floor-1', 1, 4, 0);
floors[1].chargingStations = generateFloorChargingStations('floor-2', 2, 3, 4);
floors[2].chargingStations = generateFloorChargingStations('floor-3', 3, 3, 7);

warehouse.floors = floors;

export const allShelves: Shelf[] = floors.flatMap(f => f.shelves);
export const allChargingStations: ChargingStation[] = floors.flatMap(f => f.chargingStations);
export const allZones: Zone[] = floors.flatMap(f => f.zones);

export default warehouse;
