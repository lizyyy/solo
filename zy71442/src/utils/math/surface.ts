import { evaluate } from 'mathjs';
import type { Point3D, UVPoint, Vector3D } from '../../types/surface';
import { vec3 } from './geometry';

export interface SurfaceFunction {
  (u: number, v: number): Point3D;
}

export function parseSurfaceEquation(
  equation: string,
  uvRange: { u: [number, number]; v: [number, number] }
): SurfaceFunction {
  const [uMin, uMax] = uvRange.u;
  const [vMin, vMax] = uvRange.v;

  return (u: number, v: number): Point3D => {
    const uActual = uMin + u * (uMax - uMin);
    const vActual = vMin + v * (vMax - vMin);
    try {
      const scope = { u: uActual, v: vActual };
      const result = evaluate(equation, scope);

      if (typeof result === 'number') {
        return { x: uActual, y: result, z: vActual };
      }
      if (Array.isArray(result) && result.length === 3) {
        return { x: result[0], y: result[1], z: result[2] };
      }
      if (typeof result === 'object' && 'x' in result && 'y' in result && 'z' in result) {
        return result as Point3D;
      }
      return { x: uActual, y: Number(result) || 0, z: vActual };
    } catch (e) {
      console.error('Error evaluating surface equation:', e);
      return { x: uActual, y: 0, z: vActual };
    }
  };
}

export function generateSurfaceVertices(
  surfaceFn: SurfaceFunction,
  resolution: number
): { vertices: Point3D[]; uvs: UVPoint[] } {
  const vertices: Point3D[] = [];
  const uvs: UVPoint[] = [];

  for (let j = 0; j < resolution; j++) {
    for (let i = 0; i < resolution; i++) {
      const u = i / (resolution - 1);
      const v = j / (resolution - 1);
      vertices.push(surfaceFn(u, v));
      uvs.push({ u, v });
    }
  }

  return { vertices, uvs };
}

export function computeSurfaceNormals(
  vertices: Point3D[],
  resolution: number
): Vector3D[] {
  const normals: Vector3D[] = [];

  for (let j = 0; j < resolution; j++) {
    for (let i = 0; i < resolution; i++) {
      const idx = j * resolution + i;

      const iPrev = Math.max(0, i - 1);
      const iNext = Math.min(resolution - 1, i + 1);
      const jPrev = Math.max(0, j - 1);
      const jNext = Math.min(resolution - 1, j + 1);

      const pI = vertices[j * resolution + iNext];
      const pIPrev = vertices[j * resolution + iPrev];
      const pJ = vertices[jNext * resolution + i];
      const pJPrev = vertices[jPrev * resolution + i];

      const du = vec3.sub(pI, pIPrev);
      const dv = vec3.sub(pJ, pJPrev);

      const normal = vec3.normalize(vec3.cross(du, dv));
      normals.push(normal);
    }
  }

  return normals;
}

export function checkNormalConsistency(
  normals: Vector3D[],
  threshold: number = Math.PI / 4
): { reversedIndices: number[]; deviations: number[] } {
  const reversedIndices: number[] = [];
  const deviations: number[] = [];

  if (normals.length === 0) return { reversedIndices, deviations };

  const referenceNormal = normals[Math.floor(normals.length / 2)];

  normals.forEach((normal, idx) => {
    const dot = vec3.dot(normal, referenceNormal);
    const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
    deviations.push(angle);

    if (angle > threshold) {
      reversedIndices.push(idx);
    }
  });

  return { reversedIndices, deviations };
}

export function generateBoundaryPoints(
  surfaceFn: SurfaceFunction,
  resolution: number
): Point3D[] {
  const points: Point3D[] = [];

  for (let i = 0; i <= resolution; i++) {
    const t = i / resolution;
    points.push(surfaceFn(t, 0));
  }
  for (let i = 1; i <= resolution; i++) {
    const t = i / resolution;
    points.push(surfaceFn(1, t));
  }
  for (let i = 1; i <= resolution; i++) {
    const t = i / resolution;
    points.push(surfaceFn(1 - t, 1));
  }
  for (let i = 1; i < resolution; i++) {
    const t = i / resolution;
    points.push(surfaceFn(0, 1 - t));
  }

  return points;
}

export function generateSamplePoints(
  surfaceFn: SurfaceFunction,
  count: number,
  seed: number = 42
): Point3D[] {
  const points: Point3D[] = [];
  const random = mulberry32(seed);

  for (let i = 0; i < count; i++) {
    const u = random();
    const v = random();
    points.push(surfaceFn(u, v));
  }

  return points;
}

export function checkBoundaryClosure(
  points: Point3D[],
  tolerance: number = 0.01
): { isClosed: boolean; gapStart?: number; gapEnd?: number; maxGap: number } {
  if (points.length < 2) return { isClosed: true, maxGap: 0 };

  let maxGap = 0;
  let gapStart = -1;
  let gapEnd = -1;

  for (let i = 0; i < points.length; i++) {
    const nextIdx = (i + 1) % points.length;
    const dist = vec3.distance(points[i], points[nextIdx]);
    if (dist > maxGap) {
      maxGap = dist;
      gapStart = i;
      gapEnd = nextIdx;
    }
  }

  return {
    isClosed: maxGap < tolerance,
    gapStart: maxGap >= tolerance ? gapStart : undefined,
    gapEnd: maxGap >= tolerance ? gapEnd : undefined,
    maxGap,
  };
}

export function computeSampleDensity(
  samplePoints: Point3D[],
  surfaceArea: number
): { density: number; sparseIndices: number[]; averageSpacing: number } {
  if (samplePoints.length < 2 || surfaceArea <= 0) {
    return { density: 0, sparseIndices: [], averageSpacing: 0 };
  }

  const density = samplePoints.length / surfaceArea;
  const sparseIndices: number[] = [];

  let totalSpacing = 0;
  const k = Math.min(5, samplePoints.length - 1);

  samplePoints.forEach((p, i) => {
    const distances: number[] = [];
    samplePoints.forEach((q, j) => {
      if (i !== j) {
        distances.push(vec3.distance(p, q));
      }
    });
    distances.sort((a, b) => a - b);
    const avgKnn = distances.slice(0, k).reduce((a, b) => a + b, 0) / k;
    totalSpacing += avgKnn;

    if (avgKnn > Math.sqrt(surfaceArea / samplePoints.length) * 2) {
      sparseIndices.push(i);
    }
  });

  return {
    density,
    sparseIndices,
    averageSpacing: totalSpacing / samplePoints.length,
  };
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
