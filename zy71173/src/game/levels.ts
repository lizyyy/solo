import type { Level, CellType, Position, CardType } from './types';

const createEmptyMap = (width: number, height: number): CellType[][] => {
  return Array(height).fill(null).map(() => Array(width).fill('wall' as CellType));
};

const buildCongestionMap = (zones: { position: Position; activeRounds: number[] }[], maxRounds: number): Record<number, Record<string, boolean>> => {
  const congestion: Record<number, Record<string, boolean>> = {};
  for (let round = 1; round <= maxRounds; round++) {
    congestion[round] = {};
    for (const zone of zones) {
      if (zone.activeRounds.includes(round)) {
        const key = `${zone.position.x},${zone.position.y}`;
        congestion[round][key] = true;
      }
    }
  }
  return congestion;
};

const createLevel1 = (): Level => {
  const width = 12;
  const height = 10;
  const map = createEmptyMap(width, height);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      map[y][x] = 'floor';
    }
  }

  for (let y = 1; y <= 4; y++) map[y][4] = 'wall';
  for (let x = 5; x <= 10; x++) map[4][x] = 'wall';
  map[4][5] = 'floor';

  for (let y = 5; y <= 8; y++) map[y][6] = 'wall';
  for (let x = 7; x <= 9; x++) map[6][x] = 'wall';
  for (let y = 5; y <= 8; y++) map[y][9] = 'wall';

  map[8][3] = 'door';
  map[2][2] = 'exhibit';
  map[8][10] = 'storage';
  map[6][2] = 'congestion';
  map[7][7] = 'humidity';

  const exhibitPos = { x: 2, y: 2 };
  const storagePos = { x: 10, y: 8 };
  const congestionZones = [
    { position: { x: 2, y: 6 }, activeRounds: [5, 6, 7] },
  ];

  return {
    id: 1,
    name: '青花护送',
    difficulty: 'easy',
    gridSize: { width, height },
    width,
    height,
    map,
    cells: map,
    doors: [
      {
        id: 'door-a-1',
        position: { x: 3, y: 8 },
        requiredCard: 'A',
        isOpen: false,
        isAuthorized: true,
      },
    ],
    humidityZones: [
      {
        id: 'humidity-1',
        position: { x: 7, y: 7 },
        humidity: 65,
        radius: 1,
      },
    ],
    congestionZones: [
      {
        id: 'congestion-1',
        position: { x: 2, y: 6 },
        activeRounds: [5, 6, 7],
      },
    ],
    guards: [],
    exhibit: {
      id: 'exhibit-1',
      name: '青花瓷瓶',
      type: 'artifact',
      value: 500000,
      maxHumidity: 60,
      startPosition: exhibitPos,
    },
    exhibits: [exhibitPos],
    storagePosition: storagePos,
    storage: storagePos,
    maxRounds: 30,
    availableCards: ['A'],
    desiccantCount: 1,
    humidity: 40,
    congestion: buildCongestionMap(congestionZones, 30),
  };
};

const createLevel2 = (): Level => {
  const width = 14;
  const height = 12;
  const map = createEmptyMap(width, height);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      map[y][x] = 'floor';
    }
  }

  for (let y = 1; y <= 4; y++) map[y][4] = 'wall';
  for (let x = 5; x <= 12; x++) map[4][x] = 'wall';
  map[4][5] = 'floor';

  for (let y = 5; y <= 10; y++) map[y][6] = 'wall';
  for (let y = 5; y <= 7; y++) map[y][10] = 'wall';
  for (let x = 7; x <= 9; x++) map[6][x] = 'wall';

  for (let y = 8; y <= 10; y++) map[y][4] = 'wall';
  for (let x = 7; x <= 8; x++) map[9][x] = 'wall';
  for (let y = 9; y <= 10; y++) map[y][9] = 'wall';

  map[5][4] = 'door';
  map[7][6] = 'door';
  map[2][2] = 'exhibit';
  map[10][12] = 'storage';
  map[6][2] = 'congestion';
  map[9][2] = 'humidity';
  map[5][7] = 'humidity';
  map[9][10] = 'congestion';

  const exhibitPos = { x: 2, y: 2 };
  const storagePos = { x: 12, y: 10 };
  const congestionZones = [
    { position: { x: 2, y: 6 }, activeRounds: [8, 9, 10] },
    { position: { x: 10, y: 9 }, activeRounds: [15, 16, 17] },
  ];

  const guardPath: Position[] = [
    { x: 10, y: 3 },
    { x: 11, y: 3 },
    { x: 12, y: 3 },
    { x: 12, y: 4 },
    { x: 11, y: 4 },
    { x: 10, y: 4 },
  ];

  return {
    id: 2,
    name: '古画迁运',
    difficulty: 'medium',
    gridSize: { width, height },
    width,
    height,
    map,
    cells: map,
    doors: [
      {
        id: 'door-a-2',
        position: { x: 4, y: 5 },
        requiredCard: 'A',
        isOpen: false,
        isAuthorized: true,
      },
      {
        id: 'door-b-1',
        position: { x: 6, y: 7 },
        requiredCard: 'B',
        isOpen: false,
        isAuthorized: true,
      },
    ],
    humidityZones: [
      {
        id: 'humidity-2',
        position: { x: 2, y: 9 },
        humidity: 70,
        radius: 1,
      },
      {
        id: 'humidity-3',
        position: { x: 7, y: 5 },
        humidity: 75,
        radius: 1,
      },
    ],
    congestionZones: [
      {
        id: 'congestion-2',
        position: { x: 2, y: 6 },
        activeRounds: [8, 9, 10],
      },
      {
        id: 'congestion-3',
        position: { x: 10, y: 9 },
        activeRounds: [15, 16, 17],
      },
    ],
    guards: [
      {
        id: 'guard-1',
        position: guardPath[0],
        patrolPath: guardPath,
        currentPathIndex: 0,
        patrolIndex: 0,
        visionRange: 2,
        isAlerted: false,
      },
    ],
    exhibit: {
      id: 'exhibit-2',
      name: '山水古画',
      type: 'painting',
      value: 800000,
      maxHumidity: 55,
      startPosition: exhibitPos,
    },
    exhibits: [exhibitPos],
    storagePosition: storagePos,
    storage: storagePos,
    maxRounds: 40,
    availableCards: ['A', 'B'],
    desiccantCount: 2,
    humidity: 40,
    congestion: buildCongestionMap(congestionZones, 40),
  };
};

const createLevel3 = (): Level => {
  const width = 16;
  const height = 14;
  const map = createEmptyMap(width, height);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      map[y][x] = 'floor';
    }
  }

  for (let y = 1; y <= 4; y++) map[y][4] = 'wall';
  for (let x = 5; x <= 14; x++) map[4][x] = 'wall';
  map[4][5] = 'floor';

  for (let y = 5; y <= 8; y++) map[y][6] = 'wall';
  for (let y = 5; y <= 6; y++) map[y][12] = 'wall';
  for (let x = 7; x <= 11; x++) map[6][x] = 'wall';

  for (let y = 7; y <= 11; y++) map[y][4] = 'wall';
  for (let y = 8; y <= 10; y++) map[y][10] = 'wall';
  for (let x = 7; x <= 9; x++) map[8][x] = 'wall';
  for (let x = 7; x <= 9; x++) map[10][x] = 'wall';

  for (let y = 9; y <= 12; y++) map[y][6] = 'wall';
  for (let y = 10; y <= 12; y++) map[y][9] = 'wall';

  map[5][5] = 'door';
  map[7][6] = 'door';
  map[9][6] = 'door';

  map[2][2] = 'exhibit';
  map[12][14] = 'storage';

  map[6][2] = 'congestion';
  map[9][2] = 'humidity';
  map[5][8] = 'humidity';
  map[9][11] = 'congestion';
  map[12][2] = 'humidity';
  map[11][11] = 'congestion';

  const exhibitPos = { x: 2, y: 2 };
  const storagePos = { x: 14, y: 12 };
  const congestionZones = [
    { position: { x: 2, y: 6 }, activeRounds: [10, 11, 12] },
    { position: { x: 11, y: 9 }, activeRounds: [18, 19, 20] },
    { position: { x: 11, y: 11 }, activeRounds: [25, 26, 27] },
  ];

  const guardPath1: Position[] = [
    { x: 12, y: 3 },
    { x: 13, y: 3 },
    { x: 14, y: 3 },
    { x: 14, y: 4 },
    { x: 13, y: 4 },
    { x: 12, y: 4 },
    { x: 11, y: 4 },
    { x: 10, y: 4 },
    { x: 10, y: 3 },
    { x: 11, y: 3 },
  ];

  const guardPath2: Position[] = [
    { x: 11, y: 8 },
    { x: 12, y: 8 },
    { x: 13, y: 8 },
    { x: 13, y: 9 },
    { x: 13, y: 10 },
    { x: 12, y: 10 },
    { x: 11, y: 10 },
    { x: 11, y: 9 },
  ];

  return {
    id: 3,
    name: '宝鼎转移',
    difficulty: 'hard',
    gridSize: { width, height },
    width,
    height,
    map,
    cells: map,
    doors: [
      {
        id: 'door-a-3',
        position: { x: 5, y: 5 },
        requiredCard: 'A',
        isOpen: false,
        isAuthorized: true,
      },
      {
        id: 'door-b-2',
        position: { x: 6, y: 7 },
        requiredCard: 'B',
        isOpen: false,
        isAuthorized: true,
      },
      {
        id: 'door-c-1',
        position: { x: 6, y: 9 },
        requiredCard: 'C',
        isOpen: false,
        isAuthorized: true,
      },
    ],
    humidityZones: [
      {
        id: 'humidity-4',
        position: { x: 2, y: 9 },
        humidity: 70,
        radius: 1,
      },
      {
        id: 'humidity-5',
        position: { x: 8, y: 5 },
        humidity: 80,
        radius: 1,
      },
      {
        id: 'humidity-6',
        position: { x: 2, y: 12 },
        humidity: 85,
        radius: 1,
      },
    ],
    congestionZones: [
      {
        id: 'congestion-4',
        position: { x: 2, y: 6 },
        activeRounds: [10, 11, 12],
      },
      {
        id: 'congestion-5',
        position: { x: 11, y: 9 },
        activeRounds: [18, 19, 20],
      },
      {
        id: 'congestion-6',
        position: { x: 11, y: 11 },
        activeRounds: [25, 26, 27],
      },
    ],
    guards: [
      {
        id: 'guard-2',
        position: guardPath1[0],
        patrolPath: guardPath1,
        currentPathIndex: 0,
        patrolIndex: 0,
        visionRange: 2,
        isAlerted: false,
      },
      {
        id: 'guard-3',
        position: guardPath2[0],
        patrolPath: guardPath2,
        currentPathIndex: 0,
        patrolIndex: 0,
        visionRange: 2,
        isAlerted: false,
      },
    ],
    exhibit: {
      id: 'exhibit-3',
      name: '青铜大鼎',
      type: 'sculpture',
      value: 1200000,
      maxHumidity: 50,
      startPosition: exhibitPos,
    },
    exhibits: [exhibitPos],
    storagePosition: storagePos,
    storage: storagePos,
    maxRounds: 50,
    availableCards: ['A', 'B', 'C'],
    desiccantCount: 2,
    humidity: 40,
    congestion: buildCongestionMap(congestionZones, 50),
  };
};

export const LEVELS: Level[] = [createLevel1(), createLevel2(), createLevel3()];
