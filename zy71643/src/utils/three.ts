import * as THREE from 'three';
import type { Point3D, PipelineSegment } from '../types';
import { pipelineColors } from '../data/config';

export function createTubeGeometry(
  start: Point3D,
  end: Point3D,
  radius: number,
  tubularSegments: number = 32,
  radialSegments: number = 8
): THREE.BufferGeometry {
  const startVec = new THREE.Vector3(start.x, start.y, start.z);
  const endVec = new THREE.Vector3(end.x, end.y, end.z);

  const path = new THREE.LineCurve3(startVec, endVec);
  return new THREE.TubeGeometry(path, tubularSegments, radius, radialSegments, false);
}

export function createPipelineMaterial(type: string, transparent: boolean = true): THREE.MeshStandardMaterial {
  const color = pipelineColors[type] || '#888888';
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    metalness: 0.6,
    roughness: 0.3,
    transparent,
    opacity: 0.85,
    emissive: new THREE.Color(color),
    emissiveIntensity: 0.1,
  });
}

export function createCollisionMaterial(severity: string = 'critical'): THREE.MeshStandardMaterial {
  const colors: Record<string, string> = {
    critical: '#e53935',
    warning: '#fb8c00',
    info: '#43a047',
  };
  const color = colors[severity] || colors.critical;
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    emissive: new THREE.Color(color),
    emissiveIntensity: 0.8,
    transparent: true,
    opacity: 0.9,
  });
}

export function createGridHelper(size: number, divisions: number): THREE.GridHelper {
  const grid = new THREE.GridHelper(size, divisions, 0x334155, 0x1e293b);
  grid.position.y = -0.01;
  return grid;
}

export function createAxesHelper(size: number): THREE.AxesHelper {
  return new THREE.AxesHelper(size);
}

export function computeBoundingBox(segments: PipelineSegment[]): {
  min: Point3D;
  max: Point3D;
  center: Point3D;
} {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  segments.forEach((seg) => {
    minX = Math.min(minX, seg.startPoint.x, seg.endPoint.x);
    minY = Math.min(minY, seg.startPoint.y, seg.endPoint.y);
    minZ = Math.min(minZ, seg.startPoint.z, seg.endPoint.z);
    maxX = Math.max(maxX, seg.startPoint.x, seg.endPoint.x);
    maxY = Math.max(maxY, seg.startPoint.y, seg.endPoint.y);
    maxZ = Math.max(maxZ, seg.startPoint.z, seg.endPoint.z);
  });

  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
    center: {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      z: (minZ + maxZ) / 2,
    },
  };
}

export function getCameraFitPosition(
  center: Point3D,
  size: { width: number; height: number; depth: number },
  fov: number = 50
): { position: Point3D; target: Point3D } {
  const maxDim = Math.max(size.width, size.height, size.depth);
  const distance = maxDim / (2 * Math.tan((fov * Math.PI) / 360)) * 1.5;

  return {
    position: {
      x: center.x + distance * 0.7,
      y: center.y + distance * 0.7,
      z: center.z + distance * 0.7,
    },
    target: center,
  };
}
