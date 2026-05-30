import type { Point3D, Vector3D } from '../../types/surface';

export const vec3 = {
  add: (a: Point3D, b: Point3D): Point3D => ({
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z,
  }),

  sub: (a: Point3D, b: Point3D): Point3D => ({
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z,
  }),

  mul: (v: Point3D, s: number): Point3D => ({
    x: v.x * s,
    y: v.y * s,
    z: v.z * s,
  }),

  dot: (a: Vector3D, b: Vector3D): number => a.x * b.x + a.y * b.y + a.z * b.z,

  cross: (a: Vector3D, b: Vector3D): Vector3D => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }),

  length: (v: Vector3D): number => Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z),

  normalize: (v: Vector3D): Vector3D => {
    const len = vec3.length(v);
    return len > 0 ? vec3.mul(v, 1 / len) : { x: 0, y: 0, z: 0 };
  },

  distance: (a: Point3D, b: Point3D): number => vec3.length(vec3.sub(a, b)),

  angleBetween: (a: Vector3D, b: Vector3D): number => {
    const dot = vec3.dot(a, b);
    const lenA = vec3.length(a);
    const lenB = vec3.length(b);
    if (lenA === 0 || lenB === 0) return 0;
    const cos = Math.max(-1, Math.min(1, dot / (lenA * lenB)));
    return Math.acos(cos);
  },

  negate: (v: Vector3D): Vector3D => ({
    x: -v.x,
    y: -v.y,
    z: -v.z,
  }),

  lerp: (a: Point3D, b: Point3D, t: number): Point3D => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  }),
};

export function computeBoundingBox(points: Point3D[]): {
  min: Point3D;
  max: Point3D;
  center: Point3D;
} {
  if (points.length === 0) {
    return {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 0, y: 0, z: 0 },
      center: { x: 0, y: 0, z: 0 },
    };
  }

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  points.forEach((p) => {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    minZ = Math.min(minZ, p.z);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
    maxZ = Math.max(maxZ, p.z);
  });

  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
    center: {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      z: (minZ + maxZ) / 2,
    },
  };
}

export function generateGridIndices(
  width: number,
  height: number
): number[] {
  const indices: number[] = [];
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const a = y * width + x;
      const b = y * width + x + 1;
      const c = (y + 1) * width + x;
      const d = (y + 1) * width + x + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  return indices;
}

export function flattenPoints(points: Point3D[]): Float32Array {
  const arr = new Float32Array(points.length * 3);
  points.forEach((p, i) => {
    arr[i * 3] = p.x;
    arr[i * 3 + 1] = p.y;
    arr[i * 3 + 2] = p.z;
  });
  return arr;
}

export function flattenUVs(uvs: { u: number; v: number }[]): Float32Array {
  const arr = new Float32Array(uvs.length * 2);
  uvs.forEach((uv, i) => {
    arr[i * 2] = uv.u;
    arr[i * 2 + 1] = uv.v;
  });
  return arr;
}
