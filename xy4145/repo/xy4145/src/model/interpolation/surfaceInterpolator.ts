import { Borehole, StratumSurface, SurfacePoint, Triangle } from '../../types';

interface Point2D {
  x: number;
  y: number;
}

interface TriangleIndices {
  a: number;
  b: number;
  c: number;
}

export function generateStratumSurfaces(boreholes: Borehole[]): StratumSurface[] {
  if (boreholes.length === 0) return [];

  const stratumMap = new Map<string, SurfacePoint[]>();
  const soilInfo = new Map<string, { type: string; code: string }>();

  boreholes.forEach(borehole => {
    const baseElevation = borehole.groundElevation;

    borehole.layers.forEach(layer => {
      const key = layer.soilType;
      
      if (!stratumMap.has(key)) {
        stratumMap.set(key, []);
        soilInfo.set(key, { type: layer.soilType, code: layer.soilCode });
      }

      const topElevation = baseElevation - layer.topDepth;
      
      stratumMap.get(key)!.push({
        x: borehole.x,
        y: borehole.y,
        elevation: topElevation,
        boreholeId: borehole.id,
      });
    });
  });

  const surfaces: StratumSurface[] = [];
  
  stratumMap.forEach((points, key) => {
    if (points.length < 3) return;

    const uniquePoints = deduplicatePoints(points);
    const triangles = triangulate(uniquePoints);

    if (triangles.length > 0) {
      const info = soilInfo.get(key)!;
      surfaces.push({
        id: `surface_${key}`,
        soilType: info.type,
        soilCode: info.code,
        points: uniquePoints,
        triangles: triangles.map(t => ({ indices: [t.a, t.b, t.c] })),
      });
    }
  });

  return surfaces.sort((a, b) => {
    const avgElevA = a.points.reduce((s, p) => s + p.elevation, 0) / a.points.length;
    const avgElevB = b.points.reduce((s, p) => s + p.elevation, 0) / b.points.length;
    return avgElevB - avgElevA;
  });
}

function deduplicatePoints(points: SurfacePoint[]): SurfacePoint[] {
  const seen = new Map<string, SurfacePoint>();
  
  points.forEach(p => {
    const key = `${p.x.toFixed(2)}_${p.y.toFixed(2)}`;
    if (!seen.has(key)) {
      seen.set(key, p);
    }
  });

  return Array.from(seen.values());
}

function triangulate(points: SurfacePoint[]): TriangleIndices[] {
  if (points.length < 3) return [];

  const sorted = [...points].sort((a, b) => {
    if (a.x !== b.x) return a.x - b.x;
    return a.y - b.y;
  });

  return bowyerWatson(sorted);
}

function bowyerWatson(points: SurfacePoint[]): TriangleIndices[] {
  const n = points.length;
  if (n < 3) return [];

  const superTriangle = createSuperTriangle(points);
  const allPoints = [...points, ...superTriangle.points];
  let triangles: TriangleIndices[] = [superTriangle.indices];

  for (let i = 0; i < n; i++) {
    const point = points[i];
    const badTriangles: number[] = [];
    const polygon: Set<string> = new Set();

    for (let t = 0; t < triangles.length; t++) {
      const tri = triangles[t];
      if (isPointInCircumcircle(point, allPoints[tri.a], allPoints[tri.b], allPoints[tri.c])) {
        badTriangles.push(t);
        
        const edges = [
          `${Math.min(tri.a, tri.b)}_${Math.max(tri.a, tri.b)}`,
          `${Math.min(tri.b, tri.c)}_${Math.max(tri.b, tri.c)}`,
          `${Math.min(tri.c, tri.a)}_${Math.max(tri.c, tri.a)}`,
        ];

        edges.forEach(edge => {
          if (polygon.has(edge)) {
            polygon.delete(edge);
          } else {
            polygon.add(edge);
          }
        });
      }
    }

    const newTriangles: TriangleIndices[] = [];
    for (let t = 0; t < triangles.length; t++) {
      if (!badTriangles.includes(t)) {
        newTriangles.push(triangles[t]);
      }
    }

    polygon.forEach(edge => {
      const [a, b] = edge.split('_').map(Number);
      newTriangles.push({ a, b, c: i });
    });

    triangles = newTriangles;
  }

  const superIndices = new Set([n, n + 1, n + 2]);
  return triangles.filter(tri => 
    !superIndices.has(tri.a) && 
    !superIndices.has(tri.b) && 
    !superIndices.has(tri.c)
  );
}

function createSuperTriangle(points: SurfacePoint[]): {
  points: SurfacePoint[];
  indices: TriangleIndices;
} {
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  points.forEach(p => {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  });

  const dx = maxX - minX;
  const dy = maxY - minY;
  const delta = Math.max(dx, dy) * 10;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  const superPoints: SurfacePoint[] = [
    { x: centerX - delta, y: centerY - delta, elevation: 0 },
    { x: centerX + delta * 2, y: centerY - delta, elevation: 0 },
    { x: centerX, y: centerY + delta * 2, elevation: 0 },
  ];

  return {
    points: superPoints,
    indices: { a: points.length, b: points.length + 1, c: points.length + 2 },
  };
}

function isPointInCircumcircle(
  p: SurfacePoint,
  a: SurfacePoint,
  b: SurfacePoint,
  c: SurfacePoint
): boolean {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-10) return false;

  const ux = (a.x * a.x + a.y * a.y) * (b.y - c.y) +
             (b.x * b.x + b.y * b.y) * (c.y - a.y) +
             (c.x * c.x + c.y * c.y) * (a.y - b.y);
  const uy = (a.x * a.x + a.y * a.y) * (c.x - b.x) +
             (b.x * b.x + b.y * b.y) * (a.x - c.x) +
             (c.x * c.x + c.y * c.y) * (b.x - a.x);

  const centerX = ux / d;
  const centerY = uy / d;
  
  const radiusSq = (centerX - a.x) ** 2 + (centerY - a.y) ** 2;
  const distSq = (centerX - p.x) ** 2 + (centerY - p.y) ** 2;

  return distSq <= radiusSq + 1e-10;
}

export function interpolateElevation(
  x: number,
  y: number,
  surface: StratumSurface
): number | null {
  for (const triangle of surface.triangles) {
    const p0 = surface.points[triangle.indices[0]];
    const p1 = surface.points[triangle.indices[1]];
    const p2 = surface.points[triangle.indices[2]];

    if (isPointInTriangle(x, y, p0.x, p0.y, p1.x, p1.y, p2.x, p2.y)) {
      return barycentricInterpolate(x, y, p0, p1, p2);
    }
  }
  return null;
}

function isPointInTriangle(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number,
  x3: number, y3: number
): boolean {
  const d1 = sign(px, py, x1, y1, x2, y2);
  const d2 = sign(px, py, x2, y2, x3, y3);
  const d3 = sign(px, py, x3, y3, x1, y1);

  const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
  const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);

  return !(hasNeg && hasPos);
}

function sign(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number
): number {
  return (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2);
}

function barycentricInterpolate(
  x: number, y: number,
  p0: SurfacePoint, p1: SurfacePoint, p2: SurfacePoint
): number {
  const v0 = { x: p1.x - p0.x, y: p1.y - p0.y };
  const v1 = { x: p2.x - p0.x, y: p2.y - p0.y };
  const v2 = { x: x - p0.x, y: y - p0.y };

  const dot00 = v0.x * v0.x + v0.y * v0.y;
  const dot01 = v0.x * v1.x + v0.y * v1.y;
  const dot02 = v0.x * v2.x + v0.y * v2.y;
  const dot11 = v1.x * v1.x + v1.y * v1.y;
  const dot12 = v1.x * v2.x + v1.y * v2.y;

  const denom = dot00 * dot11 - dot01 * dot01;
  if (Math.abs(denom) < 1e-10) return p0.elevation;

  const u = (dot11 * dot02 - dot01 * dot12) / denom;
  const v = (dot00 * dot12 - dot01 * dot02) / denom;

  return (1 - u - v) * p0.elevation + u * p1.elevation + v * p2.elevation;
}
