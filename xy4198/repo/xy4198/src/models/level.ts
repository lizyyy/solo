import { Level, Position, Customer, Sign, Direction } from './types';

export const DEFAULT_MAX_TIME_STEPS = 100;

export function createLevel(
  width: number,
  height: number,
  name: string = '新关卡'
): Level {
  return {
    id: generateId(),
    name,
    width,
    height,
    walls: [],
    exits: [],
    smokeSources: [],
    customers: [],
    signs: [],
    maxTimeSteps: DEFAULT_MAX_TIME_STEPS,
  };
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export function createCustomer(position: Position): Customer {
  return {
    id: generateId(),
    position: { ...position },
    targetExit: null,
    path: [],
    pathIndex: 0,
    isEvacuated: false,
    isTrapped: false,
    speed: 1,
    waitTime: 0,
    lastDirection: null,
  };
}

export function createSign(position: Position, direction: Direction): Sign {
  return {
    id: generateId(),
    position: { ...position },
    direction,
  };
}

export function positionsEqual(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}

export function containsPosition(positions: Position[], target: Position): boolean {
  return positions.some(p => positionsEqual(p, target));
}

export function removePosition(positions: Position[], target: Position): Position[] {
  return positions.filter(p => !positionsEqual(p, target));
}

export function isValidPosition(level: Level, position: Position): boolean {
  return (
    position.x >= 0 &&
    position.x < level.width &&
    position.y >= 0 &&
    position.y < level.height
  );
}

export function isBlocked(level: Level, position: Position): boolean {
  return containsPosition(level.walls, position);
}

export function isExit(level: Level, position: Position): boolean {
  return containsPosition(level.exits, position);
}

export function isSmokeSource(level: Level, position: Position): boolean {
  return containsPosition(level.smokeSources, position);
}

export function getCustomerAt(level: Level, position: Position): Customer | undefined {
  return level.customers.find(c =>
    positionsEqual(c.position, position) && !c.isEvacuated && !c.isTrapped
  );
}

export function getSignAt(level: Level, position: Position): Sign | undefined {
  return level.signs.find(s => positionsEqual(s.position, position));
}

export function getNeighbors(position: Position): Position[] {
  return [
    { x: position.x, y: position.y - 1 },
    { x: position.x + 1, y: position.y },
    { x: position.x, y: position.y + 1 },
    { x: position.x - 1, y: position.y },
  ];
}

export function cloneLevel(level: Level): Level {
  return {
    id: level.id,
    name: level.name,
    width: level.width,
    height: level.height,
    walls: level.walls.map(w => ({ ...w })),
    exits: level.exits.map(e => ({ ...e })),
    smokeSources: level.smokeSources.map(s => ({ ...s })),
    customers: level.customers.map(c => ({
      ...c,
      position: { ...c.position },
      targetExit: c.targetExit ? { ...c.targetExit } : null,
      path: c.path.map(p => ({ ...p })),
    })),
    signs: level.signs.map(s => ({
      ...s,
      position: { ...s.position },
    })),
    maxTimeSteps: level.maxTimeSteps,
  };
}

export function resizeLevel(level: Level, newWidth: number, newHeight: number): Level {
  const resized = cloneLevel(level);
  resized.width = newWidth;
  resized.height = newHeight;

  const filterValid = (positions: Position[]): Position[] =>
    positions.filter(p => p.x < newWidth && p.y < newHeight);

  resized.walls = filterValid(resized.walls);
  resized.exits = filterValid(resized.exits);
  resized.smokeSources = filterValid(resized.smokeSources);
  resized.customers = resized.customers.filter(
    c => c.position.x < newWidth && c.position.y < newHeight
  );
  resized.signs = resized.signs.filter(
    s => s.position.x < newWidth && s.position.y < newHeight
  );

  return resized;
}

export function clearLevel(level: Level): Level {
  return {
    ...createLevel(level.width, level.height, level.name),
    id: level.id,
  };
}
