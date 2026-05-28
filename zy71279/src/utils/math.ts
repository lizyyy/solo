import type { Vec3 } from '@/types';

export const vec3 = {
  add(a: Vec3, b: Vec3): Vec3 {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  },

  sub(a: Vec3, b: Vec3): Vec3 {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  },

  mul(v: Vec3, s: number): Vec3 {
    return [v[0] * s, v[1] * s, v[2] * s];
  },

  dot(a: Vec3, b: Vec3): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  },

  cross(a: Vec3, b: Vec3): Vec3 {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0]
    ];
  },

  length(v: Vec3): number {
    return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  },

  normalize(v: Vec3): Vec3 {
    const len = vec3.length(v);
    if (len === 0) return [0, 0, 0];
    return vec3.mul(v, 1 / len);
  },

  distance(a: Vec3, b: Vec3): number {
    return vec3.length(vec3.sub(a, b));
  },

  squaredDistance(a: Vec3, b: Vec3): number {
    const d = vec3.sub(a, b);
    return d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
  },

  lerp(a: Vec3, b: Vec3, t: number): Vec3 {
    return [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t
    ];
  },

  random(min: number = 0, max: number = 1): Vec3 {
    const range = max - min;
    return [
      min + Math.random() * range,
      min + Math.random() * range,
      min + Math.random() * range
    ];
  }
};

export function computeTriangleArea(v0: Vec3, v1: Vec3, v2: Vec3): number {
  const ab = vec3.sub(v1, v0);
  const ac = vec3.sub(v2, v0);
  const cross = vec3.cross(ab, ac);
  return vec3.length(cross) * 0.5;
}

export function computeTriangleNormal(v0: Vec3, v1: Vec3, v2: Vec3): Vec3 {
  const ab = vec3.sub(v1, v0);
  const ac = vec3.sub(v2, v0);
  return vec3.normalize(vec3.cross(ab, ac));
}

export function computeTetrahedronVolume(v0: Vec3, v1: Vec3, v2: Vec3, v3: Vec3): number {
  const ab = vec3.sub(v1, v0);
  const ac = vec3.sub(v2, v0);
  const ad = vec3.sub(v3, v0);
  const cross = vec3.cross(ab, ac);
  return Math.abs(vec3.dot(cross, ad)) / 6.0;
}

export function pointToTriangleDistance(
  point: Vec3,
  v0: Vec3,
  v1: Vec3,
  v2: Vec3
): { distance: number; closestPoint: Vec3; barycentric: [number, number, number] } {
  const ab = vec3.sub(v1, v0);
  const ac = vec3.sub(v2, v0);
  const ap = vec3.sub(point, v0);

  const d1 = vec3.dot(ab, ap);
  const d2 = vec3.dot(ac, ap);

  if (d1 <= 0 && d2 <= 0) {
    return {
      distance: vec3.distance(point, v0),
      closestPoint: v0,
      barycentric: [1, 0, 0]
    };
  }

  const bp = vec3.sub(point, v1);
  const d3 = vec3.dot(ab, bp);
  const d4 = vec3.dot(ac, bp);

  if (d3 >= 0 && d4 <= d3) {
    return {
      distance: vec3.distance(point, v1),
      closestPoint: v1,
      barycentric: [0, 1, 0]
    };
  }

  const vc = d1 * d4 - d3 * d2;
  const v = d1 / (d1 - d3);
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const closestPoint = vec3.lerp(v0, v1, v);
    return {
      distance: vec3.distance(point, closestPoint),
      closestPoint,
      barycentric: [1 - v, v, 0]
    };
  }

  const cp = vec3.sub(point, v2);
  const d5 = vec3.dot(ab, cp);
  const d6 = vec3.dot(ac, cp);

  if (d6 >= 0 && d5 <= d6) {
    return {
      distance: vec3.distance(point, v2),
      closestPoint: v2,
      barycentric: [0, 0, 1]
    };
  }

  const vb = d5 * d2 - d1 * d6;
  const w = d2 / (d2 - d6);
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const closestPoint = vec3.lerp(v0, v2, w);
    return {
      distance: vec3.distance(point, closestPoint),
      closestPoint,
      barycentric: [1 - w, 0, w]
    };
  }

  const va = d3 * d6 - d5 * d4;
  const w2 = (d4 - d3) / ((d4 - d3) + (d5 - d6));
  if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) {
    const closestPoint = vec3.lerp(v1, v2, w2);
    return {
      distance: vec3.distance(point, closestPoint),
      closestPoint,
      barycentric: [0, 1 - w2, w2]
    };
  }

  const denom = 1.0 / (va + vb + vc);
  const u = vb * denom;
  const vv = vc * denom;
  const ww = 1 - u - vv;

  const closestPoint: Vec3 = [
    v0[0] * u + v1[0] * vv + v2[0] * ww,
    v0[1] * u + v1[1] * vv + v2[1] * ww,
    v0[2] * u + v1[2] * vv + v2[2] * ww
  ];

  return {
    distance: vec3.distance(point, closestPoint),
    closestPoint,
    barycentric: [u, vv, ww]
  };
}

export function computeMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function computeStandardDeviation(values: number[], mean?: number): number {
  if (values.length === 0) return 0;
  const m = mean ?? computeMean(values);
  const squaredDiffs = values.map(v => Math.pow(v - m, 2));
  return Math.sqrt(computeMean(squaredDiffs));
}

export function computeHistogram(
  values: number[],
  bins: number,
  min?: number,
  max?: number
): { range: [number, number]; count: number }[] {
  if (values.length === 0) return [];

  const actualMin = min ?? Math.min(...values);
  const actualMax = max ?? Math.max(...values);
  const range = actualMax - actualMin;

  if (range === 0) {
    return [{ range: [actualMin, actualMax], count: values.length }];
  }

  const binWidth = range / bins;
  const histogram: { range: [number, number]; count: number }[] = [];

  for (let i = 0; i < bins; i++) {
    histogram.push({
      range: [actualMin + i * binWidth, actualMin + (i + 1) * binWidth],
      count: 0
    });
  }

  for (const value of values) {
    let binIndex = Math.floor((value - actualMin) / binWidth);
    binIndex = Math.max(0, Math.min(binIndex, bins - 1));
    histogram[binIndex].count++;
  }

  return histogram;
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatNumber(num: number, decimals: number = 2): string {
  return num.toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

export function formatTime(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  if (h > 0) {
    return `${h}小时${m}分钟`;
  }
  return `${m}分钟`;
}
