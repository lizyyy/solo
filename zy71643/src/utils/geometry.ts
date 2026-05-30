import type { Point3D } from '../types';
import * as THREE from 'three';

export function distance(a: Point3D, b: Point3D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function subtract(a: Point3D, b: Point3D): Point3D {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function add(a: Point3D, b: Point3D): Point3D {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function scale(a: Point3D, s: number): Point3D {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}

export function dot(a: Point3D, b: Point3D): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cross(a: Point3D, b: Point3D): Point3D {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function length(a: Point3D): number {
  return Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
}

export function normalize(a: Point3D): Point3D {
  const len = length(a);
  if (len === 0) return { x: 0, y: 0, z: 0 };
  return scale(a, 1 / len);
}

export function lerp(a: Point3D, b: Point3D, t: number): Point3D {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

export interface LineLineResult {
  distance: number;
  closestPointA: Point3D;
  closestPointB: Point3D;
  t: number;
  s: number;
}

export function lineLineDistance(
  p1: Point3D,
  p2: Point3D,
  p3: Point3D,
  p4: Point3D
): LineLineResult {
  const d1 = subtract(p2, p1);
  const d2 = subtract(p4, p3);
  const d13 = subtract(p1, p3);

  const a = dot(d1, d1);
  const b = dot(d1, d2);
  const c = dot(d2, d2);
  const d = dot(d1, d13);
  const e = dot(d2, d13);
  const denom = a * c - b * b;

  let t = 0;
  let s = 0;

  if (Math.abs(denom) > 1e-10) {
    t = (b * e - c * d) / denom;
    s = (a * e - b * d) / denom;

    t = Math.max(0, Math.min(1, t));
    s = Math.max(0, Math.min(1, s));
  } else {
    t = 0;
    s = Math.max(0, Math.min(1, e / c));
  }

  const closestPointA = lerp(p1, p2, t);
  const closestPointB = lerp(p3, p4, s);
  const dist = distance(closestPointA, closestPointB);

  return {
    distance: dist,
    closestPointA,
    closestPointB,
    t,
    s,
  };
}

export function midpoint(a: Point3D, b: Point3D): Point3D {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: (a.z + b.z) / 2,
  };
}

export function toThreeVector(p: Point3D): THREE.Vector3 {
  return new THREE.Vector3(p.x, p.y, p.z);
}

export function fromThreeVector(v: THREE.Vector3): Point3D {
  return { x: v.x, y: v.y, z: v.z };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
