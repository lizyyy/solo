import { Point, Wall, ClosedArea, Gate, GRID_SIZE } from './types';

interface GridNode {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
  parent: GridNode | null;
  walkable: boolean;
}

export class PathFinder {
  private gridWidth: number;
  private gridHeight: number;
  private walls: Wall[];
  private closedAreas: ClosedArea[];
  private gates: Gate[];

  constructor(
    stationWidth: number,
    stationHeight: number,
    walls: Wall[],
    closedAreas: ClosedArea[],
    gates: Gate[]
  ) {
    this.gridWidth = Math.ceil(stationWidth / GRID_SIZE);
    this.gridHeight = Math.ceil(stationHeight / GRID_SIZE);
    this.walls = walls;
    this.closedAreas = closedAreas;
    this.gates = gates;
  }

  private worldToGrid(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: Math.floor(worldX / GRID_SIZE),
      y: Math.floor(worldY / GRID_SIZE)
    };
  }

  private gridToWorld(gridX: number, gridY: number): Point {
    return {
      x: (gridX + 0.5) * GRID_SIZE,
      y: (gridY + 0.5) * GRID_SIZE
    };
  }

  private isWalkable(gridX: number, gridY: number): boolean {
    if (gridX < 0 || gridX >= this.gridWidth || gridY < 0 || gridY >= this.gridHeight) {
      return false;
    }

    const worldPos = this.gridToWorld(gridX, gridY);

    for (const wall of this.walls) {
      if (
        worldPos.x >= wall.x &&
        worldPos.x <= wall.x + wall.width &&
        worldPos.y >= wall.y &&
        worldPos.y <= wall.y + wall.height
      ) {
        return false;
      }
    }

    for (const area of this.closedAreas) {
      if (
        worldPos.x >= area.x &&
        worldPos.x <= area.x + area.width &&
        worldPos.y >= area.y &&
        worldPos.y <= area.y + area.height
      ) {
        return false;
      }
    }

    for (const gate of this.gates) {
      if (gate.status === 'closed') {
        const gateWidth = 1.5;
        const gateHeight = 0.5;
        if (
          worldPos.x >= gate.x - gateWidth / 2 &&
          worldPos.x <= gate.x + gateWidth / 2 &&
          worldPos.y >= gate.y - gateHeight / 2 &&
          worldPos.y <= gate.y + gateHeight / 2
        ) {
          return false;
        }
      }
    }

    return true;
  }

  private heuristic(a: GridNode, b: GridNode): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  private getNeighbors(node: GridNode, grid: GridNode[][]): GridNode[] {
    const neighbors: GridNode[] = [];
    const directions = [
      { dx: 0, dy: -1 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: -1, dy: -1 },
      { dx: 1, dy: -1 },
      { dx: 1, dy: 1 },
      { dx: -1, dy: 1 }
    ];

    for (const dir of directions) {
      const nx = node.x + dir.dx;
      const ny = node.y + dir.dy;
      if (nx >= 0 && nx < this.gridWidth && ny >= 0 && ny < this.gridHeight) {
        if (grid[ny][nx].walkable) {
          if (dir.dx !== 0 && dir.dy !== 0) {
            if (!grid[node.y][node.x + dir.dx].walkable || !grid[node.y + dir.dy][node.x].walkable) {
              continue;
            }
          }
          neighbors.push(grid[ny][nx]);
        }
      }
    }

    return neighbors;
  }

  public findPath(startX: number, startY: number, endX: number, endY: number): Point[] {
    const startGrid = this.worldToGrid(startX, startY);
    const endGrid = this.worldToGrid(endX, endY);

    if (!this.isWalkable(endGrid.x, endGrid.y)) {
      return [];
    }

    const grid: GridNode[][] = [];
    for (let y = 0; y < this.gridHeight; y++) {
      grid[y] = [];
      for (let x = 0; x < this.gridWidth; x++) {
        grid[y][x] = {
          x,
          y,
          g: Infinity,
          h: 0,
          f: Infinity,
          parent: null,
          walkable: this.isWalkable(x, y)
        };
      }
    }

    const openList: GridNode[] = [];
    const closedSet = new Set<string>();

    const startNode = grid[startGrid.y][startGrid.x];
    const endNode = grid[endGrid.y][endGrid.x];

    if (!startNode.walkable) {
      return [];
    }

    startNode.g = 0;
    startNode.h = this.heuristic(startNode, endNode);
    startNode.f = startNode.h;
    openList.push(startNode);

    while (openList.length > 0) {
      openList.sort((a, b) => a.f - b.f);
      const current = openList.shift()!;

      if (current.x === endNode.x && current.y === endNode.y) {
        const path: Point[] = [];
        let node: GridNode | null = current;
        while (node) {
          path.unshift(this.gridToWorld(node.x, node.y));
          node = node.parent;
        }
        return this.smoothPath(path);
      }

      closedSet.add(`${current.x},${current.y}`);

      for (const neighbor of this.getNeighbors(current, grid)) {
        if (closedSet.has(`${neighbor.x},${neighbor.y}`)) {
          continue;
        }

        const tentativeG = current.g + (neighbor.x !== current.x && neighbor.y !== current.y ? 1.414 : 1);

        if (tentativeG < neighbor.g) {
          neighbor.parent = current;
          neighbor.g = tentativeG;
          neighbor.h = this.heuristic(neighbor, endNode);
          neighbor.f = neighbor.g + neighbor.h;

          if (!openList.includes(neighbor)) {
            openList.push(neighbor);
          }
        }
      }
    }

    return [];
  }

  private smoothPath(path: Point[]): Point[] {
    if (path.length < 3) return path;

    const smoothed: Point[] = [path[0]];
    let i = 0;

    while (i < path.length - 1) {
      for (let j = path.length - 1; j > i; j--) {
        if (this.hasLineOfSight(path[i], path[j])) {
          smoothed.push(path[j]);
          i = j;
          break;
        }
      }
    }

    return smoothed;
  }

  private hasLineOfSight(start: Point, end: Point): boolean {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const steps = Math.max(Math.abs(dx), Math.abs(dy)) * 2;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = start.x + dx * t;
      const y = start.y + dy * t;
      const grid = this.worldToGrid(x, y);
      if (!this.isWalkable(grid.x, grid.y)) {
        return false;
      }
    }

    return true;
  }
}
