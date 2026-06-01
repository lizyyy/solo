import { Point, SoundRayPath } from '@/types';

const SPEED_OF_SOUND = 343;

export function calculateRayPaths(
  source: { x: number; y: number; z: number },
  chambers: Point[],
  listener: { x: number; y: number; z: number }
): SoundRayPath[] {
  const activeChambers = chambers.filter(
    c => c.isReflectionChamber && c.participatesInRayPath && c.x !== null && c.y !== null && c.z !== null
  );

  const paths: SoundRayPath[] = [];

  const directPath: SoundRayPath = {
    points: [source, listener],
    reflectedChambers: []
  };
  paths.push(directPath);

  for (const chamber of activeChambers) {
    const chamberPos = { x: chamber.x!, y: chamber.y!, z: chamber.z! };
    const reflectionPoint = calculateReflection(chamberPos, source, listener);
    if (reflectionPoint) {
      paths.push({
        points: [source, reflectionPoint, listener],
        reflectedChambers: [chamber.id]
      });
    }
  }

  if (activeChambers.length >= 2) {
    for (let i = 0; i < activeChambers.length; i++) {
      for (let j = i + 1; j < activeChambers.length; j++) {
        const c1 = { x: activeChambers[i].x!, y: activeChambers[i].y!, z: activeChambers[i].z! };
        const c2 = { x: activeChambers[j].x!, y: activeChambers[j].y!, z: activeChambers[j].z! };
        const r1 = calculateReflection(c1, source, c2);
        if (r1) {
          const r2 = calculateReflection(c2, r1, listener);
          if (r2) {
            paths.push({
              points: [source, r1, r2, listener],
              reflectedChambers: [activeChambers[i].id, activeChambers[j].id]
            });
          }
        }
      }
    }
  }

  return paths;
}

function calculateReflection(
  reflector: { x: number; y: number; z: number },
  incoming: { x: number; y: number; z: number },
  target: { x: number; y: number; z: number }
): { x: number; y: number; z: number } | null {
  const dx = reflector.x - incoming.x;
  const dy = reflector.y - incoming.y;
  const dz = reflector.z - incoming.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (dist < 0.001) return null;

  const nx = dx / dist;
  const ny = dy / dist;
  const nz = dz / dist;

  const rx = target.x - reflector.x;
  const ry = target.y - reflector.y;
  const rz = target.z - reflector.z;

  const dot = rx * nx + ry * ny + rz * nz;

  return {
    x: rx - 2 * dot * nx + reflector.x,
    y: ry - 2 * dot * ny + reflector.y,
    z: rz - 2 * dot * nz + reflector.z
  };
}

export function calculatePathLength(path: SoundRayPath): number {
  let length = 0;
  for (let i = 1; i < path.points.length; i++) {
    const dx = path.points[i].x - path.points[i - 1].x;
    const dy = path.points[i].y - path.points[i - 1].y;
    const dz = path.points[i].z - path.points[i - 1].z;
    length += Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  return length;
}

export function calculateDelayTime(path: SoundRayPath): number {
  return calculatePathLength(path) / SPEED_OF_SOUND * 1000;
}

export function isChamberInAnyPath(chamberId: string, paths: SoundRayPath[]): boolean {
  return paths.some(p => p.reflectedChambers.includes(chamberId));
}
