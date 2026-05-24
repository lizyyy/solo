import { Building, WindowUnit, ShadowRecord, Vector3Tuple } from '../types';
import { calculateSunPosition } from './sunCalculation';

const intersectRayBox = (
  rayOrigin: Vector3Tuple,
  rayDir: Vector3Tuple,
  boxMin: Vector3Tuple,
  boxMax: Vector3Tuple
): number | null => {
  let tMin = -Infinity;
  let tMax = Infinity;

  for (let i = 0; i < 3; i++) {
    if (Math.abs(rayDir[i]) < 0.0001) {
      if (rayOrigin[i] < boxMin[i] || rayOrigin[i] > boxMax[i]) {
        return null;
      }
    } else {
      let t1 = (boxMin[i] - rayOrigin[i]) / rayDir[i];
      let t2 = (boxMax[i] - rayOrigin[i]) / rayDir[i];
      
      if (t1 > t2) [t1, t2] = [t2, t1];
      
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
      
      if (tMin > tMax) return null;
    }
  }

  if (tMax < 0) return null;
  return tMin > 0 ? tMin : tMax;
};

const getBuildingBounds = (building: Building): { min: Vector3Tuple; max: Vector3Tuple } => {
  const { position, dimensions } = building;
  return {
    min: [
      position[0] - dimensions.width / 2,
      position[1],
      position[2] - dimensions.depth / 2,
    ],
    max: [
      position[0] + dimensions.width / 2,
      position[1] + dimensions.height,
      position[2] + dimensions.depth / 2,
    ],
  };
};

export const checkWindowShadowed = (
  window: WindowUnit,
  buildings: Building[],
  sunDir: Vector3Tuple,
  excludeBuildingId?: string
): Building | null => {
  const rayOrigin: Vector3Tuple = [
    window.position[0],
    window.position[1],
    window.position[2],
  ];

  for (const building of buildings) {
    if (building.id === window.buildingId) continue;
    if (excludeBuildingId && building.id === excludeBuildingId) continue;

    const bounds = getBuildingBounds(building);
    const distance = intersectRayBox(rayOrigin, sunDir, bounds.min, bounds.max);

    if (distance !== null && distance > 0.1) {
      return building;
    }
  }

  return null;
};

export const calculateDailyShadowRecords = (
  window: WindowUnit,
  buildings: Building[],
  date: Date,
  timeStep: number = 5
): ShadowRecord[] => {
  const records: ShadowRecord[] = [];
  let currentShadow: { building: Building; startTime: number } | null = null;

  for (let time = 360; time <= 1080; time += timeStep) {
    const sunPos = calculateSunPosition(date, time);
    
    if (sunPos.altitude <= 0) {
      if (currentShadow) {
        records.push({
          windowId: window.id,
          buildingId: currentShadow.building.id,
          buildingName: currentShadow.building.name,
          startTime: currentShadow.startTime,
          endTime: time,
          duration: time - currentShadow.startTime,
        });
        currentShadow = null;
      }
      continue;
    }

    const shadowBuilding = checkWindowShadowed(window, buildings, sunPos.direction);

    if (shadowBuilding) {
      if (!currentShadow) {
        currentShadow = { building: shadowBuilding, startTime: time };
      } else if (currentShadow.building.id !== shadowBuilding.id) {
        records.push({
          windowId: window.id,
          buildingId: currentShadow.building.id,
          buildingName: currentShadow.building.name,
          startTime: currentShadow.startTime,
          endTime: time,
          duration: time - currentShadow.startTime,
        });
        currentShadow = { building: shadowBuilding, startTime: time };
      }
    } else {
      if (currentShadow) {
        records.push({
          windowId: window.id,
          buildingId: currentShadow.building.id,
          buildingName: currentShadow.building.name,
          startTime: currentShadow.startTime,
          endTime: time,
          duration: time - currentShadow.startTime,
        });
        currentShadow = null;
      }
    }
  }

  if (currentShadow) {
    records.push({
      windowId: window.id,
      buildingId: currentShadow.building.id,
      buildingName: currentShadow.building.name,
      startTime: currentShadow.startTime,
      endTime: 1080,
      duration: 1080 - currentShadow.startTime,
    });
  }

  return records;
};

export const calculateTotalShadowDuration = (
  records: ShadowRecord[],
  buildingId?: string
): number => {
  const filtered = buildingId 
    ? records.filter(r => r.buildingId === buildingId)
    : records;
  
  return filtered.reduce((sum, r) => sum + r.duration, 0);
};

export const groupShadowsByBuilding = (records: ShadowRecord[]): Map<string, ShadowRecord[]> => {
  const groups = new Map<string, ShadowRecord[]>();
  
  for (const record of records) {
    if (!groups.has(record.buildingId)) {
      groups.set(record.buildingId, []);
    }
    groups.get(record.buildingId)!.push(record);
  }
  
  return groups;
};
