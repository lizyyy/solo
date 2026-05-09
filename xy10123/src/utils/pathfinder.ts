import type { Position, Booth, Exit, Zone, EvacuationPath } from '../types';

export function calculateDistance(p1: Position, p2: Position): number {
  const dx = p2.x - p1.x;
  const dz = p2.z - p1.z;
  return Math.sqrt(dx * dx + dz * dz);
}

export function getCenterOfZone(zone: Zone): Position {
  return {
    x: zone.position.x + zone.dimension.width / 2,
    z: zone.position.z + zone.dimension.depth / 2
  };
}

export function getCenterOfBooth(booth: Booth): Position {
  return {
    x: booth.position.x + booth.dimension.width / 2,
    z: booth.position.z + booth.dimension.depth / 2
  };
}

export function doRectanglesOverlap(
  pos1: Position,
  dim1: { width: number; depth: number },
  pos2: Position,
  dim2: { width: number; depth: number }
): boolean {
  return !(
    pos1.x + dim1.width <= pos2.x ||
    pos2.x + dim2.width <= pos1.x ||
    pos1.z + dim1.depth <= pos2.z ||
    pos2.z + dim2.depth <= pos1.z
  );
}

export function checkBoothOverlap(booths: Booth[]): Array<{ booth1: string; booth2: string }> {
  const overlaps: Array<{ booth1: string; booth2: string }> = [];
  
  for (let i = 0; i < booths.length; i++) {
    for (let j = i + 1; j < booths.length; j++) {
      if (doRectanglesOverlap(
        booths[i].position,
        booths[i].dimension,
        booths[j].position,
        booths[j].dimension
      )) {
        overlaps.push({ booth1: booths[i].id, booth2: booths[j].id });
      }
    }
  }
  
  return overlaps;
}

function lineIntersectsRectangle(
  p1: Position,
  p2: Position,
  rectPos: Position,
  rectDim: { width: number; depth: number }
): boolean {
  const edges = [
    [rectPos, { x: rectPos.x + rectDim.width, z: rectPos.z }],
    [{ x: rectPos.x + rectDim.width, z: rectPos.z }, { x: rectPos.x + rectDim.width, z: rectPos.z + rectDim.depth }],
    [{ x: rectPos.x + rectDim.width, z: rectPos.z + rectDim.depth }, { x: rectPos.x, z: rectPos.z + rectDim.depth }],
    [{ x: rectPos.x, z: rectPos.z + rectDim.depth }, rectPos]
  ];

  for (const [e1, e2] of edges) {
    if (lineSegmentsIntersect(p1, p2, e1, e2)) {
      return true;
    }
  }

  return false;
}

function lineSegmentsIntersect(
  p1: Position,
  p2: Position,
  p3: Position,
  p4: Position
): boolean {
  const d1 = direction(p3, p4, p1);
  const d2 = direction(p3, p4, p2);
  const d3 = direction(p1, p2, p3);
  const d4 = direction(p1, p2, p4);

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }

  if (d1 === 0 && onSegment(p3, p4, p1)) return true;
  if (d2 === 0 && onSegment(p3, p4, p2)) return true;
  if (d3 === 0 && onSegment(p1, p2, p3)) return true;
  if (d4 === 0 && onSegment(p1, p2, p4)) return true;

  return false;
}

function direction(pi: Position, pj: Position, pk: Position): number {
  return (pk.x - pi.x) * (pj.z - pi.z) - (pj.x - pi.x) * (pk.z - pi.z);
}

function onSegment(pi: Position, pj: Position, pk: Position): boolean {
  return Math.min(pi.x, pj.x) <= pk.x && pk.x <= Math.max(pi.x, pj.x) &&
         Math.min(pi.z, pj.z) <= pk.z && pk.z <= Math.max(pi.z, pj.z);
}

export function isPathBlocked(
  start: Position,
  end: Position,
  booths: Booth[],
  excludeBoothId?: string
): { blocked: boolean; boothId?: string } {
  for (const booth of booths) {
    if (booth.id === excludeBoothId) continue;
    
    if (lineIntersectsRectangle(start, end, booth.position, booth.dimension)) {
      return { blocked: true, boothId: booth.id };
    }
  }
  return { blocked: false };
}


export function simplifyPath(points: Position[], tolerance: number = 0.5): Position[] {
  if (points.length <= 2) return points;
  
  let maxDistance = 0;
  let maxIndex = 0;
  
  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i], points[0], points[points.length - 1]);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }
  
  if (maxDistance > tolerance) {
    const left = simplifyPath(points.slice(0, maxIndex + 1), tolerance);
    const right = simplifyPath(points.slice(maxIndex), tolerance);
    return [...left.slice(0, -1), ...right];
  }
  
  return [points[0], points[points.length - 1]];
}

function perpendicularDistance(point: Position, lineStart: Position, lineEnd: Position): number {
  const dx = lineEnd.x - lineStart.x;
  const dz = lineEnd.z - lineStart.z;
  
  if (dx === 0 && dz === 0) {
    return calculateDistance(point, lineStart);
  }
  
  const t = ((point.x - lineStart.x) * dx + (point.z - lineStart.z) * dz) / (dx * dx + dz * dz);
  const clampedT = Math.max(0, Math.min(1, t));
  
  const projection = {
    x: lineStart.x + clampedT * dx,
    z: lineStart.z + clampedT * dz
  };
  
  return calculateDistance(point, projection);
}

export function calculatePathAroundObstacles(
  start: Position,
  end: Position,
  booths: Booth[],
  hallDimensions: { width: number; depth: number }
): { waypoints: Position[]; distance: number; isBlocked: boolean; blockedBy?: string } {
  const directCheck = isPathBlocked(start, end, booths);
  
  if (!directCheck.blocked) {
    const distance = calculateDistance(start, end);
    return {
      waypoints: [start, end],
      distance,
      isBlocked: false
    };
  }
  
  const waypoints = findPathAroundObstacles(start, end, booths, hallDimensions);
  
  if (waypoints.length === 0) {
    return {
      waypoints: [start],
      distance: 0,
      isBlocked: true,
      blockedBy: directCheck.boothId
    };
  }
  
  let totalDistance = 0;
  for (let i = 1; i < waypoints.length; i++) {
    totalDistance += calculateDistance(waypoints[i - 1], waypoints[i]);
  }
  
  const simplified = simplifyPath(waypoints, 0.3);
  
  return {
    waypoints: simplified,
    distance: totalDistance,
    isBlocked: false
  };
}

function findPathAroundObstacles(
  start: Position,
  end: Position,
  booths: Booth[],
  hallDimensions: { width: number; depth: number }
): Position[] {
  const margin = 1.0;
  
  const candidatePoints: Position[] = [start];
  
  for (const booth of booths) {
    const corners = [
      { x: booth.position.x - margin, z: booth.position.z - margin },
      { x: booth.position.x + booth.dimension.width + margin, z: booth.position.z - margin },
      { x: booth.position.x - margin, z: booth.position.z + booth.dimension.depth + margin },
      { x: booth.position.x + booth.dimension.width + margin, z: booth.position.z + booth.dimension.depth + margin }
    ];
    
    for (const corner of corners) {
      if (corner.x >= 0 && corner.x <= hallDimensions.width &&
          corner.z >= 0 && corner.z <= hallDimensions.depth) {
        candidatePoints.push(corner);
      }
    }
  }
  
  candidatePoints.push(end);
  
  const graph = buildVisibilityGraph(candidatePoints, booths);
  const path = dijkstra(graph, 0, candidatePoints.length - 1);
  
  if (path.length === 0) {
    return [];
  }
  
  return path.map(index => candidatePoints[index]);
}

function buildVisibilityGraph(
  points: Position[],
  booths: Booth[]
): Array<Array<{ to: number; weight: number }>> {
  const graph: Array<Array<{ to: number; weight: number }>> = [];
  
  for (let i = 0; i < points.length; i++) {
    graph[i] = [];
    
    for (let j = 0; j < points.length; j++) {
      if (i === j) continue;
      
      const blocked = isPathBlocked(points[i], points[j], booths);
      if (!blocked.blocked) {
        graph[i].push({
          to: j,
          weight: calculateDistance(points[i], points[j])
        });
      }
    }
  }
  
  return graph;
}

function dijkstra(
  graph: Array<Array<{ to: number; weight: number }>>,
  start: number,
  end: number
): number[] {
  const distances = new Array(graph.length).fill(Infinity);
  const previous = new Array(graph.length).fill(-1);
  const visited = new Array(graph.length).fill(false);
  
  distances[start] = 0;
  
  for (let i = 0; i < graph.length; i++) {
    let minDistance = Infinity;
    let current = -1;
    
    for (let j = 0; j < graph.length; j++) {
      if (!visited[j] && distances[j] < minDistance) {
        minDistance = distances[j];
        current = j;
      }
    }
    
    if (current === -1) break;
    if (current === end) break;
    
    visited[current] = true;
    
    for (const edge of graph[current]) {
      const newDistance = distances[current] + edge.weight;
      if (newDistance < distances[edge.to]) {
        distances[edge.to] = newDistance;
        previous[edge.to] = current;
      }
    }
  }
  
  if (distances[end] === Infinity) {
    return [];
  }
  
  const path: number[] = [];
  let current = end;
  
  while (current !== -1) {
    path.unshift(current);
    current = previous[current];
  }
  
  return path;
}

export function calculateAllEvacuationPaths(
  zones: Zone[],
  exits: Exit[],
  booths: Booth[],
  hallDimensions: { width: number; depth: number }
): EvacuationPath[] {
  const paths: EvacuationPath[] = [];
  
  for (const zone of zones) {
    const zoneCenter = getCenterOfZone(zone);
    
    for (const exit of exits) {
      const exitPosition = exit.position;
      
      const result = calculatePathAroundObstacles(
        zoneCenter,
        exitPosition,
        booths,
        hallDimensions
      );
      
      paths.push({
        fromZone: zone.id,
        toExit: exit.id,
        waypoints: result.waypoints,
        distance: result.distance,
        isBlocked: result.isBlocked,
        blockedBy: result.blockedBy
      });
    }
  }
  
  return paths;
}

export function getShortestPathForZone(
  zoneId: string,
  paths: EvacuationPath[]
): EvacuationPath | null {
  const zonePaths = paths.filter(p => p.fromZone === zoneId && !p.isBlocked);
  
  if (zonePaths.length === 0) {
    const blockedPath = paths.find(p => p.fromZone === zoneId);
    return blockedPath || null;
  }
  
  return zonePaths.reduce((shortest, current) => 
    current.distance < shortest.distance ? current : shortest
  );
}
