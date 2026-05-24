import type { Network, Node, Pipe, Valve, CustomerZone, ImpactAnalysis } from '@/types';

interface AdjacencyEntry {
  nodeId: string;
  pipeId: string;
  hasClosedValve: boolean;
}

export function buildAdjacencyList(network: Network): Map<string, AdjacencyEntry[]> {
  const adjacency = new Map<string, AdjacencyEntry[]>();

  network.nodes.forEach((node) => {
    adjacency.set(node.id, []);
  });

  const closedValvePipes = new Set(
    network.valves.filter((v) => v.status === 'closed').map((v) => v.pipeId)
  );

  network.pipes.forEach((pipe) => {
    const hasClosedValve = closedValvePipes.has(pipe.id);

    const fromEntries = adjacency.get(pipe.fromNode) || [];
    fromEntries.push({
      nodeId: pipe.toNode,
      pipeId: pipe.id,
      hasClosedValve,
    });
    adjacency.set(pipe.fromNode, fromEntries);

    const toEntries = adjacency.get(pipe.toNode) || [];
    toEntries.push({
      nodeId: pipe.fromNode,
      pipeId: pipe.id,
      hasClosedValve,
    });
    adjacency.set(pipe.toNode, toEntries);
  });

  return adjacency;
}

export function findReachableNodes(
  startNodeIds: string[],
  adjacency: Map<string, AdjacencyEntry[]>,
  respectValves: boolean = true
): { nodes: Set<string>; pipes: Set<string> } {
  const visitedNodes = new Set<string>();
  const visitedPipes = new Set<string>();
  const queue: string[] = [...startNodeIds];

  startNodeIds.forEach((id) => visitedNodes.add(id));

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = adjacency.get(current) || [];

    for (const neighbor of neighbors) {
      if (respectValves && neighbor.hasClosedValve) {
        continue;
      }

      if (!visitedNodes.has(neighbor.nodeId)) {
        visitedNodes.add(neighbor.nodeId);
        visitedPipes.add(neighbor.pipeId);
        queue.push(neighbor.nodeId);
      } else if (!visitedPipes.has(neighbor.pipeId)) {
        visitedPipes.add(neighbor.pipeId);
      }
    }
  }

  return { nodes: visitedNodes, pipes: visitedPipes };
}

export function findSourceNodes(network: Network): string[] {
  return network.nodes.filter((n) => n.type === 'source' || n.type === 'reservoir').map((n) => n.id);
}

export function findRepairPointNodes(network: Network): string[] {
  const repairNodes = new Set<string>();
  network.repairPoints.forEach((rp) => {
    const pipe = network.pipes.find((p) => p.id === rp.pipeId);
    if (pipe) {
      repairNodes.add(pipe.fromNode);
      repairNodes.add(pipe.toNode);
    }
  });
  return Array.from(repairNodes);
}

export function calculateIsolatedRegion(
  network: Network
): { isolatedNodes: Set<string>; isolatedPipes: Set<string> } {
  const adjacency = buildAdjacencyList(network);
  const sourceNodes = findSourceNodes(network);
  const { nodes: reachableFromSources } = findReachableNodes(sourceNodes, adjacency, true);

  const allNodes = new Set(network.nodes.map((n) => n.id));
  const isolatedNodes = new Set<string>();
  allNodes.forEach((nodeId) => {
    if (!reachableFromSources.has(nodeId)) {
      isolatedNodes.add(nodeId);
    }
  });

  const isolatedPipes = new Set<string>();
  network.pipes.forEach((pipe) => {
    if (isolatedNodes.has(pipe.fromNode) && isolatedNodes.has(pipe.toNode)) {
      isolatedPipes.add(pipe.id);
    }
  });

  return { isolatedNodes, isolatedPipes };
}

export function detectConflicts(
  network: Network,
  isolatedNodes: Set<string>
): string[] {
  const conflicts: string[] = [];

  const failedValves = network.valves.filter((v) => v.status === 'failed');
  if (failedValves.length > 0) {
    conflicts.push(`存在 ${failedValves.length} 个失效阀门: ${failedValves.map((v) => v.id).join(', ')}`);
  }

  network.repairPoints.forEach((rp) => {
    const pipe = network.pipes.find((p) => p.id === rp.pipeId);
    if (pipe) {
      const fromIsolated = isolatedNodes.has(pipe.fromNode);
      const toIsolated = isolatedNodes.has(pipe.toNode);
      if (!fromIsolated || !toIsolated) {
        conflicts.push(`抢修点 ${rp.id} (${rp.description}) 未完全隔离，仍与水源连通`);
      }
    }
  });

  return conflicts;
}

export function calculateAffectedZones(
  network: Network,
  isolatedNodes: Set<string>
): { zones: CustomerZone[]; totalCustomers: number } {
  const affectedZones: CustomerZone[] = [];
  let totalCustomers = 0;

  network.customerZones.forEach((zone) => {
    const hasIsolatedNode = zone.nodeIds.some((nodeId) => isolatedNodes.has(nodeId));
    if (hasIsolatedNode) {
      affectedZones.push(zone);
      totalCustomers += zone.customerCount;
    }
  });

  return { zones: affectedZones, totalCustomers };
}

export function performImpactAnalysis(network: Network): ImpactAnalysis {
  const { isolatedNodes, isolatedPipes } = calculateIsolatedRegion(network);
  const { zones: affectedZones, totalCustomers } = calculateAffectedZones(network, isolatedNodes);
  const conflicts = detectConflicts(network, isolatedNodes);

  return {
    affectedZoneIds: affectedZones.map((z) => z.id),
    affectedCustomerCount: totalCustomers,
    isolatedPipes: Array.from(isolatedPipes),
    isolatedNodes: Array.from(isolatedNodes),
    hasConflict: conflicts.length > 0,
    conflictDetails: conflicts,
  };
}

export function getValvePosition(
  valve: Valve,
  pipe: Pipe,
  nodes: Map<string, Node>
): { x: number; y: number; z: number } {
  const fromNode = nodes.get(pipe.fromNode);
  const toNode = nodes.get(pipe.toNode);

  if (!fromNode || !toNode) {
    return { x: 0, y: 0, z: 0 };
  }

  return {
    x: fromNode.x + (toNode.x - fromNode.x) * valve.position,
    y: fromNode.y + (toNode.y - fromNode.y) * valve.position,
    z: fromNode.z + (toNode.z - fromNode.z) * valve.position,
  };
}

export function getRepairPointPosition(
  network: Network,
  repairPointId: string
): { x: number; y: number; z: number } | null {
  const repairPoint = network.repairPoints.find((r) => r.id === repairPointId);
  if (!repairPoint) return null;

  const pipe = network.pipes.find((p) => p.id === repairPoint.pipeId);
  if (!pipe) return null;

  const nodes = new Map(network.nodes.map((n) => [n.id, n]));
  const fromNode = nodes.get(pipe.fromNode);
  const toNode = nodes.get(pipe.toNode);

  if (!fromNode || !toNode) return null;

  return {
    x: fromNode.x + (toNode.x - fromNode.x) * repairPoint.position,
    y: fromNode.y + (toNode.y - fromNode.y) * repairPoint.position,
    z: fromNode.z + (toNode.z - fromNode.z) * repairPoint.position,
  };
}

export function hasLoop(network: Network): boolean {
  const adjacency = buildAdjacencyList(network);
  const visited = new Set<string>();
  const parent = new Map<string, string | null>();

  for (const node of network.nodes) {
    if (visited.has(node.id)) continue;

    const queue: string[] = [node.id];
    visited.add(node.id);
    parent.set(node.id, null);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const neighbors = adjacency.get(current) || [];

      for (const neighbor of neighbors) {
        if (!visited.has(neighbor.nodeId)) {
          visited.add(neighbor.nodeId);
          parent.set(neighbor.nodeId, current);
          queue.push(neighbor.nodeId);
        } else if (parent.get(current) !== neighbor.nodeId) {
          return true;
        }
      }
    }
  }

  return false;
}
