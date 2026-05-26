import type { Level, Position, Door } from './types';

const posKey = (x: number, y: number): string => `${x},${y}`;

export function isWalkable(level: Level, x: number, y: number): boolean {
  if (x < 0 || x >= level.gridSize.width || y < 0 || y >= level.gridSize.height) {
    return false;
  }
  const cellType = level.map[y]?.[x];
  return cellType !== 'wall';
}

export function getCellType(level: Level, x: number, y: number): string | null {
  if (x < 0 || x >= level.gridSize.width || y < 0 || y >= level.gridSize.height) {
    return null;
  }
  return level.map[y]?.[x] ?? null;
}

export function getDoorAt(level: Level, x: number, y: number): Door | null {
  return level.doors.find(
    (door) => door.position.x === x && door.position.y === y
  ) ?? null;
}

export function getHumidityAt(level: Level, x: number, y: number): number {
  for (const zone of level.humidityZones) {
    const dx = x - zone.position.x;
    const dy = y - zone.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance <= zone.radius) {
      return zone.humidity;
    }
  }
  return level.humidity ?? 0;
}

export function isCongestedAt(level: Level, x: number, y: number, round: number): boolean {
  return level.congestionZones.some(
    (zone) =>
      zone.position.x === x &&
      zone.position.y === y &&
      zone.activeRounds.includes(round)
  );
}

export function positionsEqual(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}

export function isAdjacent(a: Position, b: Position): boolean {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
}
