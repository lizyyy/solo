import { CONFIG } from './config';
import { Drain, GridCell, Lowland, Pump, RainEvent } from './types';

const generateElevation = (x: number, y: number): number => {
  const centerX = CONFIG.GRID_SIZE / 2;
  const centerY = CONFIG.GRID_SIZE / 2;
  const distFromCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
  return Math.max(1, 10 - distFromCenter * 0.8 + Math.random() * 2);
};

export const createInitialGrid = (): GridCell[][] => {
  const grid: GridCell[][] = [];
  
  for (let y = 0; y < CONFIG.GRID_SIZE; y++) {
    grid[y] = [];
    for (let x = 0; x < CONFIG.GRID_SIZE; x++) {
      grid[y][x] = {
        x,
        y,
        type: 'road',
        elevation: generateElevation(x, y),
        waterDepth: 0,
      };
    }
  }

  const buildings = [
    [1, 1], [1, 2], [2, 1],
    [7, 1], [8, 1], [8, 2],
    [1, 7], [1, 8], [2, 8],
    [7, 7], [8, 7], [7, 8],
    [4, 4], [5, 4], [4, 5], [5, 5],
  ];
  buildings.forEach(([x, y]) => {
    if (grid[y] && grid[y][x]) {
      grid[y][x].type = 'building';
    }
  });

  return grid;
};

export const createFacilities = (): (Drain | Pump | Lowland)[] => {
  const drains: Drain[] = [
    { id: 'drain-1', type: 'drain', x: 3, y: 3, status: 'normal', efficiency: 1, capacity: CONFIG.DRAIN_BASE_CAPACITY, blockage: 0, inflow: 0, collectedWater: 0 },
    { id: 'drain-2', type: 'drain', x: 6, y: 3, status: 'normal', efficiency: 1, capacity: CONFIG.DRAIN_BASE_CAPACITY, blockage: 0, inflow: 0, collectedWater: 0 },
    { id: 'drain-3', type: 'drain', x: 3, y: 6, status: 'normal', efficiency: 1, capacity: CONFIG.DRAIN_BASE_CAPACITY, blockage: 0, inflow: 0, collectedWater: 0 },
    { id: 'drain-4', type: 'drain', x: 6, y: 6, status: 'normal', efficiency: 1, capacity: CONFIG.DRAIN_BASE_CAPACITY, blockage: 0, inflow: 0, collectedWater: 0 },
    { id: 'drain-5', type: 'drain', x: 0, y: 5, status: 'normal', efficiency: 1, capacity: CONFIG.DRAIN_BASE_CAPACITY, blockage: 0, inflow: 0, collectedWater: 0 },
    { id: 'drain-6', type: 'drain', x: 9, y: 5, status: 'normal', efficiency: 1, capacity: CONFIG.DRAIN_BASE_CAPACITY, blockage: 0, inflow: 0, collectedWater: 0 },
  ];

  const pumps: Pump[] = [
    { id: 'pump-1', type: 'pump', x: 1, y: 5, status: 'normal', efficiency: 1, power: 0.6, maxPower: CONFIG.PUMP_BASE_POWER, currentLoad: 0, overloadCount: 0, connectedDrains: ['drain-1', 'drain-3', 'drain-5'], pumpedWater: 0 },
    { id: 'pump-2', type: 'pump', x: 8, y: 5, status: 'normal', efficiency: 1, power: 0.6, maxPower: CONFIG.PUMP_BASE_POWER, currentLoad: 0, overloadCount: 0, connectedDrains: ['drain-2', 'drain-4', 'drain-6'], pumpedWater: 0 },
  ];

  const lowlands: Lowland[] = [
    { id: 'lowland-1', type: 'lowland', x: 5, y: 2, status: 'normal', efficiency: 1, waterLevel: 0, maxSafeLevel: CONFIG.LOWLAND_DANGER_THRESHOLD, warningThreshold: CONFIG.LOWLAND_DANGER_THRESHOLD * 0.6, dangerCount: 0, temporaryDrainRemaining: 0, hasActivePump: false },
    { id: 'lowland-2', type: 'lowland', x: 5, y: 8, status: 'normal', efficiency: 1, waterLevel: 0, maxSafeLevel: CONFIG.LOWLAND_DANGER_THRESHOLD, warningThreshold: CONFIG.LOWLAND_DANGER_THRESHOLD * 0.6, dangerCount: 0, temporaryDrainRemaining: 0, hasActivePump: false },
  ];

  return [...drains, ...pumps, ...lowlands];
};

export const createRainEvents = (): RainEvent[] => [
  {
    startTurn: 1,
    duration: 2,
    intensity: 'light',
    affectedArea: [{ x: 5, y: 5, radius: 4 }],
  },
  {
    startTurn: 4,
    duration: 3,
    intensity: 'moderate',
    affectedArea: [{ x: 3, y: 3, radius: 3 }, { x: 7, y: 7, radius: 3 }],
  },
  {
    startTurn: 8,
    duration: 2,
    intensity: 'heavy',
    affectedArea: [{ x: 5, y: 5, radius: 5 }],
  },
  {
    startTurn: 12,
    duration: 3,
    intensity: 'storm',
    affectedArea: [{ x: 2, y: 2, radius: 4 }, { x: 7, y: 7, radius: 4 }],
  },
];

export const initializeGameData = () => {
  const grid = createInitialGrid();
  const facilities = createFacilities();
  const rainEvents = createRainEvents();

  facilities.forEach(facility => {
    if (grid[facility.y] && grid[facility.y][facility.x]) {
      grid[facility.y][facility.x].type = facility.type;
      grid[facility.y][facility.x].facility = facility;
      if (facility.type === 'lowland') {
        grid[facility.y][facility.x].elevation = 2;
      }
    }
  });

  return { grid, facilities, rainEvents };
};
