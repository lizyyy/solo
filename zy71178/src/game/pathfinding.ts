import { Position } from '../types/game';

interface Node {
  position: Position;
  g: number;
  h: number;
  f: number;
  parent: Node | null;
}

function manhattanDistance(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function getNeighbors(pos: Position, width: number, height: number): Position[] {
  const neighbors: Position[] = [];
  const directions = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ];

  for (const dir of directions) {
    const newX = pos.x + dir.x;
    const newY = pos.y + dir.y;
    if (newX >= 0 && newX < width && newY >= 0 && newY < height) {
      neighbors.push({ x: newX, y: newY });
    }
  }

  return neighbors;
}

function positionKey(pos: Position): string {
  return `${pos.x},${pos.y}`;
}

function isBlocked(
  pos: Position,
  obstacles: Set<string>,
  shelves: Set<string>,
  otherRobots: Set<string>
): boolean {
  const key = positionKey(pos);
  return obstacles.has(key) || shelves.has(key) || otherRobots.has(key);
}

export function findPath(
  start: Position,
  goal: Position,
  gridWidth: number,
  gridHeight: number,
  obstacles: Position[],
  shelves: Position[],
  otherRobots: Position[]
): Position[] | null {
  if (start.x === goal.x && start.y === goal.y) {
    return [];
  }

  const obstacleSet = new Set(obstacles.map(positionKey));
  const shelfSet = new Set(shelves.map(positionKey));
  const robotSet = new Set(otherRobots.map(positionKey));

  const openSet: Node[] = [];
  const closedSet = new Set<string>();

  const startNode: Node = {
    position: start,
    g: 0,
    h: manhattanDistance(start, goal),
    f: manhattanDistance(start, goal),
    parent: null,
  };

  openSet.push(startNode);

  while (openSet.length > 0) {
    openSet.sort((a, b) => a.f - b.f);
    const current = openSet.shift()!;
    const currentKey = positionKey(current.position);

    if (current.position.x === goal.x && current.position.y === goal.y) {
      const path: Position[] = [];
      let node: Node | null = current;
      while (node) {
        path.unshift(node.position);
        node = node.parent;
      }
      return path.slice(1);
    }

    closedSet.add(currentKey);

    const neighbors = getNeighbors(current.position, gridWidth, gridHeight);

    for (const neighborPos of neighbors) {
      const neighborKey = positionKey(neighborPos);

      if (closedSet.has(neighborKey)) {
        continue;
      }

      const isGoal = neighborPos.x === goal.x && neighborPos.y === goal.y;
      
      if (!isGoal && isBlocked(neighborPos, obstacleSet, shelfSet, robotSet)) {
        continue;
      }

      const g = current.g + 1;
      const h = manhattanDistance(neighborPos, goal);
      const f = g + h;

      const existingNode = openSet.find(
        (n) => n.position.x === neighborPos.x && n.position.y === neighborPos.y
      );

      if (existingNode) {
        if (g < existingNode.g) {
          existingNode.g = g;
          existingNode.f = f;
          existingNode.parent = current;
        }
      } else {
        openSet.push({
          position: neighborPos,
          g,
          h,
          f,
          parent: current,
        });
      }
    }
  }

  return null;
}

export function getShelfAdjacentPositions(
  shelfPos: Position,
  gridWidth: number,
  gridHeight: number
): Position[] {
  const positions: Position[] = [];
  const directions = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ];

  for (const dir of directions) {
    const x = shelfPos.x + dir.x;
    const y = shelfPos.y + dir.y;
    if (x >= 0 && x < gridWidth && y >= 0 && y < gridHeight) {
      positions.push({ x, y });
    }
  }

  return positions;
}
