import { useMemo } from 'react';
import type { LightSource, Wall, Point3D, IlluminationSample } from '@/types';

function degToRad(deg: number): number {
  return deg * (Math.PI / 180);
}

function calculateDistance(a: Point3D, b: Point3D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function calculateIncidentAngle(
  lightDir: { x: number; y: number; z: number },
  lightPos: Point3D,
  targetPos: Point3D
): number {
  const toTarget = {
    x: targetPos.x - lightPos.x,
    y: targetPos.y - lightPos.y,
    z: targetPos.z - lightPos.z
  };
  
  const lenToTarget = Math.sqrt(
    toTarget.x * toTarget.x + toTarget.y * toTarget.y + toTarget.z * toTarget.z
  );
  
  if (lenToTarget === 0) return 0;
  
  const normalizedToTarget = {
    x: toTarget.x / lenToTarget,
    y: toTarget.y / lenToTarget,
    z: toTarget.z / lenToTarget
  };
  
  const lenLightDir = Math.sqrt(
    lightDir.x * lightDir.x + lightDir.y * lightDir.y + lightDir.z * lightDir.z
  );
  
  const normalizedLightDir = {
    x: lightDir.x / lenLightDir,
    y: lightDir.y / lenLightDir,
    z: lightDir.z / lenLightDir
  };
  
  const dot = 
    normalizedLightDir.x * normalizedToTarget.x +
    normalizedLightDir.y * normalizedToTarget.y +
    normalizedLightDir.z * normalizedToTarget.z;
  
  return Math.acos(Math.max(0, Math.min(1, dot)));
}

function calculateBeamAttenuation(beamAngle: number, incidentAngle: number): number {
  const beamHalfAngle = degToRad(beamAngle) / 2;
  if (incidentAngle > beamHalfAngle) return 0;
  
  const ratio = incidentAngle / beamHalfAngle;
  return Math.pow(1 - ratio * ratio, 2);
}

function lineLineIntersection3D(
  p1: Point3D, p2: Point3D,
  p3: Point3D, p4: Point3D
): boolean {
  const d1 = { x: p2.x - p1.x, y: p2.y - p1.y, z: p2.z - p1.z };
  const d2 = { x: p4.x - p3.x, y: p4.y - p3.y, z: p4.z - p3.z };
  const d3 = { x: p3.x - p1.x, y: p3.y - p1.y, z: p3.z - p1.z };
  
  const cross12 = {
    x: d1.y * d2.z - d1.z * d2.y,
    y: d1.z * d2.x - d1.x * d2.z,
    z: d1.x * d2.y - d1.y * d2.x
  };
  
  const cross13 = {
    x: d1.y * d3.z - d1.z * d3.y,
    y: d1.z * d3.x - d1.x * d3.z,
    z: d1.x * d3.y - d1.y * d3.x
  };
  
  const dot = cross12.x * cross13.x + cross12.y * cross13.y + cross12.z * cross13.z;
  if (Math.abs(dot) > 0.0001) return false;
  
  const dot12 = d1.x * d2.x + d1.y * d2.y + d1.z * d2.z;
  const dot11 = d1.x * d1.x + d1.y * d1.y + d1.z * d1.z;
  const dot22 = d2.x * d2.x + d2.y * d2.y + d2.z * d2.z;
  const dot13 = d1.x * d3.x + d1.y * d3.y + d1.z * d3.z;
  const dot23 = d2.x * d3.x + d2.y * d3.y + d2.z * d3.z;
  
  const denom = dot11 * dot22 - dot12 * dot12;
  if (Math.abs(denom) < 0.0001) return false;
  
  const t = (dot13 * dot22 - dot23 * dot12) / denom;
  const s = (dot13 * dot12 - dot23 * dot11) / denom;
  
  return t >= 0 && t <= 1 && s >= 0 && s <= 1;
}

function checkRayIntersection(
  rayStart: Point3D,
  rayEnd: Point3D,
  walls: Wall[]
): boolean {
  for (const wall of walls) {
    const wallTop = {
      start: { ...wall.start, y: wall.height },
      end: { ...wall.end, y: wall.height }
    };
    
    const wallEdges = [
      [wall.start, wall.end],
      [wall.start, wallTop.start],
      [wall.end, wallTop.end],
      [wallTop.start, wallTop.end]
    ];
    
    for (const [edgeStart, edgeEnd] of wallEdges) {
      if (lineLineIntersection3D(rayStart, rayEnd, edgeStart, edgeEnd)) {
        return true;
      }
    }
  }
  return false;
}

export function calculateSingleIllumination(
  lightSource: LightSource,
  point: Point3D,
  walls: Wall[]
): number {
  const lightPos: Point3D = {
    x: lightSource.posX,
    y: lightSource.posY,
    z: lightSource.posZ
  };
  
  if (checkRayIntersection(lightPos, point, walls)) {
    return 0;
  }
  
  const distance = calculateDistance(lightPos, point);
  if (distance < 0.1) return lightSource.intensity;
  
  const lightDir = {
    x: Math.sin(degToRad(lightSource.angleY)) * Math.cos(degToRad(lightSource.angleX)),
    y: Math.sin(degToRad(lightSource.angleX)),
    z: Math.cos(degToRad(lightSource.angleY)) * Math.cos(degToRad(lightSource.angleX))
  };
  
  const incidentAngle = calculateIncidentAngle(lightDir, lightPos, point);
  const beamAttenuation = calculateBeamAttenuation(lightSource.beamAngle, incidentAngle);
  
  if (beamAttenuation === 0) return 0;
  
  const baseIntensity = lightSource.intensity / (distance * distance);
  
  return baseIntensity * Math.cos(incidentAngle) * beamAttenuation;
}

export function calculateTotalIllumination(
  lightSources: LightSource[],
  point: Point3D,
  walls: Wall[]
): number {
  return lightSources.reduce((total, light) => {
    return total + calculateSingleIllumination(light, point, walls);
  }, 0);
}

export function generateIlluminationGrid(
  lightSources: LightSource[],
  walls: Wall[],
  galleryWidth: number,
  galleryDepth: number,
  gridSize: number = 1,
  height: number = 1.5
): IlluminationSample[] {
  const samples: IlluminationSample[] = [];
  
  for (let x = -galleryWidth / 2; x <= galleryWidth / 2; x += gridSize) {
    for (let z = -galleryDepth / 2; z <= galleryDepth / 2; z += gridSize) {
      const point: Point3D = { x, y: height, z };
      const value = calculateTotalIllumination(lightSources, point, walls);
      samples.push({ position: point, value });
    }
  }
  
  return samples;
}

export function checkLightPenetration(
  lightSource: LightSource,
  walls: Wall[],
  galleryWidth: number,
  galleryDepth: number
): { hasPenetration: boolean; wallId?: string; penetrationPoint?: Point3D } {
  const lightPos: Point3D = {
    x: lightSource.posX,
    y: lightSource.posY,
    z: lightSource.posZ
  };
  
  const lightDir = {
    x: Math.sin(degToRad(lightSource.angleY)) * Math.cos(degToRad(lightSource.angleX)),
    y: Math.sin(degToRad(lightSource.angleX)),
    z: Math.cos(degToRad(lightSource.angleY)) * Math.cos(degToRad(lightSource.angleX))
  };
  
  const maxDistance = Math.max(galleryWidth, galleryDepth) * 2;
  const rayEnd: Point3D = {
    x: lightPos.x + lightDir.x * maxDistance,
    y: lightPos.y + lightDir.y * maxDistance,
    z: lightPos.z + lightDir.z * maxDistance
  };
  
  for (const wall of walls) {
    if (wall.opacity >= 1) continue;
    
    const wallTop = {
      start: { ...wall.start, y: wall.height },
      end: { ...wall.end, y: wall.height }
    };
    
    const wallEdges = [
      [wall.start, wall.end],
      [wall.start, wallTop.start],
      [wall.end, wallTop.end],
      [wallTop.start, wallTop.end]
    ];
    
    for (const [edgeStart, edgeEnd] of wallEdges) {
      if (lineLineIntersection3D(lightPos, rayEnd, edgeStart, edgeEnd)) {
        const penetrationPoint: Point3D = {
          x: (edgeStart.x + edgeEnd.x) / 2,
          y: (edgeStart.y + edgeEnd.y) / 2,
          z: (edgeStart.z + edgeEnd.z) / 2
        };
        return { hasPenetration: true, wallId: wall.id, penetrationPoint };
      }
    }
  }
  
  return { hasPenetration: false };
}

export function useLightCalculation(
  lightSources: LightSource[],
  walls: Wall[],
  galleryWidth: number,
  galleryDepth: number
) {
  const illuminationGrid = useMemo(() => {
    return generateIlluminationGrid(lightSources, walls, galleryWidth, galleryDepth);
  }, [lightSources, walls, galleryWidth, galleryDepth]);
  
  const maxIllumination = useMemo(() => {
    return Math.max(...illuminationGrid.map(s => s.value), 1);
  }, [illuminationGrid]);
  
  const getIlluminationAt = (point: Point3D) => {
    return calculateTotalIllumination(lightSources, point, walls);
  };
  
  const getNormalizedIllumination = (value: number) => {
    return Math.min(1, value / maxIllumination);
  };
  
  const getHeatmapColor = (value: number): [number, number, number] => {
    const normalized = getNormalizedIllumination(value);
    
    if (normalized < 0.25) {
      const t = normalized / 0.25;
      return [0, 0, Math.round(128 + t * 127)];
    } else if (normalized < 0.5) {
      const t = (normalized - 0.25) / 0.25;
      return [0, Math.round(t * 255), 255];
    } else if (normalized < 0.75) {
      const t = (normalized - 0.5) / 0.25;
      return [Math.round(t * 255), 255, Math.round(255 * (1 - t))];
    } else {
      const t = (normalized - 0.75) / 0.25;
      return [255, Math.round(255 * (1 - t)), 0];
    }
  };
  
  return {
    illuminationGrid,
    maxIllumination,
    getIlluminationAt,
    getNormalizedIllumination,
    getHeatmapColor
  };
}
