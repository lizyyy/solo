import { PathPoint, VehicleParams, Vector3, SweepArea } from '../types';

function cubicBezier(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const mt = 1 - t;
  return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
}

function cubicBezierDerivative(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const mt = 1 - t;
  return 3 * mt * mt * (p1 - p0) + 6 * mt * t * (p2 - p1) + 3 * t * t * (p3 - p2);
}

export function calculateReversingPath(
  vehicle: VehicleParams,
  startPosition: Vector3,
  endPosition: Vector3,
  startHeading: number = 0,
  endHeading: number = Math.PI,
  numPoints: number = 100
): PathPoint[] {
  const path: PathPoint[] = [];
  const { turningRadius, length } = vehicle;

  const dx = endPosition.x - startPosition.x;
  const dz = endPosition.z - startPosition.z;
  const distance = Math.sqrt(dx * dx + dz * dz);

  const curveScale = Math.min(turningRadius * 0.8, distance * 0.4);
  const startOffsetX = Math.sin(startHeading) * curveScale;
  const startOffsetZ = Math.cos(startHeading) * curveScale;
  const endOffsetX = Math.sin(endHeading) * curveScale;
  const endOffsetZ = Math.cos(endHeading) * curveScale;

  const cp0x = startPosition.x;
  const cp0z = startPosition.z;
  const cp1x = startPosition.x + startOffsetX;
  const cp1z = startPosition.z + startOffsetZ;
  const cp2x = endPosition.x - endOffsetX;
  const cp2z = endPosition.z - endOffsetZ;
  const cp3x = endPosition.x;
  const cp3z = endPosition.z;

  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const x = cubicBezier(t, cp0x, cp1x, cp2x, cp3x);
    const z = cubicBezier(t, cp0z, cp1z, cp2z, cp3z);

    const dx_dt = cubicBezierDerivative(t, cp0x, cp1x, cp2x, cp3x);
    const dz_dt = cubicBezierDerivative(t, cp0z, cp1z, cp2z, cp3z);

    const heading = Math.atan2(dx_dt, dz_dt);

    path.push({
      position: { x, y: vehicle.height / 2, z },
      rotation: heading,
      timestamp: t,
    });
  }

  return path;
}

export function calculateVehicleCorners(
  position: Vector3,
  rotation: number,
  vehicle: VehicleParams
): Vector3[] {
  const { length, width, frontOverhang, rearOverhang } = vehicle;

  const halfWidth = width / 2;
  const rearZ = -length / 2 + rearOverhang;
  const frontZ = length / 2 - frontOverhang;

  const corners = [
    { x: -halfWidth, y: 0, z: rearZ },
    { x: halfWidth, y: 0, z: rearZ },
    { x: halfWidth, y: 0, z: frontZ },
    { x: -halfWidth, y: 0, z: frontZ },
  ];

  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  return corners.map((corner) => ({
    x: position.x + corner.x * cos - corner.z * sin,
    y: position.y + corner.y,
    z: position.z + corner.x * sin + corner.z * cos,
  }));
}

export function calculateSweepArea(
  path: PathPoint[],
  vehicle: VehicleParams,
  step: number = 5
): SweepArea[] {
  const sweepAreas: SweepArea[] = [];

  for (let i = 0; i < path.length; i += step) {
    const point = path[i];
    const corners = calculateVehicleCorners(point.position, point.rotation, vehicle);
    sweepAreas.push({
      points: corners,
      timestamp: point.timestamp,
    });
  }

  return sweepAreas;
}

export function calculatePathLength(path: PathPoint[]): number {
  let length = 0;
  for (let i = 1; i < path.length; i++) {
    const dx = path[i].position.x - path[i - 1].position.x;
    const dz = path[i].position.z - path[i - 1].position.z;
    length += Math.sqrt(dx * dx + dz * dz);
  }
  return length;
}

export function generateDefaultPath(
  vehicle: VehicleParams,
  targetDockIndex: number = 0,
  dockCount: number = 1
): PathPoint[] {
  const spacing = 8;
  const offsetX = (targetDockIndex - (dockCount - 1) / 2) * spacing;

  const startPosition: Vector3 = { x: 15 + offsetX, y: vehicle.height / 2, z: 12 };
  const endPosition: Vector3 = { x: offsetX, y: vehicle.height / 2, z: -14 };

  return calculateReversingPath(
    vehicle,
    startPosition,
    endPosition,
    Math.PI * 0.1,
    Math.PI
  );
}
