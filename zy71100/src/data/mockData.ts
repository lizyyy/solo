import type { Warehouse, Aisle, Shelf, PickingOrder } from './types';

const DAY_START = new Date('2024-01-15T08:00:00').getTime();
const DAY_END = new Date('2024-01-15T18:00:00').getTime();

export const warehouseData: Warehouse = {
  id: 'wh-001',
  name: '主仓库 A 区',
  width: 80,
  depth: 60,
  height: 12,
};

export const aisles: Aisle[] = [
  { id: 'aisle-1', name: '主通道 A', width: 4, orientation: 'z', isNarrow: false, x1: 10, z1: 5, x2: 10, z2: 55 },
  { id: 'aisle-2', name: '主通道 B', width: 4, orientation: 'z', isNarrow: false, x1: 25, z1: 5, x2: 25, z2: 55 },
  { id: 'aisle-3', name: '窄巷 C', width: 2, orientation: 'z', isNarrow: true, x1: 40, z1: 5, x2: 40, z2: 55 },
  { id: 'aisle-4', name: '窄巷 D', width: 2, orientation: 'z', isNarrow: true, x1: 55, z1: 5, x2: 55, z2: 55 },
  { id: 'aisle-5', name: '主通道 E', width: 4, orientation: 'z', isNarrow: false, x1: 70, z1: 5, x2: 70, z2: 55 },
  { id: 'aisle-h1', name: '横向通道 1', width: 3, orientation: 'x', isNarrow: false, x1: 5, z1: 30, x2: 75, z2: 30 },
];

export const shelves: Shelf[] = [
  ...generateShelfRow('A', 5, 5, 4, 1, 8, 4),
  ...generateShelfRow('B', 17, 5, 4, 1, 8, 4),
  ...generateShelfRow('C', 32, 5, 4, 1, 8, 4),
  ...generateShelfRow('D', 47, 5, 4, 1, 8, 4),
  ...generateShelfRow('E', 62, 5, 4, 1, 8, 4),
];

function generateShelfRow(prefix: string, startX: number, startZ: number, width: number, depth: number, height: number, count: number): Shelf[] {
  const result: Shelf[] = [];
  for (let i = 0; i < count; i++) {
    result.push({
      id: `shelf-${prefix}-${i + 1}`,
      name: `${prefix}区-${i + 1}号货架`,
      x: startX,
      y: 0,
      z: startZ + i * 6 + 3,
      width,
      depth,
      height,
      levels: 5,
      aisleId: `aisle-${prefix.toLowerCase()}`,
    });
  }
  return result;
}

const vehicleColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

export const pickingOrders: PickingOrder[] = generateMockOrders(12);

function generateMockOrders(count: number): PickingOrder[] {
  const orders: PickingOrder[] = [];
  const operators = ['张师傅', '李工', '王师傅', '陈工', '刘师傅', '赵工'];
  const vehicleTypes: ('forklift' | 'picker' | 'manual')[] = ['forklift', 'picker', 'picker', 'manual'];

  for (let i = 0; i < count; i++) {
    const startTime = DAY_START + i * (DAY_END - DAY_START) / count + Math.random() * 1800000;
    const path = generatePath(startTime);
    orders.push({
      id: `order-${String(i + 1).padStart(3, '0')}`,
      operator: operators[i % operators.length],
      vehicleType: vehicleTypes[i % vehicleTypes.length],
      startTime,
      endTime: path[path.length - 1].timestamp,
      path,
      color: vehicleColors[i % vehicleColors.length],
    });
  }
  return orders;
}

function generatePath(startTime: number) {
  const path: { x: number; y: number; z: number; timestamp: number; speed: number }[] = [];
  const keyPoints = generateKeyPoints();
  
  let currentTime = startTime;
  for (let i = 0; i < keyPoints.length - 1; i++) {
    const from = keyPoints[i];
    const to = keyPoints[i + 1];
    const distance = Math.sqrt(Math.pow(to.x - from.x, 2) + Math.pow(to.z - from.z, 2));
    const speed = 1.5 + Math.random() * 2;
    const duration = (distance / speed) * 1000;
    const steps = Math.max(5, Math.floor(distance / 0.5));
    
    for (let j = 0; j <= steps; j++) {
      const t = j / steps;
      path.push({
        x: from.x + (to.x - from.x) * t,
        y: 0.5,
        z: from.z + (to.z - from.z) * t,
        timestamp: currentTime + duration * t,
        speed: speed * (0.8 + Math.random() * 0.4),
      });
    }
    currentTime += duration + Math.random() * 5000;
  }
  return path;
}

function generateKeyPoints(): { x: number; z: number }[] {
  const points: { x: number; z: number }[] = [];
  const startPoints = [
    { x: 40, z: 55 },
    { x: 10, z: 55 },
    { x: 70, z: 55 },
  ];
  const endPoints = [
    { x: 40, z: 5 },
    { x: 10, z: 5 },
    { x: 70, z: 5 },
  ];
  
  points.push(startPoints[Math.floor(Math.random() * startPoints.length)]);
  
  const stopCount = 3 + Math.floor(Math.random() * 4);
  for (let i = 0; i < stopCount; i++) {
    const aisleX = [10, 25, 40, 55, 70][Math.floor(Math.random() * 5)];
    const zPos = 10 + Math.random() * 40;
    points.push({ x: aisleX, z: zPos });
    
    if (Math.random() > 0.5) {
      points.push({ x: 40, z: 30 });
    }
  }
  
  points.push(endPoints[Math.floor(Math.random() * endPoints.length)]);
  return points;
}

export const defaultTimeRange = {
  start: DAY_START,
  end: DAY_END,
};

export const viewModes = {
  perspective: { position: [60, 50, 80] as [number, number, number], target: [40, 0, 30] as [number, number, number] },
  top: { position: [40, 100, 30] as [number, number, number], target: [40, 0, 30] as [number, number, number] },
  front: { position: [40, 30, 100] as [number, number, number], target: [40, 0, 30] as [number, number, number] },
  side: { position: [100, 30, 30] as [number, number, number], target: [40, 0, 30] as [number, number, number] },
};
