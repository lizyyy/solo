import type {
  CoilConfig,
  CraneConfig,
  LevelConfig,
  Vec2,
  Vec3,
  ZoneConfig,
} from "@/types/game";

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function dist2D(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

export function dist3D(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function pointInZone(
  p: Vec3,
  z: ZoneConfig,
  pad = 0,
): boolean {
  return (
    p.x >= z.position.x - z.size.x / 2 - pad &&
    p.x <= z.position.x + z.size.x / 2 + pad &&
    p.z >= z.position.z - z.size.z / 2 - pad &&
    p.z <= z.position.z + z.size.z / 2 + pad
  );
}

export function segmentIntersectsZone(
  a: Vec3,
  b: Vec3,
  z: ZoneConfig,
  pad = 0,
): boolean {
  if (pointInZone(a, z, pad) || pointInZone(b, z, pad)) return true;
  const steps = 8;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const p: Vec3 = {
      x: lerp(a.x, b.x, t),
      y: lerp(a.y, b.y, t),
      z: lerp(a.z, b.z, t),
    };
    if (pointInZone(p, z, pad)) return true;
  }
  return false;
}

export interface TiltResult {
  tiltDegrees: number;
  axis: Vec2;
  overThreshold: boolean;
}

export function computeTilt(
  coil: CoilConfig,
  hookOffset: Vec2,
  maxTiltDegrees: number,
): TiltResult {
  const dx = coil.centerOffset.x - hookOffset.x;
  const dy = coil.centerOffset.y - hookOffset.y;
  const mag = Math.hypot(dx, dy);
  const normalized = clamp(mag / Math.max(coil.radius, 0.001), 0, 2);
  const tiltDegrees = normalized * maxTiltDegrees * 1.1;
  const axisMag = mag || 1;
  return {
    tiltDegrees,
    axis: { x: dx / axisMag, y: dy / axisMag },
    overThreshold: tiltDegrees > maxTiltDegrees,
  };
}

export interface CraneCollisionResult {
  collided: boolean;
  distance: number;
  a: string;
  b: string;
}

export function checkCraneCollision(
  a: CraneConfig,
  aPos: { x: number; z: number },
  b: CraneConfig,
  bPos: { x: number; z: number },
  minDistance: number,
): CraneCollisionResult {
  const dx = aPos.x - bPos.x;
  const dz = aPos.z - bPos.z;
  const d = Math.hypot(dx, dz);
  return {
    collided: d < minDistance,
    distance: d,
    a: a.id,
    b: b.id,
  };
}

export function findZoneById(level: LevelConfig, id: string): ZoneConfig | undefined {
  return level.zones.find((z) => z.id === id);
}

export function findCraneById(level: LevelConfig, id: string): CraneConfig | undefined {
  return level.cranes.find((c) => c.id === id);
}
