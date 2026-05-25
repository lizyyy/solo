import type { Node, Pipe, Valve } from './types';

class UnionFind {
  private parent: Map<string, string>;
  private rank: Map<string, number>;

  constructor(nodes: string[]) {
    this.parent = new Map();
    this.rank = new Map();
    nodes.forEach((node) => {
      this.parent.set(node, node);
      this.rank.set(node, 0);
    });
  }

  find(x: string): string {
    const parentX = this.parent.get(x);
    if (parentX === undefined) return x;
    if (parentX !== x) {
      this.parent.set(x, this.find(parentX));
    }
    return this.parent.get(x) || x;
  }

  union(x: string, y: string): void {
    const rootX = this.find(x);
    const rootY = this.find(y);
    if (rootX === rootY) return;

    const rankX = this.rank.get(rootX) || 0;
    const rankY = this.rank.get(rootY) || 0;

    if (rankX < rankY) {
      this.parent.set(rootX, rootY);
    } else {
      this.parent.set(rootY, rootX);
      if (rankX === rankY) {
        this.rank.set(rootX, rankX + 1);
      }
    }
  }

  connected(x: string, y: string): boolean {
    return this.find(x) === this.find(y);
  }
}

export function buildConnectivity(
  nodes: Node[],
  pipes: Pipe[],
  valves: Valve[]
): UnionFind {
  const uf = new UnionFind(nodes.map((n) => n.id));
  const valveMap = new Map(valves.map((v) => [v.id, v]));

  pipes.forEach((pipe) => {
    if (pipe.hasValve && pipe.valveId) {
      const valve = valveMap.get(pipe.valveId);
      if (valve && valve.isOpen) {
        uf.union(pipe.fromNode, pipe.toNode);
      }
    } else {
      uf.union(pipe.fromNode, pipe.toNode);
    }
  });

  return uf;
}

export function getReachableNodes(
  startNodes: string[],
  nodes: Node[],
  pipes: Pipe[],
  valves: Valve[]
): Set<string> {
  const uf = buildConnectivity(nodes, pipes, valves);
  const reachable = new Set<string>();

  startNodes.forEach((startId) => {
    const root = uf.find(startId);
    nodes.forEach((node) => {
      if (uf.find(node.id) === root) {
        reachable.add(node.id);
      }
    });
  });

  return reachable;
}

export function bfsDistance(
  startNode: string,
  nodes: Node[],
  pipes: Pipe[],
  valves: Valve[]
): Map<string, number> {
  const distances = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  const valveMap = new Map(valves.map((v) => [v.id, v]));

  nodes.forEach((node) => {
    adjacency.set(node.id, []);
    distances.set(node.id, Infinity);
  });

  pipes.forEach((pipe) => {
    let isOpen = true;
    if (pipe.hasValve && pipe.valveId) {
      const valve = valveMap.get(pipe.valveId);
      isOpen = valve?.isOpen ?? true;
    }
    if (isOpen) {
      adjacency.get(pipe.fromNode)?.push(pipe.toNode);
      adjacency.get(pipe.toNode)?.push(pipe.fromNode);
    }
  });

  const queue: string[] = [startNode];
  distances.set(startNode, 0);
  const visited = new Set<string>([startNode]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentDist = distances.get(current) || 0;

    const neighbors = adjacency.get(current) || [];
    neighbors.forEach((neighbor) => {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        distances.set(neighbor, currentDist + 1);
        queue.push(neighbor);
      }
    });
  }

  return distances;
}

export function getNodeById(nodes: Node[], id: string): Node | undefined {
  return nodes.find((n) => n.id === id);
}

export function getAdjacentPipes(nodeId: string, pipes: Pipe[]): Pipe[] {
  return pipes.filter((p) => p.fromNode === nodeId || p.toNode === nodeId);
}
