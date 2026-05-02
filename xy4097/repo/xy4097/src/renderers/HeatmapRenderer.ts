import * as THREE from 'three';
import { HeatZone, RiskLevel } from '../types';

const RISK_COLORS: Record<RiskLevel, { r: number; g: number; b: number }> = {
  low: { r: 76, g: 175, b: 80 },
  medium: { r: 255, g: 170, b: 0 },
  high: { r: 255, g: 68, b: 68 },
  critical: { r: 255, g: 0, b: 0 },
};

const RISK_OPACITY: Record<RiskLevel, number> = {
  low: 0.2,
  medium: 0.4,
  high: 0.6,
  critical: 0.8,
};

export interface HeatmapMesh {
  group: THREE.Group;
  zoneMeshes: Map<string, THREE.Mesh>;
}

function getDensityColor(density: number, maxDensity: number): THREE.Color {
  const ratio = Math.min(density / maxDensity, 1);
  
  let r: number, g: number, b: number;
  
  if (ratio < 0.25) {
    r = 76 + (139 - 76) * (ratio / 0.25);
    g = 175 + (250 - 175) * (ratio / 0.25);
    b = 80;
  } else if (ratio < 0.5) {
    r = 139 + (255 - 139) * ((ratio - 0.25) / 0.25);
    g = 250 + (170 - 250) * ((ratio - 0.25) / 0.25);
    b = 80;
  } else if (ratio < 0.75) {
    r = 255 + (255 - 255) * ((ratio - 0.5) / 0.25);
    g = 170 + (68 - 170) * ((ratio - 0.5) / 0.25);
    b = 0 + (68 - 0) * ((ratio - 0.5) / 0.25);
  } else {
    r = 255;
    g = 68 + (0 - 68) * ((ratio - 0.75) / 0.25);
    b = 68 + (0 - 68) * ((ratio - 0.75) / 0.25);
  }
  
  return new THREE.Color(r / 255, g / 255, b / 255);
}

function getRiskColor(riskLevel: RiskLevel): THREE.Color {
  const color = RISK_COLORS[riskLevel];
  return new THREE.Color(color.r / 255, color.g / 255, color.b / 255);
}

export function createHeatmap(
  heatZones: HeatZone[],
  gridSize: number,
  maxDensity: number
): HeatmapMesh {
  const group = new THREE.Group();
  group.name = 'heatmap';
  
  const zoneMeshes = new Map<string, THREE.Mesh>();
  
  for (const zone of heatZones) {
    const zoneKey = `${zone.x},${zone.z}`;
    
    if (zone.visitorCount === 0 && zone.riskLevel === 'low') {
      continue;
    }
    
    const geometry = new THREE.PlaneGeometry(gridSize, gridSize);
    
    const color = zone.density > 0 
      ? getDensityColor(zone.density, maxDensity)
      : getRiskColor(zone.riskLevel);
    
    const opacity = RISK_OPACITY[zone.riskLevel];
    
    const material = new THREE.MeshStandardMaterial({
      color: color,
      transparent: true,
      opacity: opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(zone.x, 0.02, zone.z);
    mesh.userData = { zone };
    mesh.renderOrder = 1;
    
    group.add(mesh);
    zoneMeshes.set(zoneKey, mesh);
  }
  
  return {
    group,
    zoneMeshes,
  };
}

export function updateHeatmap(
  heatmapMesh: HeatmapMesh,
  newHeatZones: HeatZone[],
  gridSize: number,
  maxDensity: number
): void {
  for (const mesh of heatmapMesh.zoneMeshes.values()) {
    heatmapMesh.group.remove(mesh);
    mesh.geometry.dispose();
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach(m => m.dispose());
    } else {
      mesh.material.dispose();
    }
  }
  heatmapMesh.zoneMeshes.clear();
  
  for (const zone of newHeatZones) {
    const zoneKey = `${zone.x},${zone.z}`;
    
    if (zone.visitorCount === 0 && zone.riskLevel === 'low') {
      continue;
    }
    
    const geometry = new THREE.PlaneGeometry(gridSize, gridSize);
    
    const color = zone.density > 0 
      ? getDensityColor(zone.density, maxDensity)
      : getRiskColor(zone.riskLevel);
    
    const opacity = RISK_OPACITY[zone.riskLevel];
    
    const material = new THREE.MeshStandardMaterial({
      color: color,
      transparent: true,
      opacity: opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(zone.x, 0.02, zone.z);
    mesh.userData = { zone };
    mesh.renderOrder = 1;
    
    heatmapMesh.group.add(mesh);
    heatmapMesh.zoneMeshes.set(zoneKey, mesh);
  }
}

export function createRiskIndicator(
  position: { x: number; z: number },
  riskLevel: RiskLevel,
  gridSize: number
): THREE.Mesh {
  const color = getRiskColor(riskLevel);
  const opacity = RISK_OPACITY[riskLevel];
  
  const geometry = new THREE.RingGeometry(gridSize * 0.3, gridSize * 0.45, 32);
  const material = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: opacity + 0.2,
    side: THREE.DoubleSide,
  });
  
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(position.x, 0.03, position.z);
  
  return mesh;
}

export function disposeHeatmap(heatmapMesh: HeatmapMesh): void {
  for (const mesh of heatmapMesh.zoneMeshes.values()) {
    heatmapMesh.group.remove(mesh);
    mesh.geometry.dispose();
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach(m => m.dispose());
    } else {
      mesh.material.dispose();
    }
  }
  heatmapMesh.zoneMeshes.clear();
}

export { RISK_COLORS, RISK_OPACITY };
