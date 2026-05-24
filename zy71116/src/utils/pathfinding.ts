import {
  Vector3,
  Waypoint,
  Route,
  RouteValidation,
  CampusData,
  Facility,
  FilterState,
} from '../types';
import { distance, calculateSlope, lineIntersectsBox, generateId } from './geometry';

interface PathNode {
  id: string;
  position: Vector3;
  type: 'normal' | 'ramp' | 'elevator' | 'entrance';
  facilityId?: string;
  slope: number;
  neighbors: string[];
  g: number;
  h: number;
  f: number;
  parent: string | null;
}

const heuristic = (a: Vector3, b: Vector3): number => {
  return distance(a, b);
};

const createNodesFromCampus = (
  campus: CampusData,
  filters: FilterState
): Map<string, PathNode> => {
  const nodes = new Map<string, PathNode>();

  campus.startPoints.forEach((point) => {
    nodes.set(point.id, {
      id: point.id,
      position: point.position,
      type: 'entrance',
      slope: 0,
      neighbors: [],
      g: 0,
      h: 0,
      f: 0,
      parent: null,
    });
  });

  campus.endPoints.forEach((point) => {
    nodes.set(point.id, {
      id: point.id,
      position: point.position,
      type: 'entrance',
      slope: 0,
      neighbors: [],
      g: 0,
      h: 0,
      f: 0,
      parent: null,
    });
  });

  campus.facilities.forEach((facility) => {
    if (facility.type === 'ramp' && !filters.showRamps) return;
    if (facility.type === 'elevator' && !filters.showElevators) return;
    if (facility.status === 'disabled') return;

    const nodeId = `facility-${facility.id}`;
    nodes.set(nodeId, {
      id: nodeId,
      position: facility.position,
      type: facility.type === 'ramp' ? 'ramp' : facility.type === 'elevator' ? 'elevator' : 'normal',
      facilityId: facility.id,
      slope: facility.slope,
      neighbors: [],
      g: 0,
      h: 0,
      f: 0,
      parent: null,
    });
  });

  const nodeArray = Array.from(nodes.values());
  nodeArray.forEach((node) => {
    nodeArray.forEach((other) => {
      if (node.id !== other.id) {
        const dist = distance(node.position, other.position);
        if (dist < 50) {
          node.neighbors.push(other.id);
        }
      }
    });
  });

  return nodes;
};

export const findRoute = (
  campus: CampusData,
  startPointId: string,
  endPointId: string,
  filters: FilterState
): Route | null => {
  const nodes = createNodesFromCampus(campus, filters);
  const startNode = nodes.get(startPointId);
  const endNode = nodes.get(endPointId);

  if (!startNode || !endNode) {
    return null;
  }

  const openSet: string[] = [startPointId];
  const closedSet: Set<string> = new Set();
  const cameFrom: Map<string, string> = new Map();

  const gScore: Map<string, number> = new Map();
  const fScore: Map<string, number> = new Map();

  nodes.forEach((_, id) => {
    gScore.set(id, Infinity);
    fScore.set(id, Infinity);
  });

  gScore.set(startPointId, 0);
  fScore.set(startPointId, heuristic(startNode.position, endNode.position));

  while (openSet.length > 0) {
    openSet.sort((a, b) => (fScore.get(a) || Infinity) - (fScore.get(b) || Infinity));
    const currentId = openSet[0];
    const current = nodes.get(currentId);

    if (!current) break;

    if (currentId === endPointId) {
      const path: string[] = [currentId];
      let curr = currentId;
      while (cameFrom.has(curr)) {
        curr = cameFrom.get(curr)!;
        path.unshift(curr);
      }

      const waypoints: Waypoint[] = path.map((nodeId) => {
        const node = nodes.get(nodeId)!;
        return {
          id: generateId(),
          position: node.position,
          type: node.type,
          facilityId: node.facilityId,
          slope: node.slope,
        };
      });

      const totalDistance = waypoints.reduce((sum, wp, i) => {
        if (i === 0) return 0;
        return sum + distance(waypoints[i - 1].position, wp.position);
      }, 0);

      const validation = validateRoute(waypoints, campus, filters);

      return {
        id: generateId(),
        startPoint: startPointId,
        endPoint: endPointId,
        waypoints,
        totalDistance,
        estimatedTime: Math.ceil(totalDistance / 1.2 / 60),
        validation,
      };
    }

    openSet.shift();
    closedSet.add(currentId);

    for (const neighborId of current.neighbors) {
      if (closedSet.has(neighborId)) continue;

      const neighbor = nodes.get(neighborId);
      if (!neighbor) continue;

      let costMultiplier = 1;

      if (neighbor.slope > filters.maxSlope) {
        costMultiplier += 10;
      } else if (neighbor.slope > 0) {
        costMultiplier += neighbor.slope * 0.1;
      }

      if (filters.preferElevator && neighbor.type === 'elevator') {
        costMultiplier *= 0.5;
      }

      if (neighbor.type === 'elevator') {
        const facility = campus.facilities.find((f) => f.id === neighbor.facilityId);
        if (facility && facility.status !== 'active') {
          costMultiplier += 100;
        }
      }

      if (filters.avoidConstruction) {
        for (const construction of campus.constructions) {
          if (!construction.isActive) continue;
          if (
            lineIntersectsBox(
              current.position,
              neighbor.position,
              construction.position,
              construction.size
            )
          ) {
            costMultiplier += 50;
            break;
          }
        }
      }

      const tentativeG = (gScore.get(currentId) || 0) + distance(current.position, neighbor.position) * costMultiplier;

      if (tentativeG < (gScore.get(neighborId) || Infinity)) {
        cameFrom.set(neighborId, currentId);
        gScore.set(neighborId, tentativeG);
        fScore.set(neighborId, tentativeG + heuristic(neighbor.position, endNode.position));

        if (!openSet.includes(neighborId)) {
          openSet.push(neighborId);
        }
      }
    }
  }

  return null;
};

export const validateRoute = (
  waypoints: Waypoint[],
  campus: CampusData,
  filters: FilterState
): RouteValidation => {
  const warnings: string[] = [];
  const errors: string[] = [];
  let maxSlope = 0;
  let elevatorCount = 0;
  const constructionBlocks: string[] = [];

  for (let i = 1; i < waypoints.length; i++) {
    const prev = waypoints[i - 1];
    const curr = waypoints[i];
    const slope = calculateSlope(prev.position, curr.position);
    maxSlope = Math.max(maxSlope, slope);

    if (slope > filters.maxSlope) {
      errors.push(`路段 ${i} 坡度 ${slope.toFixed(1)}% 超过限制 ${filters.maxSlope}%`);
    } else if (slope > filters.maxSlope * 0.8) {
      warnings.push(`路段 ${i} 坡度 ${slope.toFixed(1)}% 接近限制`);
    }
  }

  waypoints.forEach((wp) => {
    if (wp.type === 'elevator') {
      elevatorCount++;
      const facility = campus.facilities.find((f) => f.id === wp.facilityId);
      if (facility && facility.status === 'maintenance') {
        warnings.push(`电梯 ${facility.name} 正在维护中`);
      } else if (facility && facility.status === 'disabled') {
        errors.push(`电梯 ${facility.name} 已停用`);
      }
    }
  });

  campus.constructions.forEach((construction) => {
    if (!construction.isActive) return;

    for (let i = 1; i < waypoints.length; i++) {
      if (
        lineIntersectsBox(
          waypoints[i - 1].position,
          waypoints[i].position,
          construction.position,
          construction.size
        )
      ) {
        if (filters.avoidConstruction) {
          errors.push(`路线经过施工区域: ${construction.name}`);
        } else {
          warnings.push(`路线经过施工区域: ${construction.name}`);
        }
        constructionBlocks.push(construction.id);
        break;
      }
    }
  });

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
    maxSlope,
    elevatorCount,
    constructionBlocks,
  };
};

export const getFacilityInstructions = (facility: Facility): string => {
  switch (facility.type) {
    case 'ramp':
      return `通过坡道 ${facility.name}，坡度 ${facility.slope.toFixed(1)}%`;
    case 'elevator':
      return `乘坐电梯 ${facility.name}${facility.floor ? `，到达 ${facility.floor} 层` : ''}`;
    case 'doorway':
      return `通过出入口 ${facility.name}`;
    default:
      return `经过 ${facility.name}`;
  }
};
