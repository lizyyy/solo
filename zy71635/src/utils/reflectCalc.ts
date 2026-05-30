import * as THREE from 'three';
import type { Hall, ReflectSurface, SeatZone, SoundSource, ReflectPath } from './types';

export function computeReflectPath(
  source: SoundSource,
  surface: ReflectSurface,
  zone: SeatZone,
  _hall: Hall
): ReflectPath {
  const sourcePos = new THREE.Vector3(...source.position);
  const surfacePos = new THREE.Vector3(...surface.position);

  const rad = (surface.angle * Math.PI) / 180;
  const normal = new THREE.Vector3(
    -Math.sin(rad),
    Math.cos(rad),
    0
  ).normalize();

  const surfaceCenter = surfacePos.clone();
  const incidentDir = surfaceCenter.clone().sub(sourcePos).normalize();
  const reflectedDir = incidentDir.clone().reflect(normal);

  const reflectPoint = surfaceCenter.clone();
  const ray = new THREE.Ray(reflectPoint, reflectedDir);
  const zoneCenter = new THREE.Vector3(
    (zone.bounds.min[0] + zone.bounds.max[0]) / 2,
    zone.bounds.min[1],
    (zone.bounds.min[2] + zone.bounds.max[2]) / 2
  );

  const targetDir = zoneCenter.clone().sub(reflectPoint).normalize();
  const blendedDir = reflectedDir.clone().lerp(targetDir, 0.3).normalize();
  const distToZone = reflectPoint.distanceTo(zoneCenter);
  const endPoint = reflectPoint.clone().add(blendedDir.multiplyScalar(distToZone));

  return {
    id: `path-${source.id}-${surface.id}-${zone.id}`,
    sourceId: source.id,
    surfaceId: surface.id,
    zoneId: zone.id,
    pathPoints: [
      source.position,
      [reflectPoint.x, reflectPoint.y, reflectPoint.z] as [number, number, number],
      [endPoint.x, endPoint.y, endPoint.z] as [number, number, number],
    ],
  };
}

export function computeAllPaths(
  sources: SoundSource[],
  surfaces: ReflectSurface[],
  zones: SeatZone[],
  hall: Hall
): ReflectPath[] {
  const paths: ReflectPath[] = [];
  for (const source of sources) {
    for (const surface of surfaces) {
      for (const zone of zones) {
        paths.push(computeReflectPath(source, surface, zone, hall));
      }
    }
  }
  return paths;
}

export function isSurfaceThroughWall(
  surface: ReflectSurface,
  hall: Hall
): { through: boolean; details: string } {
  const rad = (surface.angle * Math.PI) / 180;
  const halfW = surface.size[0] / 2;
  const halfH = surface.size[1] / 2;

  const corners: [number, number, number][] = [
    [surface.position[0] - halfW, surface.position[1] - halfH, surface.position[2]],
    [surface.position[0] + halfW, surface.position[1] - halfH, surface.position[2]],
    [surface.position[0] - halfW, surface.position[1] + halfH, surface.position[2]],
    [surface.position[0] + halfW, surface.position[1] + halfH, surface.position[2]],
  ];

  const rotated = corners.map((c) => {
    const dx = c[0] - surface.position[0];
    const dy = c[1] - surface.position[1];
    return [
      surface.position[0] + dx * Math.cos(rad) - dy * Math.sin(rad),
      surface.position[1] + dx * Math.sin(rad) + dy * Math.cos(rad),
      c[2],
    ] as [number, number, number];
  });

  const [minX, maxX, minY, maxY, minZ, maxZ] = hall.wallBounds;
  for (const p of rotated) {
    if (p[0] < minX || p[0] > maxX || p[1] < minY || p[1] > maxY || p[2] < minZ || p[2] > maxZ) {
      const violationAxis = p[0] < minX || p[0] > maxX ? 'X' : p[2] < minZ || p[2] > maxZ ? 'Z' : 'Y';
      return {
        through: true,
        details: `${surface.name}在角度${surface.angle}°时，顶点(${p[0].toFixed(1)}, ${p[1].toFixed(1)}, ${p[2].toFixed(1)})超出厅堂${violationAxis}轴边界`,
      };
    }
  }
  return { through: false, details: '' };
}
