import { Level } from '../types/game';

export const levels: Level[] = [
  {
    id: 'easy',
    name: '新手训练',
    difficulty: 'easy',
    description: '单机器人，简单路径规划练习',
    gridSize: { width: 8, height: 8 },
    robots: [
      {
        id: 'robot-1',
        name: 'R1',
        position: { x: 0, y: 0 },
        battery: 100,
        status: 'idle',
        path: [],
        pathIndex: 0,
        moveProgress: 0,
        color: '#3B82F6',
      },
    ],
    shelves: [
      { id: 'shelf-1', position: { x: 3, y: 3 }, hasGoods: true, goodsType: 'A' },
      { id: 'shelf-2', position: { x: 5, y: 3 }, hasGoods: true, goodsType: 'B' },
      { id: 'shelf-3', position: { x: 3, y: 5 }, hasGoods: true, goodsType: 'C' },
    ],
    obstacles: [
      { id: 'obs-1', position: { x: 4, y: 4 }, type: 'pillar' },
    ],
    chargingStations: [
      { id: 'charge-1', position: { x: 7, y: 7 } },
    ],
    orders: [
      {
        id: 'order-1',
        items: [
          { shelfId: 'shelf-1', quantity: 1, picked: false },
          { shelfId: 'shelf-2', quantity: 1, picked: false },
        ],
        createdAt: 0,
        deadline: 120,
        status: 'pending',
      },
    ],
    timeLimit: 180,
  },
  {
    id: 'medium',
    name: '双机协作',
    difficulty: 'medium',
    description: '两台机器人，避障协作',
    gridSize: { width: 10, height: 10 },
    robots: [
      {
        id: 'robot-1',
        name: 'R1',
        position: { x: 0, y: 0 },
        battery: 100,
        status: 'idle',
        path: [],
        pathIndex: 0,
        moveProgress: 0,
        color: '#3B82F6',
      },
      {
        id: 'robot-2',
        name: 'R2',
        position: { x: 9, y: 0 },
        battery: 100,
        status: 'idle',
        path: [],
        pathIndex: 0,
        moveProgress: 0,
        color: '#10B981',
      },
    ],
    shelves: [
      { id: 'shelf-1', position: { x: 3, y: 3 }, hasGoods: true, goodsType: 'A' },
      { id: 'shelf-2', position: { x: 6, y: 3 }, hasGoods: true, goodsType: 'B' },
      { id: 'shelf-3', position: { x: 3, y: 6 }, hasGoods: true, goodsType: 'C' },
      { id: 'shelf-4', position: { x: 6, y: 6 }, hasGoods: true, goodsType: 'D' },
      { id: 'shelf-5', position: { x: 5, y: 5 }, hasGoods: true, goodsType: 'E' },
    ],
    obstacles: [
      { id: 'obs-1', position: { x: 4, y: 4 }, type: 'pillar' },
      { id: 'obs-2', position: { x: 5, y: 4 }, type: 'pillar' },
      { id: 'obs-3', position: { x: 2, y: 5 }, type: 'wall' },
    ],
    chargingStations: [
      { id: 'charge-1', position: { x: 0, y: 9 } },
      { id: 'charge-2', position: { x: 9, y: 9 } },
    ],
    orders: [
      {
        id: 'order-1',
        items: [
          { shelfId: 'shelf-1', quantity: 1, picked: false },
          { shelfId: 'shelf-4', quantity: 1, picked: false },
        ],
        createdAt: 0,
        deadline: 90,
        status: 'pending',
      },
      {
        id: 'order-2',
        items: [
          { shelfId: 'shelf-2', quantity: 1, picked: false },
          { shelfId: 'shelf-3', quantity: 1, picked: false },
        ],
        createdAt: 30,
        deadline: 120,
        status: 'pending',
      },
    ],
    timeLimit: 180,
  },
  {
    id: 'hard',
    name: '繁忙仓库',
    difficulty: 'hard',
    description: '三台机器人，多订单并发',
    gridSize: { width: 12, height: 12 },
    robots: [
      {
        id: 'robot-1',
        name: 'R1',
        position: { x: 0, y: 0 },
        battery: 100,
        status: 'idle',
        path: [],
        pathIndex: 0,
        moveProgress: 0,
        color: '#3B82F6',
      },
      {
        id: 'robot-2',
        name: 'R2',
        position: { x: 11, y: 0 },
        battery: 100,
        status: 'idle',
        path: [],
        pathIndex: 0,
        moveProgress: 0,
        color: '#10B981',
      },
      {
        id: 'robot-3',
        name: 'R3',
        position: { x: 6, y: 0 },
        battery: 80,
        status: 'idle',
        path: [],
        pathIndex: 0,
        moveProgress: 0,
        color: '#F59E0B',
      },
    ],
    shelves: [
      { id: 'shelf-1', position: { x: 2, y: 3 }, hasGoods: true, goodsType: 'A' },
      { id: 'shelf-2', position: { x: 5, y: 3 }, hasGoods: true, goodsType: 'B' },
      { id: 'shelf-3', position: { x: 8, y: 3 }, hasGoods: true, goodsType: 'C' },
      { id: 'shelf-4', position: { x: 2, y: 7 }, hasGoods: true, goodsType: 'D' },
      { id: 'shelf-5', position: { x: 5, y: 7 }, hasGoods: true, goodsType: 'E' },
      { id: 'shelf-6', position: { x: 8, y: 7 }, hasGoods: true, goodsType: 'F' },
      { id: 'shelf-7', position: { x: 5, y: 5 }, hasGoods: true, goodsType: 'G' },
    ],
    obstacles: [
      { id: 'obs-1', position: { x: 3, y: 5 }, type: 'pillar' },
      { id: 'obs-2', position: { x: 7, y: 5 }, type: 'pillar' },
      { id: 'obs-3', position: { x: 4, y: 2 }, type: 'wall' },
      { id: 'obs-4', position: { x: 6, y: 2 }, type: 'wall' },
      { id: 'obs-5', position: { x: 4, y: 8 }, type: 'wall' },
      { id: 'obs-6', position: { x: 6, y: 8 }, type: 'wall' },
    ],
    chargingStations: [
      { id: 'charge-1', position: { x: 0, y: 11 } },
      { id: 'charge-2', position: { x: 11, y: 11 } },
    ],
    orders: [
      {
        id: 'order-1',
        items: [
          { shelfId: 'shelf-1', quantity: 1, picked: false },
          { shelfId: 'shelf-6', quantity: 1, picked: false },
        ],
        createdAt: 0,
        deadline: 80,
        status: 'pending',
      },
      {
        id: 'order-2',
        items: [
          { shelfId: 'shelf-3', quantity: 1, picked: false },
          { shelfId: 'shelf-4', quantity: 1, picked: false },
        ],
        createdAt: 20,
        deadline: 100,
        status: 'pending',
      },
      {
        id: 'order-3',
        items: [
          { shelfId: 'shelf-2', quantity: 1, picked: false },
          { shelfId: 'shelf-5', quantity: 1, picked: false },
          { shelfId: 'shelf-7', quantity: 1, picked: false },
        ],
        createdAt: 40,
        deadline: 140,
        status: 'pending',
      },
    ],
    timeLimit: 200,
  },
];

export function getLevelById(id: string): Level | undefined {
  return levels.find((level) => level.id === id);
}

export function cloneLevel(level: Level): Level {
  return JSON.parse(JSON.stringify(level));
}
