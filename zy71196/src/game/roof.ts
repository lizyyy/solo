import type { RoofMap, Drain, LowArea, Obstacle, Position, LevelConfig } from './types';
import { GAME_CONSTANTS } from './config';

const generateId = (): string => Math.random().toString(36).substring(2, 9);

const getDistance = (p1: Position, p2: Position): number => {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
};

const isPositionValid = (
  position: Position,
  existingPositions: Position[],
  minDistance: number,
  width: number,
  height: number,
  margin: number = 1
): boolean => {
  if (
    position.x < margin ||
    position.x >= width - margin ||
    position.y < margin ||
    position.y >= height - margin
  ) {
    return false;
  }

  return existingPositions.every(
    (existing) => getDistance(position, existing) >= minDistance
  );
};

const generateRandomPosition = (width: number, height: number, margin: number = 1): Position => {
  return {
    x: Math.floor(Math.random() * (width - 2 * margin)) + margin,
    y: Math.floor(Math.random() * (height - 2 * margin)) + margin,
  };
};

export const generateDrains = (
  count: number,
  width: number,
  height: number,
  blockageChance: number
): Drain[] => {
  const drains: Drain[] = [];
  const positions: Position[] = [];
  const maxAttempts = 1000;
  let attempts = 0;

  while (drains.length < count && attempts < maxAttempts) {
    const position = generateRandomPosition(width, height);
    attempts++;

    if (isPositionValid(position, positions, GAME_CONSTANTS.MIN_DRAIN_DISTANCE, width, height)) {
      const isBlocked = Math.random() < blockageChance;
      drains.push({
        id: generateId(),
        position,
        isBlocked,
        blockageSeverity: isBlocked ? Math.floor(Math.random() * 60) + 40 : 0,
        flowRate: GAME_CONSTANTS.BASE_FLOW_RATE,
        inspected: false,
        resolved: false,
      });
      positions.push(position);
    }
  }

  return drains;
};

export const generateLowAreas = (
  count: number,
  width: number,
  height: number
): LowArea[] => {
  const lowAreas: LowArea[] = [];
  const positions: Position[] = [];
  const maxAttempts = 1000;
  let attempts = 0;

  while (lowAreas.length < count && attempts < maxAttempts) {
    const position = generateRandomPosition(width, height);
    attempts++;

    if (isPositionValid(position, positions, GAME_CONSTANTS.MIN_LOWAREA_DISTANCE, width, height)) {
      const radius = Math.floor(Math.random() * 2) + 1;
      lowAreas.push({
        id: generateId(),
        position: { ...position, radius },
        waterLevel: Math.floor(Math.random() * 30),
        maxCapacity: 100,
        inspected: false,
        pumped: false,
      });
      positions.push(position);
    }
  }

  return lowAreas;
};

export const generateObstacles = (
  count: number,
  width: number,
  height: number,
  drains: Drain[],
  lowAreas: LowArea[]
): Obstacle[] => {
  const obstacles: Obstacle[] = [];
  const existingPositions = [
    ...drains.map((d) => d.position),
    ...lowAreas.map((l) => l.position),
  ];
  const types: ('vent' | 'ac' | 'pipe')[] = ['vent', 'ac', 'pipe'];
  const maxAttempts = 1000;
  let attempts = 0;

  while (obstacles.length < count && attempts < maxAttempts) {
    const position = generateRandomPosition(width, height);
    attempts++;

    if (isPositionValid(position, existingPositions, 1.5, width, height)) {
      const type = types[Math.floor(Math.random() * types.length)];
      obstacles.push({
        id: generateId(),
        position,
        type,
        width: type === 'ac' ? 1.5 : type === 'pipe' ? 0.5 : 1,
        height: type === 'ac' ? 1.5 : type === 'pipe' ? 2 : 1,
      });
      existingPositions.push(position);
    }
  }

  return obstacles;
};

export const generateRoofMap = (config: LevelConfig): RoofMap => {
  const drains = generateDrains(
    config.drainCount,
    config.roofSize.width,
    config.roofSize.height,
    config.initialBlockageChance
  );

  const lowAreas = generateLowAreas(
    config.lowAreaCount,
    config.roofSize.width,
    config.roofSize.height
  );

  const obstacles = generateObstacles(
    config.obstacleCount,
    config.roofSize.width,
    config.roofSize.height,
    drains,
    lowAreas
  );

  return {
    width: config.roofSize.width,
    height: config.roofSize.height,
    drains,
    lowAreas,
    obstacles,
  };
};

export const cloneRoofMap = (roofMap: RoofMap): RoofMap => {
  return {
    ...roofMap,
    drains: roofMap.drains.map((d) => ({ ...d })),
    lowAreas: roofMap.lowAreas.map((l) => ({ ...l })),
    obstacles: roofMap.obstacles.map((o) => ({ ...o })),
  };
};
