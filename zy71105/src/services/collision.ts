import * as THREE from 'three';
import { Light, ForbiddenZone, CollisionWarning, Vector3 } from '../types';

function createBox3FromBounds(bounds: { min: Vector3; max: Vector3 }): THREE.Box3 {
  return new THREE.Box3(
    new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.min.z),
    new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.max.z)
  );
}

function getBeamPoints(light: Light): THREE.Vector3[] {
  const pos = new THREE.Vector3(light.position.x, light.position.y, light.position.z);
  const target = new THREE.Vector3(light.target.x, light.target.y, light.target.z);
  const direction = target.clone().sub(pos).normalize();
  
  const beamLength = 20;
  const endPos = pos.clone().add(direction.multiplyScalar(beamLength));
  
  const points: THREE.Vector3[] = [];
  const steps = 10;
  
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    points.push(pos.clone().lerp(endPos, t));
  }
  
  return points;
}

export function checkLightCollision(
  light: Light,
  zones: ForbiddenZone[],
  currentTime: number
): CollisionWarning | null {
  if (!light.enabled || light.intensity <= 0) {
    return null;
  }

  const beamPoints = getBeamPoints(light);
  
  for (const zone of zones) {
    const box = createBox3FromBounds(zone.bounds);
    
    for (const point of beamPoints) {
      if (box.containsPoint(point)) {
        return {
          id: `collision-${light.id}-${zone.id}-${Date.now()}`,
          lightId: light.id,
          lightName: light.name,
          zoneId: zone.id,
          zoneName: zone.name,
          zoneType: zone.type,
          severity: zone.type === 'subtitle' ? 'danger' : 'warning',
          timestamp: currentTime,
          message: `${light.name} 的光束进入了 ${zone.name}`
        };
      }
    }
  }
  
  return null;
}

export function checkAllCollisions(
  lights: Light[],
  zones: ForbiddenZone[],
  currentTime: number
): CollisionWarning[] {
  const warnings: CollisionWarning[] = [];
  
  for (const light of lights) {
    const warning = checkLightCollision(light, zones, currentTime);
    if (warning) {
      warnings.push(warning);
    }
  }
  
  return warnings;
}

export function isLightInCollision(lightId: string, warnings: CollisionWarning[]): boolean {
  return warnings.some(w => w.lightId === lightId);
}

export function getLightCollisions(lightId: string, warnings: CollisionWarning[]): CollisionWarning[] {
  return warnings.filter(w => w.lightId === lightId);
}
