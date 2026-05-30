import { Point, PolygonBlock, PlacedPolygon } from '../types';

export const distance = (p1: Point, p2: Point): number => {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
};

export const calculateArea = (vertices: Point[]): number => {
  if (vertices.length < 3) return 0;
  let area = 0;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += vertices[i].x * vertices[j].y;
    area -= vertices[j].x * vertices[i].y;
  }
  return Math.abs(area / 2);
};

export const getCentroid = (vertices: Point[]): Point => {
  let cx = 0, cy = 0;
  const n = vertices.length;
  for (const v of vertices) {
    cx += v.x;
    cy += v.y;
  }
  return { x: cx / n, y: cy / n };
};

export const rotatePoint = (point: Point, center: Point, angle: number): Point => {
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos
  };
};

export const transformVertices = (
  vertices: Point[],
  position: Point,
  rotation: number
): Point[] => {
  const centroid = getCentroid(vertices);
  return vertices.map(v => {
    const rotated = rotatePoint(v, centroid, rotation);
    return {
      x: rotated.x - centroid.x + position.x,
      y: rotated.y - centroid.y + position.y
    };
  });
};

export const isPointInPolygon = (point: Point, vertices: Point[]): boolean => {
  let inside = false;
  const n = vertices.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = vertices[i].x, yi = vertices[i].y;
    const xj = vertices[j].x, yj = vertices[j].y;
    const intersect = ((yi > point.y) !== (yj > point.y)) &&
      (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

export const getAxes = (vertices: Point[]): Point[] => {
  const axes: Point[] = [];
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const p1 = vertices[i];
    const p2 = vertices[(i + 1) % n];
    const edge = { x: p2.x - p1.x, y: p2.y - p1.y };
    const len = Math.sqrt(edge.x * edge.x + edge.y * edge.y);
    if (len > 0) {
      axes.push({ x: -edge.y / len, y: edge.x / len });
    }
  }
  return axes;
};

export const project = (vertices: Point[], axis: Point): { min: number; max: number } => {
  let min = Infinity, max = -Infinity;
  for (const v of vertices) {
    const proj = v.x * axis.x + v.y * axis.y;
    min = Math.min(min, proj);
    max = Math.max(max, proj);
  }
  return { min, max };
};

export const overlap = (a: { min: number; max: number }, b: { min: number; max: number }): boolean => {
  return !(a.max < b.min || b.max < a.min);
};

export const checkPolygonOverlap = (poly1: Point[], poly2: Point[]): boolean => {
  const axes1 = getAxes(poly1);
  const axes2 = getAxes(poly2);
  const allAxes = [...axes1, ...axes2];
  for (const axis of allAxes) {
    const proj1 = project(poly1, axis);
    const proj2 = project(poly2, axis);
    if (!overlap(proj1, proj2)) {
      return false;
    }
  }
  return true;
};

export const getPolygonEdges = (vertices: Point[]): Array<{ start: Point; end: Point }> => {
  const edges: Array<{ start: Point; end: Point }> = [];
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    edges.push({
      start: vertices[i],
      end: vertices[(i + 1) % n]
    });
  }
  return edges;
};

export const pointToLineDistance = (point: Point, lineStart: Point, lineEnd: Point): number => {
  const A = point.x - lineStart.x;
  const B = point.y - lineStart.y;
  const C = lineEnd.x - lineStart.x;
  const D = lineEnd.y - lineStart.y;
  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = lenSq !== 0 ? dot / lenSq : -1;
  let xx, yy;
  if (param < 0) {
    xx = lineStart.x;
    yy = lineStart.y;
  } else if (param > 1) {
    xx = lineEnd.x;
    yy = lineEnd.y;
  } else {
    xx = lineStart.x + param * C;
    yy = lineStart.y + param * D;
  }
  return Math.sqrt((point.x - xx) ** 2 + (point.y - yy) ** 2);
};

export const findNearestPointOnPolygon = (
  point: Point,
  vertices: Point[]
): { point: Point; distance: number; edgeIndex: number } => {
  let minDist = Infinity;
  let nearestPoint: Point = point;
  let nearestEdgeIndex = 0;
  const edges = getPolygonEdges(vertices);
  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    const dist = pointToLineDistance(point, edge.start, edge.end);
    if (dist < minDist) {
      minDist = dist;
      const A = point.x - edge.start.x;
      const B = point.y - edge.start.y;
      const C = edge.end.x - edge.start.x;
      const D = edge.end.y - edge.start.y;
      const dot = A * C + B * D;
      const lenSq = C * C + D * D;
      let param = lenSq !== 0 ? dot / lenSq : -1;
      param = Math.max(0, Math.min(1, param));
      nearestPoint = {
        x: edge.start.x + param * C,
        y: edge.start.y + param * D
      };
      nearestEdgeIndex = i;
    }
  }
  return { point: nearestPoint, distance: minDist, edgeIndex: nearestEdgeIndex };
};

export const checkPolygonsConnected = (
  poly1: Point[],
  poly2: Point[],
  threshold: number = 10
): boolean => {
  for (const v of poly1) {
    const { distance } = findNearestPointOnPolygon(v, poly2);
    if (distance <= threshold) return true;
  }
  for (const v of poly2) {
    const { distance } = findNearestPointOnPolygon(v, poly1);
    if (distance <= threshold) return true;
  }
  return false;
};

export const isPolygonClosed = (vertices: Point[], threshold: number = 5): boolean => {
  if (vertices.length < 3) return false;
  const first = vertices[0];
  const last = vertices[vertices.length - 1];
  return distance(first, last) <= threshold;
};

export const snapToGrid = (point: Point, gridSize: number = 10): Point => {
  return {
    x: Math.round(point.x / gridSize) * gridSize,
    y: Math.round(point.y / gridSize) * gridSize
  };
};

export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const createPlacedPolygon = (
  block: PolygonBlock,
  position: Point,
  rotation: number = 0
): PlacedPolygon => {
  return {
    instanceId: generateId(),
    blockId: block.id,
    position,
    rotation,
    vertices: transformVertices(block.vertices, position, rotation)
  };
};

export const updatePlacedPolygon = (
  polygon: PlacedPolygon,
  block: PolygonBlock,
  newPosition: Point,
  newRotation: number
): PlacedPolygon => {
  return {
    ...polygon,
    position: newPosition,
    rotation: newRotation,
    vertices: transformVertices(block.vertices, newPosition, newRotation)
  };
};

export const getPolygonBoundingBox = (vertices: Point[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
} => {
  const xs = vertices.map(v => v.x);
  const ys = vertices.map(v => v.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  };
};
