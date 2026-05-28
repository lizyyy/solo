import * as THREE from 'three';
import { FlightData, Route, Aircraft, CarbonHeightPoint } from '../types';
import { useAppStore } from '../store/appStore';

export function getCarbonColor(emission: number, maxEmission: number): string {
  const ratio = Math.min(emission / maxEmission, 1);
  if (ratio < 0.33) {
    const t = ratio / 0.33;
    const r = Math.round(16 + t * (245 - 16));
    const g = Math.round(185 + t * (158 - 185));
    const b = Math.round(129 + t * (11 - 129));
    return `rgb(${r}, ${g}, ${b})`;
  } else if (ratio < 0.66) {
    const t = (ratio - 0.33) / 0.33;
    const r = Math.round(245 + t * (239 - 245));
    const g = Math.round(158 + t * (68 - 158));
    const b = Math.round(11 + t * (68 - 11));
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    const t = (ratio - 0.66) / 0.34;
    const r = 239;
    const g = Math.round(68 * (1 - t));
    const b = Math.round(68 * (1 - t));
    return `rgb(${r}, ${g}, ${b})`;
  }
}

export function getStatusColor(status: 'confirmed' | 'tentative', baseColor: string): string {
  if (status === 'tentative') {
    return `rgba(168, 85, 247, 0.7)`;
  }
  return baseColor;
}

export function getAnomalyColor(anomalies: string[]): string | null {
  if (anomalies.includes('missing_load_factor')) return '#f59e0b';
  if (anomalies.includes('aircraft_mapping_error')) return '#ef4444';
  if (anomalies.includes('extreme_route_occlusion')) return '#8b5cf6';
  return null;
}

export function convertToHeightPoints(
  flightData: FlightData[],
  routes: Route[],
  aircraft: Aircraft[],
  gridSize: number = 12
): CarbonHeightPoint[] {
  const points: CarbonHeightPoint[] = [];
  const routeMap = new Map(routes.map(r => [r.id, r]));
  const aircraftMap = new Map(aircraft.map(a => [a.id, a]));
  
  const maxEmission = Math.max(...flightData.map(f => f.carbonEmission), 1);
  const routeIds = [...new Set(flightData.map(f => f.routeId))];
  const aircraftIds = [...new Set(flightData.map(f => f.aircraftId))];
  
  const maxHeight = 15;
  
  const avgEmissions = new Map<string, number>();
  const flightCounts = new Map<string, number>();
  const flightMap = new Map<string, FlightData>();
  
  flightData.forEach(f => {
    const key = `${f.routeId}-${f.aircraftId}`;
    const current = avgEmissions.get(key) || 0;
    const count = flightCounts.get(key) || 0;
    avgEmissions.set(key, current + f.carbonEmission);
    flightCounts.set(key, count + 1);
    
    if (!flightMap.has(key) || f.carbonEmission > (flightMap.get(key)?.carbonEmission || 0)) {
      flightMap.set(key, f);
    }
  });
  
  routeIds.forEach((routeId, routeIdx) => {
    aircraftIds.forEach((aircraftId, aircraftIdx) => {
      const key = `${routeId}-${aircraftId}`;
      const totalEmission = avgEmissions.get(key);
      if (!totalEmission) return;
      
      const count = flightCounts.get(key) || 1;
      const avgEmission = totalEmission / count;
      const flight = flightMap.get(key);
      const route = routeMap.get(routeId);
      const ac = aircraftMap.get(aircraftId);
      
      if (!flight || !route || !ac) return;
      
      const x = (routeIdx - routeIds.length / 2) * gridSize;
      const z = (aircraftIdx - aircraftIds.length / 2) * gridSize;
      const height = Math.max(0.5, (avgEmission / maxEmission) * maxHeight);
      const baseColor = getCarbonColor(avgEmission, maxEmission);
      const color = getStatusColor(flight.status, baseColor);
      
      points.push({
        x,
        z,
        height,
        color,
        flightData: flight,
        route,
        aircraft: ac,
      });
    });
  });
  
  return points;
}

export function useHeightPoints() {
  const getFilteredData = useAppStore(state => state.getFilteredData);
  const routes = useAppStore(state => state.routes);
  const aircraft = useAppStore(state => state.aircraft);
  
  const filteredData = getFilteredData();
  return convertToHeightPoints(filteredData, routes, aircraft);
}

export function createBarGeometry(width: number, depth: number, height: number): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  geometry.translate(0, height / 2, 0);
  return geometry;
}

export function createBarMaterial(color: string, isSelected: boolean, isHovered: boolean): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    metalness: 0.3,
    roughness: 0.4,
    emissive: isSelected ? new THREE.Color(0x4488ff) : isHovered ? new THREE.Color(0x333366) : new THREE.Color(0x000000),
    emissiveIntensity: isSelected ? 0.5 : isHovered ? 0.2 : 0,
    transparent: true,
    opacity: 1,
  });
}
