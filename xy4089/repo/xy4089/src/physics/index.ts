import {
  Truss,
  HoistPoint,
  Equipment,
  Vector3,
  HoistLoadResult,
  CenterOfGravityResult,
  UnbalanceResult,
  ImpactFactorResult,
  ProjectSettings,
} from '../models';
import {
  addVectors,
  multiplyVectorScalar,
  vectorDistance,
  getTrussCenter,
  getTrussWeight,
  vectorsEqual,
} from '../models';

export function calculateCenterOfGravity(
  trusses: Truss[],
  equipment: Equipment[]
): CenterOfGravityResult {
  let totalMass = 0;
  let weightedSum: Vector3 = { x: 0, y: 0, z: 0 };

  trusses.forEach(truss => {
    const mass = getTrussWeight(truss);
    const center = getTrussCenter(truss);
    weightedSum = addVectors(weightedSum, multiplyVectorScalar(center, mass));
    totalMass += mass;
  });

  equipment.forEach(eq => {
    if (eq.weight > 0) {
      weightedSum = addVectors(weightedSum, multiplyVectorScalar(eq.position, eq.weight));
      totalMass += eq.weight;
    }
  });

  let centerPosition: Vector3;
  if (totalMass > 0) {
    centerPosition = multiplyVectorScalar(weightedSum, 1 / totalMass);
  } else {
    centerPosition = { x: 0, y: 0, z: 0 };
  }

  return {
    position: centerPosition,
    totalMass,
    trussCount: trusses.length,
    equipmentCount: equipment.length,
  };
}

export function calculateHoistPointLoads(
  trusses: Truss[],
  hoistPoints: HoistPoint[],
  equipment: Equipment[],
  settings: ProjectSettings
): HoistLoadResult[] {
  const results: HoistLoadResult[] = [];
  
  const groupedHoistPoints: Map<string, HoistPoint[]> = new Map();
  const independentHoistPoints: HoistPoint[] = [];

  hoistPoints.forEach(hp => {
    if (hp.trussId) {
      const existing = groupedHoistPoints.get(hp.trussId) || [];
      existing.push(hp);
      groupedHoistPoints.set(hp.trussId, existing);
    } else {
      independentHoistPoints.push(hp);
    }
  });

  groupedHoistPoints.forEach((trussHoistPoints, trussId) => {
    const truss = trusses.find(t => t.id === trussId);
    if (!truss) return;

    const trussEquipment = equipment.filter(eq => eq.trussId === trussId);
    
    const trussLoads = calculateTrussHoistLoads(
      truss,
      trussHoistPoints,
      trussEquipment,
      settings
    );

    results.push(...trussLoads);
  });

  independentHoistPoints.forEach(hp => {
    const hpEquipment = equipment.filter(eq => 
      vectorsEqual(eq.position, hp.position, 0.5)
    );
    
    const totalStaticLoad = hpEquipment.reduce((sum, eq) => sum + eq.weight, 0);
    const impactFactor = settings.dynamicImpactFactorBase;
    const dynamicLoad = totalStaticLoad * impactFactor;
    const loadRatio = totalStaticLoad / hp.maxLoad;

    results.push({
      hoistPointId: hp.id,
      staticLoad: totalStaticLoad,
      dynamicLoad,
      maxRatedLoad: hp.maxLoad,
      loadRatio,
      isOverloaded: loadRatio > 1,
      isWarning: loadRatio > 0.8 && loadRatio <= 1,
    });
  });

  return results;
}

function calculateTrussHoistLoads(
  truss: Truss,
  hoistPoints: HoistPoint[],
  equipment: Equipment[],
  settings: ProjectSettings
): HoistLoadResult[] {
  const results: HoistLoadResult[] = [];
  
  if (hoistPoints.length === 0) return results;

  const trussMass = getTrussWeight(truss);
  
  if (hoistPoints.length === 1) {
    const hp = hoistPoints[0];
    const totalEquipmentMass = equipment.reduce((sum, eq) => sum + eq.weight, 0);
    const staticLoad = trussMass + totalEquipmentMass;
    const dynamicLoad = staticLoad * settings.dynamicImpactFactorBase;
    const loadRatio = staticLoad / hp.maxLoad;

    results.push({
      hoistPointId: hp.id,
      staticLoad,
      dynamicLoad,
      maxRatedLoad: hp.maxLoad,
      loadRatio,
      isOverloaded: loadRatio > 1,
      isWarning: loadRatio > 0.8 && loadRatio <= 1,
    });
    return results;
  }

  const trussLocalHoistPositions = hoistPoints.map(hp => {
    if (hp.trussLocalPosition) {
      return hp.trussLocalPosition;
    }
    return calculateLocalPosition(truss, hp.position);
  });

  const localXPositions = trussLocalHoistPositions.map(p => p.x);
  const sortedIndices = localXPositions
    .map((_, i) => i)
    .sort((a, b) => localXPositions[a] - localXPositions[b]);

  const leftmostIdx = sortedIndices[0];
  const rightmostIdx = sortedIndices[sortedIndices.length - 1];

  const trussCGLocal = { x: truss.length / 2, y: truss.height / 2, z: 0 };
  
  const allLoads: { localX: number; mass: number }[] = [
    { localX: trussCGLocal.x, mass: trussMass },
  ];

  equipment.forEach(eq => {
    const localPos = eq.trussLocalPosition || calculateLocalPosition(truss, eq.position);
    allLoads.push({ localX: localPos.x, mass: eq.weight });
  });

  const leftHP = hoistPoints[leftmostIdx];
  const rightHP = hoistPoints[rightmostIdx];
  const leftX = localXPositions[leftmostIdx];
  const rightX = localXPositions[rightmostIdx];
  const span = rightX - leftX;

  let leftLoad = 0;
  let rightLoad = 0;

  if (span > 0) {
    allLoads.forEach(load => {
      if (load.localX <= leftX) {
        leftLoad += load.mass;
      } else if (load.localX >= rightX) {
        rightLoad += load.mass;
      } else {
        const distFromLeft = load.localX - leftX;
        const ratio = distFromLeft / span;
        leftLoad += load.mass * (1 - ratio);
        rightLoad += load.mass * ratio;
      }
    });
  } else {
    const totalMass = allLoads.reduce((sum, l) => sum + l.mass, 0);
    leftLoad = totalMass / hoistPoints.length;
    rightLoad = totalMass / hoistPoints.length;
  }

  const baseLoads: Map<string, number> = new Map();
  
  if (hoistPoints.length === 2) {
    baseLoads.set(leftHP.id, leftLoad);
    baseLoads.set(rightHP.id, rightLoad);
  } else {
    const totalMass = allLoads.reduce((sum, l) => sum + l.mass, 0);
    const middleHoistPoints = sortedIndices.slice(1, -1);
    const middleCount = middleHoistPoints.length;
    
    if (middleCount > 0) {
      const middleLoadPerPoint = totalMass / hoistPoints.length;
      sortedIndices.forEach(idx => {
        baseLoads.set(hoistPoints[idx].id, middleLoadPerPoint);
      });
    } else {
      sortedIndices.forEach(idx => {
        baseLoads.set(hoistPoints[idx].id, totalMass / hoistPoints.length);
      });
    }
  }

  hoistPoints.forEach(hp => {
    const staticLoad = baseLoads.get(hp.id) || 0;
    const dynamicLoad = staticLoad * settings.dynamicImpactFactorBase;
    const loadRatio = staticLoad / hp.maxLoad;

    results.push({
      hoistPointId: hp.id,
      staticLoad,
      dynamicLoad,
      maxRatedLoad: hp.maxLoad,
      loadRatio,
      isOverloaded: loadRatio > 1,
      isWarning: loadRatio > 0.8 && loadRatio <= 1,
    });
  });

  return results;
}

function calculateLocalPosition(truss: Truss, worldPosition: Vector3): Vector3 {
  return {
    x: worldPosition.x - truss.position.x + truss.length / 2,
    y: worldPosition.y - truss.position.y + truss.height / 2,
    z: worldPosition.z - truss.position.z,
  };
}

export function calculateUnbalance(
  trusses: Truss[],
  hoistPoints: HoistPoint[],
  equipment: Equipment[],
  settings: ProjectSettings
): UnbalanceResult {
  const cog = calculateCenterOfGravity(trusses, equipment);
  
  if (hoistPoints.length === 0) {
    return {
      xRatio: 0,
      zRatio: 0,
      maxRatio: 0,
      isUnbalanced: false,
      centerPosition: cog.position,
      idealCenter: { x: 0, y: 0, z: 0 },
    };
  }

  const hoistPositions = hoistPoints.map(hp => hp.position);
  
  const minX = Math.min(...hoistPositions.map(p => p.x));
  const maxX = Math.max(...hoistPositions.map(p => p.x));
  const minZ = Math.min(...hoistPositions.map(p => p.z));
  const maxZ = Math.max(...hoistPositions.map(p => p.z));

  const idealCenter: Vector3 = {
    x: (minX + maxX) / 2,
    y: (Math.min(...hoistPositions.map(p => p.y)) + Math.max(...hoistPositions.map(p => p.y))) / 2,
    z: (minZ + maxZ) / 2,
  };

  const spanX = maxX - minX;
  const spanZ = maxZ - minZ;

  const offsetX = cog.position.x - idealCenter.x;
  const offsetZ = cog.position.z - idealCenter.z;

  let xRatio = 0;
  let zRatio = 0;

  if (spanX > 0) {
    xRatio = Math.abs(offsetX) / (spanX / 2);
  }
  if (spanZ > 0) {
    zRatio = Math.abs(offsetZ) / (spanZ / 2);
  }

  const maxRatio = Math.max(xRatio, zRatio);
  const isUnbalanced = maxRatio > settings.maxUnbalanceRatio;

  return {
    xRatio,
    zRatio,
    maxRatio,
    isUnbalanced,
    centerPosition: cog.position,
    idealCenter,
  };
}

export function calculateImpactFactor(
  settings: ProjectSettings,
  speed: number = 0,
  acceleration: number = 0
): ImpactFactorResult {
  const baseFactor = settings.dynamicImpactFactorBase;
  
  const speedFactor = 1 + (speed * 0.1);
  const accelerationFactor = 1 + (acceleration * 0.05);
  
  const totalFactor = baseFactor * Math.sqrt(speedFactor * accelerationFactor);

  return {
    baseFactor,
    speedFactor,
    accelerationFactor,
    totalFactor,
    speed,
    acceleration,
  };
}

export function calculateMinimumClearance(
  equipment: Equipment,
  boundaries: { name: string; type: string; vertices: Vector3[] }[]
): number {
  let minDistance = Infinity;
  const eqBox = getEquipmentAABB(equipment);

  boundaries.forEach(boundary => {
    if (boundary.vertices.length >= 3) {
      const dist = distanceFromAABBToPolygon(eqBox, boundary.vertices);
      minDistance = Math.min(minDistance, dist);
    }
  });

  return minDistance;
}

interface AABB {
  min: Vector3;
  max: Vector3;
}

function getEquipmentAABB(equipment: Equipment): AABB {
  const halfX = equipment.dimensions.x / 2;
  const halfY = equipment.dimensions.y / 2;
  const halfZ = equipment.dimensions.z / 2;
  
  return {
    min: {
      x: equipment.position.x - halfX,
      y: equipment.position.y - halfY,
      z: equipment.position.z - halfZ,
    },
    max: {
      x: equipment.position.x + halfX,
      y: equipment.position.y + halfY,
      z: equipment.position.z + halfZ,
    },
  };
}

function distanceFromAABBToPolygon(aabb: AABB, vertices: Vector3[]): number {
  let minDist = Infinity;
  
  const aabbCenter: Vector3 = {
    x: (aabb.min.x + aabb.max.x) / 2,
    y: (aabb.min.y + aabb.max.y) / 2,
    z: (aabb.min.z + aabb.max.z) / 2,
  };
  
  const aabbRadius = Math.max(
    (aabb.max.x - aabb.min.x) / 2,
    (aabb.max.y - aabb.min.y) / 2,
    (aabb.max.z - aabb.min.z) / 2
  );

  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const v1 = vertices[i];
    const v2 = vertices[(i + 1) % n];
    
    const edgeDist = distanceFromPointToSegment(aabbCenter, v1, v2);
    minDist = Math.min(minDist, edgeDist - aabbRadius);
    
    minDist = Math.min(minDist, vectorDistance(aabbCenter, v1) - aabbRadius);
  }

  return Math.max(0, minDist);
}

function distanceFromPointToSegment(point: Vector3, v1: Vector3, v2: Vector3): number {
  const v2v1 = subtractVectors(v2, v1);
  const pv1 = subtractVectors(point, v1);
  
  const dot = pv1.x * v2v1.x + pv1.y * v2v1.y + pv1.z * v2v1.z;
  
  if (dot <= 0) {
    return vectorDistance(point, v1);
  }
  
  const lenSq = v2v1.x * v2v1.x + v2v1.y * v2v1.y + v2v1.z * v2v1.z;
  
  if (dot >= lenSq) {
    return vectorDistance(point, v2);
  }
  
  const t = dot / lenSq;
  const closestPoint = addVectors(v1, multiplyVectorScalar(v2v1, t));
  
  return vectorDistance(point, closestPoint);
}

export function estimateMaxLoadCapacity(
  hoistPoints: HoistPoint[],
  settings: ProjectSettings
): {
  totalStaticCapacity: number;
  totalDynamicCapacity: number;
  perHoistCapacity: { id: string; static: number; dynamic: number }[];
} {
  const totalStaticCapacity = hoistPoints.reduce((sum, hp) => sum + hp.maxLoad, 0);
  const totalDynamicCapacity = totalStaticCapacity / settings.dynamicImpactFactorBase;
  
  const perHoistCapacity = hoistPoints.map(hp => ({
    id: hp.id,
    static: hp.maxLoad,
    dynamic: hp.maxLoad / settings.dynamicImpactFactorBase,
  }));

  return {
    totalStaticCapacity,
    totalDynamicCapacity,
    perHoistCapacity,
  };
}
