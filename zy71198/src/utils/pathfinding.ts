import { Node, Edge } from '@/types/game';

interface PathNode {
  id: string;
  g: number;
  h: number;
  f: number;
  parent: PathNode | null;
}

export function findPath(
  nodes: Node[],
  edges: Edge[],
  startId: string,
  endId: string,
  optimizeBy: 'distance' | 'cost' = 'distance'
): { path: string[]; totalDistance: number; totalCost: number } | null {
  if (startId === endId) {
    return { path: [startId], totalDistance: 0, totalCost: 0 };
  }

  const nodeMap = new Map<string, Node>();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  const adjacency = new Map<string, { nodeId: string; distance: number; cost: number }[]>();
  nodes.forEach((n) => adjacency.set(n.id, []));

  edges.forEach((e) => {
    const fromList = adjacency.get(e.from);
    const toList = adjacency.get(e.to);
    if (fromList) fromList.push({ nodeId: e.to, distance: e.distance, cost: e.cost });
    if (toList) toList.push({ nodeId: e.from, distance: e.distance, cost: e.cost });
  });

  const heuristic = (aId: string, bId: string): number => {
    const a = nodeMap.get(aId);
    const b = nodeMap.get(bId);
    if (!a || !b) return 0;
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  };

  const openSet = new Map<string, PathNode>();
  const closedSet = new Set<string>();

  const startNode: PathNode = {
    id: startId,
    g: 0,
    h: heuristic(startId, endId),
    f: heuristic(startId, endId),
    parent: null,
  };
  openSet.set(startId, startNode);

  while (openSet.size > 0) {
    let current: PathNode | null = null;
    for (const node of openSet.values()) {
      if (!current || node.f < current.f) {
        current = node;
      }
    }

    if (!current) break;

    if (current.id === endId) {
      const path: string[] = [];
      let totalDistance = 0;
      let totalCost = 0;
      let node: PathNode | null = current;
      while (node) {
        path.unshift(node.id);
        if (node.parent) {
          const edge = edges.find(
            (e) =>
              (e.from === node.parent!.id && e.to === node.id) ||
              (e.from === node.id && e.to === node.parent!.id)
          );
          if (edge) {
            totalDistance += edge.distance;
            totalCost += edge.cost;
          }
        }
        node = node.parent;
      }
      return { path, totalDistance, totalCost };
    }

    openSet.delete(current.id);
    closedSet.add(current.id);

    const neighbors = adjacency.get(current.id) || [];
    for (const neighbor of neighbors) {
      if (closedSet.has(neighbor.nodeId)) continue;

      const weight = optimizeBy === 'distance' ? neighbor.distance : neighbor.cost;
      const g = current.g + weight;
      const existing = openSet.get(neighbor.nodeId);

      if (!existing || g < existing.g) {
        const h = heuristic(neighbor.nodeId, endId);
        openSet.set(neighbor.nodeId, {
          id: neighbor.nodeId,
          g,
          h,
          f: g + h,
          parent: current,
        });
      }
    }
  }

  return null;
}

export function findNearestLamp(
  nodes: Node[],
  edges: Edge[],
  startId: string,
  lampNodes: Node[]
): { nodeId: string; distance: number } | null {
  if (lampNodes.length === 0) return null;

  let nearest: { nodeId: string; distance: number } | null = null;

  for (const lampNode of lampNodes) {
    const result = findPath(nodes, edges, startId, lampNode.id);
    if (result) {
      if (!nearest || result.totalDistance < nearest.distance) {
        nearest = { nodeId: lampNode.id, distance: result.totalDistance };
      }
    }
  }

  return nearest;
}
