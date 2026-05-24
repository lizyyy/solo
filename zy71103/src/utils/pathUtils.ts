import type { PathPoint, Vector3 } from '../types';
import * as THREE from 'three';

export const catmullRom = (
  p0: Vector3,
  p1: Vector3,
  p2: Vector3,
  p3: Vector3,
  t: number
): Vector3 => {
  const t2 = t * t;
  const t3 = t2 * t;

  return {
    x:
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y:
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
    z:
      0.5 *
      (2 * p1.z +
        (-p0.z + p2.z) * t +
        (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 +
        (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3),
  };
};

export const getPositionOnPath = (
  path: PathPoint[],
  currentTime: number
): { position: Vector3; rotation: number } | null => {
  if (path.length === 0) return null;
  if (path.length === 1) {
    return { position: path[0].position, rotation: 0 };
  }

  let segmentIndex = -1;
  for (let i = 0; i < path.length - 1; i++) {
    if (currentTime >= path[i].timestamp && currentTime <= path[i + 1].timestamp) {
      segmentIndex = i;
      break;
    }
  }

  if (segmentIndex === -1) {
    if (currentTime < path[0].timestamp) {
      return { position: path[0].position, rotation: 0 };
    }
    return { position: path[path.length - 1].position, rotation: 0 };
  }

  const p0 = path[Math.max(0, segmentIndex - 1)].position;
  const p1 = path[segmentIndex].position;
  const p2 = path[segmentIndex + 1].position;
  const p3 = path[Math.min(path.length - 1, segmentIndex + 2)].position;

  const t1 = path[segmentIndex].timestamp;
  const t2 = path[segmentIndex + 1].timestamp;
  const t = (currentTime - t1) / (t2 - t1);

  const position = catmullRom(p0, p1, p2, p3, t);

  const nextPos = catmullRom(p0, p1, p2, p3, Math.min(1, t + 0.01));
  const rotation = Math.atan2(nextPos.x - position.x, nextPos.z - position.z);

  return { position, rotation };
};

export const generateSmoothPathPoints = (
  path: PathPoint[],
  segments: number = 20
): Vector3[] => {
  if (path.length < 2) return path.map((p) => p.position);

  const points: Vector3[] = [];

  for (let i = 0; i < path.length - 1; i++) {
    const p0 = path[Math.max(0, i - 1)].position;
    const p1 = path[i].position;
    const p2 = path[i + 1].position;
    const p3 = path[Math.min(path.length - 1, i + 2)].position;

    for (let j = 0; j <= segments; j++) {
      const t = j / segments;
      points.push(catmullRom(p0, p1, p2, p3, t));
    }
  }

  return points;
};

export const calculateTotalDuration = (path: PathPoint[]): number => {
  if (path.length === 0) return 0;
  return path[path.length - 1].timestamp;
};

export const vector3ToThree = (v: Vector3): THREE.Vector3 => {
  return new THREE.Vector3(v.x, v.y, v.z);
};

export const threeToVector3 = (v: THREE.Vector3): Vector3 => {
  return { x: v.x, y: v.y, z: v.z };
};
