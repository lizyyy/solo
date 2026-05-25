import type { Node, Pipe, Valve, Leak, UserArea, GameState } from './types';
import { bfsDistance, getReachableNodes } from './solver';

const SOURCE_PRESSURE = 100;
const PRESSURE_DROP_PER_UNIT = 2;
const DIAMETER_FACTOR = 0.5;

export function calculatePressure(
  nodes: Node[],
  pipes: Pipe[],
  valves: Valve[]
): Node[] {
  const sourceNodes = nodes.filter((n) => n.type === 'source').map((n) => n.id);
  const reachable = getReachableNodes(sourceNodes, nodes, pipes, valves);

  const distanceMap = new Map<string, number>();

  sourceNodes.forEach((sourceId) => {
    const distances = bfsDistance(sourceId, nodes, pipes, valves);
    distances.forEach((dist, nodeId) => {
      if (dist !== Infinity) {
        const existing = distanceMap.get(nodeId);
        if (existing === undefined || dist < existing) {
          distanceMap.set(nodeId, dist);
        }
      }
    });
  });

  return nodes.map((node) => {
    if (node.type === 'source') {
      return { ...node, pressure: SOURCE_PRESSURE };
    }

    if (!reachable.has(node.id)) {
      return { ...node, pressure: 0 };
    }

    const distance = distanceMap.get(node.id) || 0;
    const connectedPipes = pipes.filter(
      (p) => p.fromNode === node.id || p.toNode === node.id
    );
    const avgDiameter =
      connectedPipes.reduce((sum, p) => sum + p.diameter, 0) /
      Math.max(connectedPipes.length, 1);
    const diameterBonus = (avgDiameter - 1) * DIAMETER_FACTOR;

    const pressure = Math.max(
      0,
      SOURCE_PRESSURE - distance * PRESSURE_DROP_PER_UNIT + diameterBonus
    );

    return { ...node, pressure: Math.round(pressure * 10) / 10 };
  });
}

export function calculateAffectedAreas(
  nodes: Node[],
  pipes: Pipe[],
  valves: Valve[],
  userAreas: UserArea[]
): { userAreas: UserArea[]; affectedCount: number } {
  const sourceNodes = nodes.filter((n) => n.type === 'source').map((n) => n.id);
  const reachable = getReachableNodes(sourceNodes, nodes, pipes, valves);

  let affectedCount = 0;
  const updatedUserAreas = userAreas.map((area) => {
    const isAffected = !reachable.has(area.nodeId);
    if (isAffected) {
      affectedCount += area.userCount;
    }
    return { ...area, isAffected };
  });

  return { userAreas: updatedUserAreas, affectedCount };
}

export function calculateIsolatedLeaks(
  nodes: Node[],
  pipes: Pipe[],
  valves: Valve[],
  leaks: Leak[]
): { leaks: Leak[]; isolatedCount: number } {
  const sourceNodes = nodes.filter((n) => n.type === 'source').map((n) => n.id);
  const reachable = getReachableNodes(sourceNodes, nodes, pipes, valves);

  let isolatedCount = 0;
  const updatedLeaks = leaks.map((leak) => {
    const isIsolated = !reachable.has(leak.nodeId);
    if (isIsolated) {
      isolatedCount++;
    }
    return { ...leak, isIsolated };
  });

  return { leaks: updatedLeaks, isolatedCount };
}

export function updateGameState(
  nodes: Node[],
  pipes: Pipe[],
  valves: Valve[],
  leaks: Leak[],
  userAreas: UserArea[],
  stepCount: number,
  elapsedTime: number
): GameState {
  const updatedNodes = calculatePressure(nodes, pipes, valves);
  const { userAreas: updatedUserAreas, affectedCount } = calculateAffectedAreas(
    updatedNodes,
    pipes,
    valves,
    userAreas
  );
  const { leaks: updatedLeaks, isolatedCount } = calculateIsolatedLeaks(
    updatedNodes,
    pipes,
    valves,
    leaks
  );

  const pressures = updatedNodes
    .filter((n) => n.pressure > 0)
    .map((n) => n.pressure);
  const averagePressure =
    pressures.length > 0
      ? Math.round(
          (pressures.reduce((a, b) => a + b, 0) / pressures.length) * 10
        ) / 10
      : 0;

  const minPressure =
    pressures.length > 0 ? Math.round(Math.min(...pressures) * 10) / 10 : 0;

  return {
    nodes: updatedNodes,
    pipes,
    valves,
    leaks: updatedLeaks,
    userAreas: updatedUserAreas,
    affectedUsers: affectedCount,
    isolatedLeaks: isolatedCount,
    averagePressure,
    minPressure,
    stepCount,
    elapsedTime,
  };
}

export function cloneGameState(state: GameState): GameState {
  return {
    ...state,
    nodes: state.nodes.map((n) => ({ ...n })),
    pipes: state.pipes.map((p) => ({ ...p })),
    valves: state.valves.map((v) => ({ ...v, position: { ...v.position } })),
    leaks: state.leaks.map((l) => ({ ...l })),
    userAreas: state.userAreas.map((u) => ({ ...u })),
  };
}
