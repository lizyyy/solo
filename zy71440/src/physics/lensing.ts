import type { Vec3 } from '../types';
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
};

export interface LensingResult {
  lensedPosition: Vec3;
  magnification: number;
  isVisible: boolean;
  timeDelay: number;
}

export const calculateGravitationalLensing = (
  starPosition: Vec3,
  blackHoleMass: number,
  observerPosition: Vec3,
  lensStrength: number = 1.0
): LensingResult => {
  const blackHoleCenter: Vec3 = [0, 0, 0];
  const rs = calculateSchwarzschildRadius(blackHoleMass);

  const starToBH = vec3.sub(blackHoleCenter, starPosition);
  const starDistance = vec3.length(starToBH);
  const starDir = vec3.normalize(starToBH);

  const observerToBH = vec3.sub(blackHoleCenter, observerPosition);
  const observerDistance = vec3.length(observerToBH);

  const impactParam = Math.abs(vec3.dot(
    vec3.cross(starDir, vec3.normalize(observerToBH)),
    starDir
  ));

  const einsteinAngle = Math.sqrt(
    (2 * rs * (starDistance + observerDistance)) / (starDistance * observerDistance)
  );

  const normalizedImpact = impactParam / Math.max(rs, starDistance * 0.01);
  const deflectionAngle = lensStrength * einsteinAngle * Math.exp(-normalizedImpact * 0.5);

  const perpendicular = vec3.normalize(
    vec3.cross(vec3.cross(starDir, [0, 1, 0]), starDir)
  );

  const lensedDir = vec3.normalize(
    vec3.add(
      starDir,
      vec3.scale(perpendicular, deflectionAngle * 0.3)
    )
  );

  const lensedPosition = vec3.add(
    blackHoleCenter,
    vec3.scale(lensedDir, -starDistance * 0.8)
  );

  let magnification = 1.0;
  if (normalizedImpact < 5) {
    magnification = 1.0 + lensStrength * 2.0 * Math.exp(-normalizedImpact * 0.3);
  }

  const minVisibleDistance = rs * 1.1;
  const isVisible = starDistance > minVisibleDistance;

  const timeDelay = (rs / 3e8) * (1 + Math.log(starDistance / rs));

  return {
    lensedPosition,
    magnification,
    isVisible,
    timeDelay,
  };
};

export const generateStarField = (
  count: number,
  distance: number,
  density: number
): Array<{
  position: Vec3;
  magnitude: number;
  temperature: number;
}> => {
  const actualCount = Math.floor(count * density);
  const stars: Array<{
    position: Vec3;
    magnitude: number;
    temperature: number;
  }> = [];

  for (let i = 0; i < actualCount; i++) {
    const u1 = Math.random();
    const u2 = Math.random();
    const u3 = Math.random();

    const theta = 2 * Math.PI * u1;
    const phi = Math.acos(2 * u2 - 1);
    const r = distance * (0.8 + Math.random() * 0.4);

    const position: Vec3 = [
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi),
    ];

    const magnitude = -1 + Math.random() * 6;

    const tempType = Math.random();
    let temperature: number;
    if (tempType < 0.1) {
      temperature = 2500 + Math.random() * 1000;
    } else if (tempType < 0.3) {
      temperature = 3500 + Math.random() * 1500;
    } else if (tempType < 0.6) {
      temperature = 5000 + Math.random() * 1000;
    } else if (tempType < 0.85) {
      temperature = 6000 + Math.random() * 1500;
    } else {
      temperature = 7500 + Math.random() * 5000;
    }

    stars.push({ position, magnitude, temperature });
  }

  return stars;
};
