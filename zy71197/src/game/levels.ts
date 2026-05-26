import { Level, Mold, Order } from './types';

const createMolds = (prefix: string, names: string[]): Mold[] => {
  return names.map((name, index) => ({
    id: `${prefix}${index + 1}`,
    name: name,
    color: '',
    category: prefix
  }));
};

const createOrders = (
  levelId: number,
  count: number,
  molds: Mold[],
  timeRange: [number, number],
  deadlineRange: [number, number],
  penaltyRange: [number, number]
): Order[] => {
  const orders: Order[] = [];
  for (let i = 0; i < count; i++) {
    const mold = molds[Math.floor(Math.random() * molds.length)];
    const productionTime = Math.floor(
      timeRange[0] + Math.random() * (timeRange[1] - timeRange[0])
    );
    const deadline = Math.floor(
      deadlineRange[0] + Math.random() * (deadlineRange[1] - deadlineRange[0])
    );
    const delayPenalty = Math.floor(
      penaltyRange[0] + Math.random() * (penaltyRange[1] - penaltyRange[0])
    );
    orders.push({
      id: `L${levelId}-O${i + 1}`,
      name: `订单-${i + 1}`,
      moldId: mold.id,
      productionTime,
      quantity: Math.floor(50 + Math.random() * 150),
      deadline,
      delayPenalty
    });
  }
  return orders;
};

const level1Molds: Mold[] = [
  { id: 'A1', name: '模具A1', color: '#3b82f6', category: 'A' },
  { id: 'B1', name: '模具B1', color: '#10b981', category: 'B' }
];

const level1Orders: Order[] = [
  { id: 'L1-O1', name: '订单-A1', moldId: 'A1', productionTime: 30, quantity: 100, deadline: 120, delayPenalty: 5 },
  { id: 'L1-O2', name: '订单-A2', moldId: 'A1', productionTime: 25, quantity: 80, deadline: 150, delayPenalty: 5 },
  { id: 'L1-O3', name: '订单-B1', moldId: 'B1', productionTime: 40, quantity: 120, deadline: 180, delayPenalty: 8 },
  { id: 'L1-O4', name: '订单-A3', moldId: 'A1', productionTime: 35, quantity: 90, deadline: 200, delayPenalty: 5 },
  { id: 'L1-O5', name: '订单-B2', moldId: 'B1', productionTime: 45, quantity: 110, deadline: 250, delayPenalty: 8 }
];

const level2Molds: Mold[] = [
  { id: 'A1', name: '模具A1', color: '#3b82f6', category: 'A' },
  { id: 'A2', name: '模具A2', color: '#60a5fa', category: 'A' },
  { id: 'B1', name: '模具B1', color: '#10b981', category: 'B' },
  { id: 'B2', name: '模具B2', color: '#34d399', category: 'B' }
];

const level2Orders: Order[] = [
  { id: 'L2-O1', name: '订单-A1', moldId: 'A1', productionTime: 25, quantity: 80, deadline: 100, delayPenalty: 6 },
  { id: 'L2-O2', name: '订单-A2', moldId: 'A2', productionTime: 30, quantity: 100, deadline: 150, delayPenalty: 6 },
  { id: 'L2-O3', name: '订单-B1', moldId: 'B1', productionTime: 35, quantity: 90, deadline: 180, delayPenalty: 10 },
  { id: 'L2-O4', name: '订单-A3', moldId: 'A1', productionTime: 28, quantity: 85, deadline: 220, delayPenalty: 6 },
  { id: 'L2-O5', name: '订单-B2', moldId: 'B2', productionTime: 40, quantity: 110, deadline: 250, delayPenalty: 10 },
  { id: 'L2-O6', name: '订单-A4', moldId: 'A2', productionTime: 32, quantity: 95, deadline: 300, delayPenalty: 6 },
  { id: 'L2-O7', name: '订单-B3', moldId: 'B1', productionTime: 38, quantity: 100, deadline: 350, delayPenalty: 10 }
];

const level3Molds: Mold[] = [
  { id: 'A1', name: '模具A1', color: '#3b82f6', category: 'A' },
  { id: 'A2', name: '模具A2', color: '#60a5fa', category: 'A' },
  { id: 'B1', name: '模具B1', color: '#10b981', category: 'B' },
  { id: 'B2', name: '模具B2', color: '#34d399', category: 'B' },
  { id: 'C1', name: '模具C1', color: '#f59e0b', category: 'C' },
  { id: 'D1', name: '模具D1', color: '#ef4444', category: 'D' }
];

const level3Orders: Order[] = [
  { id: 'L3-O1', name: '紧急订单-C1', moldId: 'C1', productionTime: 20, quantity: 60, deadline: 60, delayPenalty: 20 },
  { id: 'L3-O2', name: '订单-A1', moldId: 'A1', productionTime: 25, quantity: 80, deadline: 120, delayPenalty: 8 },
  { id: 'L3-O3', name: '订单-A2', moldId: 'A2', productionTime: 30, quantity: 100, deadline: 180, delayPenalty: 8 },
  { id: 'L3-O4', name: '订单-B1', moldId: 'B1', productionTime: 35, quantity: 90, deadline: 220, delayPenalty: 12 },
  { id: 'L3-O5', name: '订单-D1', moldId: 'D1', productionTime: 45, quantity: 130, deadline: 280, delayPenalty: 15 },
  { id: 'L3-O6', name: '订单-A3', moldId: 'A1', productionTime: 28, quantity: 85, deadline: 320, delayPenalty: 8 },
  { id: 'L3-O7', name: '订单-B2', moldId: 'B2', productionTime: 38, quantity: 100, deadline: 380, delayPenalty: 12 },
  { id: 'L3-O8', name: '紧急订单-D2', moldId: 'D1', productionTime: 42, quantity: 120, deadline: 420, delayPenalty: 15 },
  { id: 'L3-O9', name: '订单-C2', moldId: 'C1', productionTime: 22, quantity: 70, deadline: 480, delayPenalty: 20 },
  { id: 'L3-O10', name: '订单-A4', moldId: 'A2', productionTime: 32, quantity: 95, deadline: 520, delayPenalty: 8 }
];

export const LEVELS: Level[] = [
  {
    id: 1,
    name: '新手入门',
    description: '熟悉基本操作，理解换线成本概念。只有2种模具，同类清洗和跨类清洗时间相同。',
    molds: level1Molds,
    orders: level1Orders,
    targetCost: 800,
    initialMoldId: 'A1',
    sameCategoryCleanTime: 10,
    crossCategoryCleanTime: 10,
    changeoverFixedCost: 50,
    laborCostPerMinute: 2,
    idleCostPerMinute: 1
  },
  {
    id: 2,
    name: '模具冲突',
    description: '引入4种模具，跨类清洗时间翻倍。需要学习归类生产，减少换线次数。',
    molds: level2Molds,
    orders: level2Orders,
    targetCost: 1500,
    initialMoldId: 'A1',
    sameCategoryCleanTime: 8,
    crossCategoryCleanTime: 20,
    changeoverFixedCost: 80,
    laborCostPerMinute: 3,
    idleCostPerMinute: 2
  },
  {
    id: 3,
    name: '交期压力',
    description: '6种模具，部分订单有严格交期和高额罚款。需要权衡换线成本与延迟成本。',
    molds: level3Molds,
    orders: level3Orders,
    targetCost: 2500,
    initialMoldId: 'A1',
    sameCategoryCleanTime: 10,
    crossCategoryCleanTime: 25,
    changeoverFixedCost: 100,
    laborCostPerMinute: 4,
    idleCostPerMinute: 3
  }
];

export const getLevelById = (id: number): Level | undefined => {
  return LEVELS.find(level => level.id === id);
};

export const getMoldById = (level: Level, moldId: string): Mold | undefined => {
  return level.molds.find(mold => mold.id === moldId);
};

export const getOrderById = (level: Level, orderId: string): Order | undefined => {
  return level.orders.find(order => order.id === orderId);
};
