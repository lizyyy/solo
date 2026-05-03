import { Position, CellType, MapConfig } from '../types';

export class MapSystem {
  private width: number;
  private height: number;
  private grid: CellType[][];
  private exitPositions: Position[];

  constructor(config: MapConfig) {
    this.width = config.width;
    this.height = config.height;
    this.grid = this.cloneGrid(config.grid);
    this.exitPositions = [...config.exitPositions];
  }

  private cloneGrid(grid: CellType[][]): CellType[][] {
    return grid.map(row => [...row]);
  }

  getWidth(): number {
    return this.width;
  }

  getHeight(): number {
    return this.height;
  }

  getGrid(): CellType[][] {
    return this.cloneGrid(this.grid);
  }

  getCellType(pos: Position): CellType | null {
    if (!this.isValidPosition(pos)) {
      return null;
    }
    return this.grid[pos.y][pos.x];
  }

  setCellType(pos: Position, cellType: CellType): boolean {
    if (!this.isValidPosition(pos)) {
      return false;
    }
    this.grid[pos.y][pos.x] = cellType;
    return true;
  }

  isValidPosition(pos: Position): boolean {
    return (
      pos.x >= 0 &&
      pos.x < this.width &&
      pos.y >= 0 &&
      pos.y < this.height
    );
  }

  isWalkable(pos: Position, _powerOutage: boolean = false): boolean {
    const cellType = this.getCellType(pos);
    if (cellType === null || cellType === 'wall') {
      return false;
    }
    return true;
  }

  isExit(pos: Position): boolean {
    return this.exitPositions.some(
      exit => exit.x === pos.x && exit.y === pos.y
    );
  }

  isCase(pos: Position): boolean {
    const cellType = this.getCellType(pos);
    return cellType === 'case';
  }

  getExitPositions(): Position[] {
    return [...this.exitPositions];
  }

  getAdjacentPositions(pos: Position): Position[] {
    const directions = [
      { x: 0, y: -1 }, // up
      { x: 0, y: 1 },  // down
      { x: -1, y: 0 }, // left
      { x: 1, y: 0 }   // right
    ];

    return directions
      .map(dir => ({ x: pos.x + dir.x, y: pos.y + dir.y }))
      .filter(adjPos => this.isValidPosition(adjPos));
  }

  getReachableAdjacentPositions(pos: Position, powerOutage: boolean = false): Position[] {
    return this.getAdjacentPositions(pos).filter(adjPos =>
      this.isWalkable(adjPos, powerOutage)
    );
  }

  getDistance(pos1: Position, pos2: Position): number {
    return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
  }

  findPath(
    start: Position,
    end: Position,
    powerOutage: boolean = false,
    blockedPositions: Position[] = []
  ): Position[] | null {
    if (!this.isValidPosition(start) || !this.isValidPosition(end)) {
      return null;
    }

    if (!this.isWalkable(end, powerOutage)) {
      return null;
    }

    const isBlocked = (pos: Position): boolean => {
      return blockedPositions.some(
        blocked => blocked.x === pos.x && blocked.y === pos.y
      );
    };

    interface Node {
      pos: Position;
      g: number;
      h: number;
      f: number;
      parent: Node | null;
    }

    const createNode = (pos: Position, g: number, parent: Node | null): Node => {
      const h = this.getDistance(pos, end);
      return {
        pos,
        g,
        h,
        f: g + h,
        parent
      };
    };

    const openList: Node[] = [createNode(start, 0, null)];
    const closedSet = new Set<string>();

    const posKey = (pos: Position): string => `${pos.x},${pos.y}`;

    while (openList.length > 0) {
      openList.sort((a, b) => a.f - b.f);
      const current = openList.shift()!;

      if (current.pos.x === end.x && current.pos.y === end.y) {
        const path: Position[] = [];
        let node: Node | null = current;
        while (node) {
          path.unshift(node.pos);
          node = node.parent;
        }
        return path;
      }

      closedSet.add(posKey(current.pos));

      const adjacent = this.getReachableAdjacentPositions(current.pos, powerOutage);

      for (const adjPos of adjacent) {
        if (closedSet.has(posKey(adjPos))) continue;
        if (isBlocked(adjPos)) continue;

        const g = current.g + 1;
        const existingNode = openList.find(
          n => n.pos.x === adjPos.x && n.pos.y === adjPos.y
        );

        if (!existingNode) {
          openList.push(createNode(adjPos, g, current));
        } else if (g < existingNode.g) {
          existingNode.g = g;
          existingNode.f = g + existingNode.h;
          existingNode.parent = current;
        }
      }
    }

    return null;
  }

  getLineOfSight(
    start: Position,
    direction: 'up' | 'down' | 'left' | 'right',
    range: number
  ): Position[] {
    const sight: Position[] = [];
    let currentPos = { ...start };

    const dx = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
    const dy = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;

    for (let i = 1; i <= range; i++) {
      const nextPos = {
        x: currentPos.x + dx,
        y: currentPos.y + dy
      };

      if (!this.isValidPosition(nextPos)) {
        break;
      }

      const cellType = this.getCellType(nextPos);
      if (cellType === 'wall') {
        break;
      }

      sight.push(nextPos);
      currentPos = nextPos;
    }

    return sight;
  }

  getGuardVisionCells(
    guardPos: Position,
    direction: 'up' | 'down' | 'left' | 'right',
    viewRange: number
  ): Position[] {
    const visionCells: Position[] = [guardPos];

    const mainSight = this.getLineOfSight(guardPos, direction, viewRange);
    visionCells.push(...mainSight);

    type Direction = 'up' | 'down' | 'left' | 'right';
    const sideDirections: { [key in Direction]: Direction[] } = {
      'up': ['left', 'right'],
      'down': ['left', 'right'],
      'left': ['up', 'down'],
      'right': ['up', 'down']
    };

    for (let i = 0; i < Math.min(mainSight.length, 2); i++) {
      const pos = mainSight[i];
      const sideRange = Math.max(1, viewRange - i - 1);

      for (const sideDir of sideDirections[direction]) {
        const sideSight = this.getLineOfSight(pos, sideDir, sideRange);
        visionCells.push(...sideSight);
      }
    }

    const uniquePositions = new Set<string>();
    return visionCells.filter(pos => {
      const key = `${pos.x},${pos.y}`;
      if (uniquePositions.has(key)) return false;
      uniquePositions.add(key);
      return true;
    });
  }

  positionsEqual(pos1: Position, pos2: Position): boolean {
    return pos1.x === pos2.x && pos1.y === pos2.y;
  }

  positionInArray(pos: Position, arr: Position[]): boolean {
    return arr.some(p => this.positionsEqual(pos, p));
  }
}
