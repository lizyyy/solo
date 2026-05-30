import type { Vec3, PathType } from '../types';
import { calculateSchwarzschildRadius } from './constants';

const vec3 = {
  sub: (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  add: (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  scale: (v: Vec3, s: number): Vec3 => [v[0] * s, v[1] * s, v[2] * s],
  length: (v: Vec3): number => Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]),
  normalize: (v: Vec3): Vec3 => {
    const len = vec3.length(v);
    return len > 0 ? [v[0] / len, v[1] / len, v[2] / len] : [0, 0, 0];
  },
  dot: (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a: Vec3, b: Vec3): Vec3 => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ],
  distance: (a: Vec3, b: Vec3): number => vec3.length(vec3.sub(a, b)),
};

export interface GeodesicResult {
  pathPoints: Vec3[];
  deflectionAngle: number;
  pathType: PathType;
  impactParameter: number;
  isCaptured: boolean;
}

export const calculateGeodesic = (
  startPoint: Vec3,
  initialDirection: Vec3,
  blackHoleMass: number,
  maxSteps: number = 500,
  stepSize: number = 0.1,
  lensStrength: number = 1.0
): GeodesicResult => {
  const rs = calculateSchwarzschildRadius(blackHoleMass);
  const photonSphere = 1.5 * rs;
  const blackHoleCenter: Vec3 = [0, 0, 0];

  const pathPoints: Vec3[] = [startPoint];
  let currentPos: Vec3 = [...startPoint];
  let currentDir: Vec3 = vec3.normalize(initialDirection);

  let impactParameter = 0;
  let deflectionAngle = 0;
  let pathType: PathType = 'normal';
  let isCaptured = false;

  const initialToCenter = vec3.sub(blackHoleCenter, startPoint);
  const parallel = vec3.scale(currentDir, vec3.dot(initialToCenter, currentDir));
  const perpendicular = vec3.sub(initialToCenter, parallel);
  impactParameter = vec3.length(perpendicular);

  let prevDir: Vec3 = [...currentDir];

  for (let i = 0; i < maxSteps; i++) {
    const toCenter = vec3.sub(blackHoleCenter, currentPos);
    const distance = vec3.length(toCenter);

    if (distance < rs * 1.01) {
      isCaptured = true;
      pathType = 'captured';
      pathPoints.push([...currentPos]);
      break;
    }

    if (distance < photonSphere * 1.1 && distance > photonSphere * 0.9) {
      pathType = 'critical';
    }

    const toCenterNorm = vec3.normalize(toCenter);
    const distanceFactor = Math.max(rs, distance);
    const gravityStrength = lensStrength * (rs / (distanceFactor * distanceFactor));

    const perpDir = vec3.normalize(vec3.cross(vec3.cross(currentDir, toCenterNorm), currentDir));
    const deflection = vec3.scale(perpDir, gravityStrength * stepSize * 10);

    currentDir = vec3.normalize(vec3.add(currentDir, deflection));
    currentPos = vec3.add(currentPos, vec3.scale(currentDir, stepSize));

    pathPoints.push([...currentPos]);

    if (i % 10 === 0) {
      const dotProduct = Math.max(-1, Math.min(1, vec3.dot(prevDir, currentDir)));
      deflectionAngle += Math.acos(dotProduct);
      prevDir = [...currentDir];
    }

    if (distance > 100) {
      break;
    }
  }

  return {
    pathPoints,
    deflectionAngle,
    pathType,
    impactParameter,
    isCaptured,
  };
};

export const generateRayStartPoints = (
  count: number,
  distance: number,
  blackHoleMass: number
): Array<{ start: Vec3; direction: Vec3 }> => {
  const rs = calculateSchwarzschildRadius(blackHoleMass);
  const rays: Array<{ start: Vec3; direction: Vec3 }> = [];
  const minImpact = rs * 1.2;
  const maxImpact = rs * 8;

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const impactFactor = minImpact + ((i / count) * (maxImpact - minImpact));

    const yOffset = (Math.sin(i * 0.7) * 0.5 + 0.5) * rs * 3 - rs * 1.5;

    const start: Vec3 = [
      Math.cos(angle) * distance,
      yOffset,
      Math.sin(angle) * distance,
    ];

    const targetOffset: Vec3 = [
      Math.cos(angle + Math.PI * 0.5) * impactFactor,
      yOffset * 0.3,
      Math.sin(angle + Math.PI * 0.5) * impactFactor,
    ];

    const direction = vec3.normalize(vec3.sub(targetOffset, start));

    rays.push({ start, direction });
  }

  return rays;
};

export const calculateDeflectionColor = (deflectionAngle: number, pathType: PathType): string => {
  if (pathType === 'captured') return '#ff4444';
  if (pathType === 'critical') return '#ffaa00';

  const normalizedAngle = Math.min(deflectionAngle / Math.PI, 1);
  const r = Math.floor(100 + normalizedAngle * 155);
  const g = Math.floor(200 - normalizedAngle * 100);
  const b = Math.floor(255 - normalizedAngle * 100);

  return `rgb(${r}, ${g}, ${b})`;
};
