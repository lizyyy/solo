import { ExhibitionConfig, ExhibitionElement, Position } from '../types';

interface GridNode {
  x: number;
  z: number;
  walkable: boolean;
  g: number;
  h: number;
  f: number;
  parent: GridNode | null;
}

export class PathFinder {
  private config: ExhibitionConfig;
  private gridSize: number;
  private grid: Map<string, GridNode> = new Map();
  private gridWidth: number;
  private gridDepth: number;
  private minX: number;
  private minZ: number;

  constructor(config: ExhibitionConfig, gridSize: number = 1) {
    this.config = config;
    this.gridSize = gridSize;
    this.minX = -config.floor.width / 2;
    this.minZ = -config.floor.depth / 2;
    this.gridWidth = Math.ceil(config.floor.width / gridSize);
    this.gridDepth = Math.ceil(config.floor.depth / gridSize);
    this.initializeGrid();
  }

  private initializeGrid(): void {
    this.grid.clear();

    for (let gx = 0; gx < this.gridWidth; gx++) {
      for (let gz = 0; gz < this.gridDepth; gz++) {
        const x = this.minX + gx * this.gridSize + this.gridSize / 2;
        const z = this.minZ + gz * this.gridSize + this.gridSize / 2;

        const walkable = this.isPositionWalkable(x, z);

        const key = this.getGridKey(gx, gz);
        this.grid.set(key, {
          x,
          z,
          walkable,
          g: Infinity,
          h: 0,
          f: Infinity,
          parent: null,
        });
      }
    }
  }

  private isPositionWalkable(x: number, z: number): boolean {
    for (const element of this.config.elements) {
      if (element.type === 'exhibit' || element.type === 'obstacle') {
        if (this.isPointInElement(x, z, element)) {
          return false;
        }
      }
      if (element.type === 'restricted') {
        if (this.isPointInElement(x, z, element)) {
          return false;
        }
      }
    }

    if (x < -this.config.floor.width / 2 || x > this.config.floor.width / 2 ||
        z < -this.config.floor.depth / 2 || z > this.config.floor.depth / 2) {
      return false;
    }

    return true;
  }

  private isPointInElement(x: number, z: number, element: ExhibitionElement): boolean {
    const halfWidth = element.dimensions.width / 2;
    const halfDepth = element.dimensions.depth / 2;

    const elementMinX = element.position.x - halfWidth;
    const elementMaxX = element.position.x + halfWidth;
    const elementMinZ = element.position.z - halfDepth;
    const elementMaxZ = element.position.z + halfDepth;

    return x >= elementMinX && x <= elementMaxX &&
           z >= elementMinZ && z <= elementMaxZ;
  }

  private getGridKey(gx: number, gz: number): string {
    return `${gx},${gz}`;
  }

  private worldToGrid(x: number, z: number): { gx: number; gz: number } {
    const gx = Math.floor((x - this.minX) / this.gridSize);
    const gz = Math.floor((z - this.minZ) / this.gridSize);
    return { 
      gx: Math.max(0, Math.min(gx, this.gridWidth - 1)),
      gz: Math.max(0, Math.min(gz, this.gridDepth - 1))
    };
  }

  private getNeighbors(node: GridNode): GridNode[] {
    const { gx, gz } = this.worldToGrid(node.x, node.z);
    const neighbors: GridNode[] = [];

    const directions = [
      { dx: 0, dz: -1 },
      { dx: 1, dz: 0 },
      { dx: 0, dz: 1 },
      { dx: -1, dz: 0 },
      { dx: 1, dz: -1 },
      { dx: 1, dz: 1 },
      { dx: -1, dz: 1 },
      { dx: -1, dz: -1 },
    ];

    for (const dir of directions) {
      const neighborGx = gx + dir.dx;
      const neighborGz = gz + dir.dz;

      if (neighborGx >= 0 && neighborGx < this.gridWidth &&
          neighborGz >= 0 && neighborGz < this.gridDepth) {
        const key = this.getGridKey(neighborGx, neighborGz);
        const neighbor = this.grid.get(key);
        
        if (neighbor && neighbor.walkable) {
          if (Math.abs(dir.dx) + Math.abs(dir.dz) === 2) {
            const adj1Key = this.getGridKey(gx + dir.dx, gz);
            const adj2Key = this.getGridKey(gx, gz + dir.dz);
            const adj1 = this.grid.get(adj1Key);
            const adj2 = this.grid.get(adj2Key);
            
            if (!adj1?.walkable || !adj2?.walkable) {
              continue;
            }
          }
          
          neighbors.push(neighbor);
        }
      }
    }

    return neighbors;
  }

  private heuristic(a: GridNode, b: GridNode): number {
    const dx = Math.abs(a.x - b.x);
    const dz = Math.abs(a.z - b.z);
    return Math.max(dx, dz) + Math.min(dx, dz) * 0.001;
  }

  findPath(startPos: Position, endPos: Position): Position[] | null {
    const { gx: startGx, gz: startGz } = this.worldToGrid(startPos.x, startPos.z);
    const { gx: endGx, gz: endGz } = this.worldToGrid(endPos.x, endPos.z);

    const startKey = this.getGridKey(startGx, startGz);
    const endKey = this.getGridKey(endGx, endGz);

    const startNode = this.grid.get(startKey);
    const endNode = this.grid.get(endKey);

    if (!startNode || !endNode) {
      return null;
    }

    if (!startNode.walkable) {
      const nearWalkable = this.findNearbyWalkable(startPos);
      if (!nearWalkable) return null;
      return this.findPath(nearWalkable, endPos);
    }

    if (!endNode.walkable) {
      const nearWalkable = this.findNearbyWalkable(endPos);
      if (!nearWalkable) return null;
      return this.findPath(startPos, nearWalkable);
    }

    for (const node of this.grid.values()) {
      node.g = Infinity;
      node.h = 0;
      node.f = Infinity;
      node.parent = null;
    }

    startNode.g = 0;
    startNode.h = this.heuristic(startNode, endNode);
    startNode.f = startNode.h;

    const openSet: Set<GridNode> = new Set([startNode]);
    const closedSet: Set<GridNode> = new Set();

    while (openSet.size > 0) {
      let current: GridNode | null = null;
      let lowestF = Infinity;

      for (const node of openSet) {
        if (node.f < lowestF) {
          lowestF = node.f;
          current = node;
        }
      }

      if (!current) break;

      if (current === endNode) {
        const path: Position[] = [];
        let node: GridNode | null = current;
        while (node) {
          path.unshift({ x: node.x, z: node.z });
          node = node.parent;
        }
        return path;
      }

      openSet.delete(current);
      closedSet.add(current);

      for (const neighbor of this.getNeighbors(current)) {
        if (closedSet.has(neighbor)) continue;

        const dx = Math.abs(neighbor.x - current.x);
        const dz = Math.abs(neighbor.z - current.z);
        const moveCost = Math.abs(dx - dz) < 0.001 ? 1.414 : 1;

        const tentativeG = current.g + moveCost;

        if (tentativeG < neighbor.g) {
          neighbor.parent = current;
          neighbor.g = tentativeG;
          neighbor.h = this.heuristic(neighbor, endNode);
          neighbor.f = neighbor.g + neighbor.h;

          if (!openSet.has(neighbor)) {
            openSet.add(neighbor);
          }
        }
      }
    }

    return null;
  }

  private findNearbyWalkable(pos: Position, radius: number = 3): Position | null {
    for (let r = 1; r <= radius; r++) {
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
        const x = pos.x + Math.cos(angle) * r * this.gridSize;
        const z = pos.z + Math.sin(angle) * r * this.gridSize;
        const { gx, gz } = this.worldToGrid(x, z);
        const key = this.getGridKey(gx, gz);
        const node = this.grid.get(key);
        if (node?.walkable) {
          return { x: node.x, z: node.z };
        }
      }
    }
    return null;
  }

  isWalkable(x: number, z: number): boolean {
    const { gx, gz } = this.worldToGrid(x, z);
    const key = this.getGridKey(gx, gz);
    const node = this.grid.get(key);
    return node?.walkable ?? false;
  }

  getRandomWalkablePosition(): Position {
    const walkableNodes = Array.from(this.grid.values()).filter(n => n.walkable);
    if (walkableNodes.length === 0) {
      return { x: 0, z: 0 };
    }
    const randomNode = walkableNodes[Math.floor(Math.random() * walkableNodes.length)];
    return { x: randomNode.x, z: randomNode.z };
  }

  updateGrid(config: ExhibitionConfig): void {
    this.config = config;
    this.minX = -config.floor.width / 2;
    this.minZ = -config.floor.depth / 2;
    this.gridWidth = Math.ceil(config.floor.width / this.gridSize);
    this.gridDepth = Math.ceil(config.floor.depth / this.gridSize);
    this.initializeGrid();
  }
}
