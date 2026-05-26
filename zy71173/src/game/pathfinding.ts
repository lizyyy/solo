import type { Level, Position, Card, PathValidationResult } from './types';
import {
  isWalkable,
  getCellType,
  getDoorAt,
  isAdjacent,
  positionsEqual,
} from './map';

export function validatePath(
  path: Position[],
  level: Level,
  availableCards: Card[]
): PathValidationResult {
  const errors: string[] = [];

  if (path.length < 2) {
    errors.push('路径至少需要包含起点和终点两个点');
    return { valid: false, errors };
  }

  const start = path[0];
  const end = path[path.length - 1];

  if (!positionsEqual(start, level.exhibit.startPosition)) {
    errors.push('起点必须是展品位置');
  }

  if (!positionsEqual(end, level.storagePosition)) {
    errors.push('终点必须是库房位置');
  }

  const cardTypes = new Set(availableCards.map((card) => card.type));

  for (let i = 0; i < path.length; i++) {
    const current = path[i];

    if (i > 0) {
      const prev = path[i - 1];
      if (!isAdjacent(prev, current)) {
        errors.push(`第 ${i} 步不连续：从 (${prev.x},${prev.y}) 到 (${current.x},${current.y}) 不相邻`);
      }
    }

    if (!isWalkable(level, current.x, current.y)) {
      errors.push(`路径穿墙：坐标 (${current.x},${current.y}) 是墙壁`);
    }

    const cellType = getCellType(level, current.x, current.y);
    if (cellType === 'door') {
      const door = getDoorAt(level, current.x, current.y);
      if (door && !door.isOpen && !cardTypes.has(door.requiredCard)) {
        errors.push(`门禁权限不足：坐标 (${current.x},${current.y}) 的门需要 ${door.requiredCard} 门禁卡`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function getPathLength(path: Position[]): number {
  return Math.max(0, path.length - 1);
}

type Node = {
  position: Position;
  g: number;
  h: number;
  f: number;
  parent: Node | null;
};

function heuristic(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function getNeighbors(pos: Position, level: Level): Position[] {
  const directions = [
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
  ];

  return directions
    .map((d) => ({ x: pos.x + d.x, y: pos.y + d.y }))
    .filter((p) => isWalkable(level, p.x, p.y));
}

function reconstructPath(endNode: Node): Position[] {
  const path: Position[] = [];
  let current: Node | null = endNode;
  while (current) {
    path.unshift(current.position);
    current = current.parent;
  }
  return path;
}

export function findPath(
  level: Level,
  start: Position,
  end: Position,
  availableCards: Card[]
): Position[] | null {
  const cardTypes = new Set(availableCards.map((card) => card.type));

  const canPass = (pos: Position): boolean => {
    if (!isWalkable(level, pos.x, pos.y)) return false;
    const cellType = getCellType(level, pos.x, pos.y);
    if (cellType === 'door') {
      const door = getDoorAt(level, pos.x, pos.y);
      if (door && !door.isOpen && !cardTypes.has(door.requiredCard)) {
        return false;
      }
    }
    return true;
  };

  const openSet: Node[] = [];
  const closedSet = new Set<string>();

  const startNode: Node = {
    position: start,
    g: 0,
    h: heuristic(start, end),
    f: heuristic(start, end),
    parent: null,
  };

  openSet.push(startNode);

  while (openSet.length > 0) {
    openSet.sort((a, b) => a.f - b.f);
    const current = openSet.shift()!;

    if (positionsEqual(current.position, end)) {
      return reconstructPath(current);
    }

    const currentKey = `${current.position.x},${current.position.y}`;
    closedSet.add(currentKey);

    const neighbors = getNeighbors(current.position, level);

    for (const neighbor of neighbors) {
      if (!canPass(neighbor)) continue;

      const neighborKey = `${neighbor.x},${neighbor.y}`;
      if (closedSet.has(neighborKey)) continue;

      const tentativeG = current.g + 1;

      const existingNode = openSet.find(
        (n) => n.position.x === neighbor.x && n.position.y === neighbor.y
      );

      if (!existingNode) {
        const h = heuristic(neighbor, end);
        const newNode: Node = {
          position: neighbor,
          g: tentativeG,
          h,
          f: tentativeG + h,
          parent: current,
        };
        openSet.push(newNode);
      } else if (tentativeG < existingNode.g) {
        existingNode.g = tentativeG;
        existingNode.f = tentativeG + existingNode.h;
        existingNode.parent = current;
      }
    }
  }

  return null;
}
