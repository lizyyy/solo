import {
  Position,
  Robot,
  Order,
  Level,
  GameEvent,
  Score,
  Rating,
} from '../types/game';
import { findPath, getShelfAdjacentPositions } from './pathfinding';

export const MOVE_COST_PER_CELL = 1;
export const CHARGE_RATE_PER_SECOND = 5;
export const BASE_SCORE_PER_ORDER = 100;
export const EFFICIENCY_BONUS_PER_MINUTE = 50;
export const COLLISION_PENALTY = 200;
export const TIMEOUT_PENALTY_PER_MINUTE = 100;
export const BATTERY_DEAD_PENALTY = 150;
export const INVALID_PATH_PENALTY = 20;
export const PICK_TIME = 1;

export function checkCollision(
  robots: Robot[],
  prevPositions: Map<string, Position>
): { collided: boolean; robotIds: string[] } {
  const positionMap = new Map<string, string[]>();
  const collidedIds = new Set<string>();

  for (const robot of robots) {
    if (robot.status === 'dead') continue;
    
    const posKey = `${robot.position.x},${robot.position.y}`;
    if (positionMap.has(posKey)) {
      positionMap.get(posKey)!.push(robot.id);
      positionMap.get(posKey)!.forEach((id) => collidedIds.add(id));
    } else {
      positionMap.set(posKey, [robot.id]);
    }
  }

  for (let i = 0; i < robots.length; i++) {
    for (let j = i + 1; j < robots.length; j++) {
      const r1 = robots[i];
      const r2 = robots[j];
      if (r1.status === 'dead' || r2.status === 'dead') continue;

      const prev1 = prevPositions.get(r1.id) || r1.position;
      const prev2 = prevPositions.get(r2.id) || r2.position;

      if (
        prev1.x === r2.position.x &&
        prev1.y === r2.position.y &&
        prev2.x === r1.position.x &&
        prev2.y === r1.position.y
      ) {
        collidedIds.add(r1.id);
        collidedIds.add(r2.id);
      }
    }
  }

  return {
    collided: collidedIds.size > 0,
    robotIds: Array.from(collidedIds),
  };
}

export function isAtChargingStation(
  robot: Robot,
  chargingStations: Position[]
): boolean {
  return chargingStations.some(
    (station) =>
      station.x === robot.position.x && station.y === robot.position.y
  );
}

export function isAtShelf(robot: Robot, shelves: Position[]): boolean {
  return shelves.some(
    (shelf) => shelf.x === robot.position.x && shelf.y === robot.position.y
  );
}

export function isAdjacentToShelf(
  robotPos: Position,
  shelfPos: Position
): boolean {
  const dx = Math.abs(robotPos.x - shelfPos.x);
  const dy = Math.abs(robotPos.y - shelfPos.y);
  return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
}

export function calculateScore(
  completedOrders: number,
  totalTime: number,
  totalOrderDeadline: number,
  collisions: number,
  timeouts: number,
  batteryDeaths: number,
  invalidPaths: number
): Score {
  const baseScore = completedOrders * BASE_SCORE_PER_ORDER;
  
  const timeSaved = Math.max(0, totalOrderDeadline - totalTime);
  const efficiencyBonus = Math.floor((timeSaved / 60) * EFFICIENCY_BONUS_PER_MINUTE);
  
  const collisionPenalty = collisions * COLLISION_PENALTY;
  const timeoutPenalty = timeouts * TIMEOUT_PENALTY_PER_MINUTE;
  const batteryPenalty = batteryDeaths * BATTERY_DEAD_PENALTY;
  const invalidPathPenalty = invalidPaths * INVALID_PATH_PENALTY;
  
  const total = baseScore + efficiencyBonus - collisionPenalty - timeoutPenalty - batteryPenalty - invalidPathPenalty;
  
  let rating: Rating = 'F';
  if (total >= 500) rating = 'S';
  else if (total >= 400) rating = 'A';
  else if (total >= 300) rating = 'B';
  else if (total >= 200) rating = 'C';
  else if (total >= 100) rating = 'D';
  
  return {
    baseScore,
    efficiencyBonus,
    collisionPenalty,
    timeoutPenalty,
    batteryPenalty,
    invalidPathPenalty,
    total: Math.max(0, total),
    rating,
  };
}

export function planPathToTarget(
  robot: Robot,
  target: Position,
  level: Level,
  otherRobots: Robot[]
): Position[] | null {
  const obstaclePositions = level.obstacles.map((o) => o.position);
  const shelfPositions = level.shelves.map((s) => s.position);
  const otherRobotPositions = otherRobots
    .filter((r) => r.id !== robot.id && r.status !== 'dead')
    .map((r) => r.position);

  return findPath(
    robot.position,
    target,
    level.gridSize.width,
    level.gridSize.height,
    obstaclePositions,
    shelfPositions,
    otherRobotPositions
  );
}

export function planPathToShelf(
  robot: Robot,
  shelfId: string,
  level: Level,
  otherRobots: Robot[]
): { path: Position[]; targetPos: Position } | null {
  const shelf = level.shelves.find((s) => s.id === shelfId);
  if (!shelf) return null;

  const adjacentPositions = getShelfAdjacentPositions(
    shelf.position,
    level.gridSize.width,
    level.gridSize.height
  );

  let bestPath: Position[] | null = null;
  let bestPos: Position | null = null;

  for (const pos of adjacentPositions) {
    const path = planPathToTarget(robot, pos, level, otherRobots);
    if (path && (!bestPath || path.length < bestPath.length)) {
      bestPath = path;
      bestPos = pos;
    }
  }

  if (bestPath && bestPos) {
    return { path: bestPath, targetPos: bestPos };
  }

  return null;
}

export function createEvent(
  type: GameEvent['type'],
  data: Record<string, any>,
  timestamp: number
): GameEvent {
  return {
    timestamp,
    type,
    data,
  };
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
