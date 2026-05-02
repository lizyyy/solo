import { Level, Position, Direction, Customer, SmokeCell } from '../models/types';
import { positionsEqual, getNeighbors, isValidPosition, isBlocked, getSignAt } from '../models/level';

interface Node {
  position: Position;
  g: number;
  h: number;
  f: number;
  parent: Node | null;
  directionFromParent: Direction | null;
}

export function heuristic(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function getDirection(from: Position, to: Position): Direction | null {
  if (to.x > from.x) return Direction.RIGHT;
  if (to.x < from.x) return Direction.LEFT;
  if (to.y > from.y) return Direction.DOWN;
  if (to.y < from.y) return Direction.UP;
  return null;
}

export function findPath(
  level: Level,
  start: Position,
  goal: Position,
  smokeCells: SmokeCell[] = [],
  blockedPositions: Position[] = []
): Position[] | null {
  const openSet: Node[] = [];
  const closedSet = new Set<string>();

  const startNode: Node = {
    position: start,
    g: 0,
    h: heuristic(start, goal),
    f: heuristic(start, goal),
    parent: null,
    directionFromParent: null,
  };

  openSet.push(startNode);

  const positionKey = (p: Position): string => `${p.x},${p.y}`;

  while (openSet.length > 0) {
    openSet.sort((a, b) => a.f - b.f);
    const current = openSet.shift()!;

    if (positionsEqual(current.position, goal)) {
      const path: Position[] = [];
      let node: Node | null = current;
      while (node) {
        path.unshift(node.position);
        node = node.parent;
      }
      return path;
    }

    closedSet.add(positionKey(current.position));

    const neighbors = getNeighbors(current.position);

    for (const neighbor of neighbors) {
      if (closedSet.has(positionKey(neighbor))) continue;
      if (!isValidPosition(level, neighbor)) continue;
      if (isBlocked(level, neighbor)) continue;
      if (blockedPositions.some(p => positionsEqual(p, neighbor))) continue;

      const hasSmoke = smokeCells.some(s =>
        positionsEqual(s.position, neighbor) && s.density > 0.3
      );
      if (hasSmoke) continue;

      const g = current.g + 1;
      const h = heuristic(neighbor, goal);
      const f = g + h;

      const existingNode = openSet.find(n => positionsEqual(n.position, neighbor));

      if (existingNode) {
        if (g < existingNode.g) {
          existingNode.g = g;
          existingNode.f = f;
          existingNode.parent = current;
          existingNode.directionFromParent = getDirection(current.position, neighbor);
        }
      } else {
        openSet.push({
          position: neighbor,
          g,
          h,
          f,
          parent: current,
          directionFromParent: getDirection(current.position, neighbor),
        });
      }
    }
  }

  return null;
}

export function findNearestExit(
  level: Level,
  position: Position,
  smokeCells: SmokeCell[] = [],
  blockedPositions: Position[] = []
): Position | null {
  let nearestExit: Position | null = null;
  let minDistance = Infinity;

  for (const exit of level.exits) {
    const path = findPath(level, position, exit, smokeCells, blockedPositions);
    if (path) {
      const distance = heuristic(position, exit);
      if (distance < minDistance) {
        minDistance = distance;
        nearestExit = exit;
      }
    }
  }

  return nearestExit;
}

export function findPathWithSigns(
  level: Level,
  customer: Customer,
  smokeCells: SmokeCell[] = [],
  blockedPositions: Position[] = []
): Position[] | null {
  const currentPos = customer.position;

  const sign = getSignAt(level, currentPos);
  if (sign) {
    const directedPosition = getDirectedPosition(currentPos, sign.direction);
    if (isValidPosition(level, directedPosition) && !isBlocked(level, directedPosition)) {
      const nearestExit = findNearestExit(level, directedPosition, smokeCells, blockedPositions);
      if (nearestExit) {
        const pathToDirected = [currentPos, directedPosition];
        const pathFromDirected = findPath(
          level,
          directedPosition,
          nearestExit,
          smokeCells,
          blockedPositions
        );
        if (pathFromDirected) {
          return [...pathToDirected, ...pathFromDirected.slice(1)];
        }
      }
    }
  }

  const nearestExit = findNearestExit(level, currentPos, smokeCells, blockedPositions);
  if (!nearestExit) return null;

  return findPath(level, currentPos, nearestExit, smokeCells, blockedPositions);
}

function getDirectedPosition(position: Position, direction: Direction): Position {
  switch (direction) {
    case Direction.UP:
      return { x: position.x, y: position.y - 1 };
    case Direction.DOWN:
      return { x: position.x, y: position.y + 1 };
    case Direction.LEFT:
      return { x: position.x - 1, y: position.y };
    case Direction.RIGHT:
      return { x: position.x + 1, y: position.y };
  }
}

export function getPathDirection(from: Position, to: Position): Direction | null {
  return getDirection(from, to);
}

export function isOppositeDirection(a: Direction | null, b: Direction | null): boolean {
  if (!a || !b) return false;
  return (
    (a === Direction.UP && b === Direction.DOWN) ||
    (a === Direction.DOWN && b === Direction.UP) ||
    (a === Direction.LEFT && b === Direction.RIGHT) ||
    (a === Direction.RIGHT && b === Direction.LEFT)
  );
}
