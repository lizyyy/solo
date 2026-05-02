import { v4 as uuidv4 } from 'uuid';
import {
  Project,
  ValidationResult,
  CollisionResult,
  Vector3,
  Truss,
  Equipment,
  StageBoundary,
} from '../models';
import {
  calculateHoistPointLoads,
  calculateCenterOfGravity,
  calculateUnbalance,
} from '../physics';
import {
  addVectors,
  multiplyVectorScalar,
  subtractVectors,
  vectorDistance,
} from '../models';

export function validateProject(project: Project): ValidationResult {
  const timestamp = Date.now();

  const hoistLoads = calculateHoistPointLoads(
    project.trusses,
    project.hoistPoints,
    project.equipment,
    project.settings
  );

  const centerOfGravity = calculateCenterOfGravity(
    project.trusses,
    project.equipment
  );

  const unbalance = calculateUnbalance(
    project.trusses,
    project.hoistPoints,
    project.equipment,
    project.settings
  );

  const collisions = detectAllCollisions(
    project.trusses,
    project.equipment,
    project.boundaries
  );

  const hasOverloadErrors = hoistLoads.some(h => h.isOverloaded);
  const hasCollisionErrors = collisions.some(c => c.isColliding);
  const hasUnbalanceError = unbalance.isUnbalanced;
  const hasErrors = hasOverloadErrors || hasCollisionErrors || hasUnbalanceError;

  const hasOverloadWarnings = hoistLoads.some(h => h.isWarning && !h.isOverloaded);
  const hasCollisionWarnings = collisions.some(c => c.isNear && !c.isColliding);
  const hasWarnings = hasOverloadWarnings || hasCollisionWarnings;

  const isSafe = !hasErrors;

  return {
    timestamp,
    hoistLoads,
    centerOfGravity,
    unbalance,
    collisions,
    hasErrors,
    hasWarnings,
    isSafe,
  };
}

export function detectAllCollisions(
  trusses: Truss[],
  equipment: Equipment[],
  boundaries: StageBoundary[]
): CollisionResult[] {
  const results: CollisionResult[] = [];

  equipment.forEach(eq => {
    boundaries.forEach(boundary => {
      const collision = checkEquipmentBoundaryCollision(eq, boundary);
      if (collision) {
        results.push(collision);
      }
    });
  });

  for (let i = 0; i < equipment.length; i++) {
    for (let j = i + 1; j < equipment.length; j++) {
      const collision = checkEquipmentEquipmentCollision(equipment[i], equipment[j]);
      if (collision) {
        results.push(collision);
      }
    }
  }

  trusses.forEach(truss => {
    boundaries.forEach(boundary => {
      const collision = checkTrussBoundaryCollision(truss, boundary);
      if (collision) {
        results.push(collision);
      }
    });
  });

  return results;
}

function checkEquipmentBoundaryCollision(
  equipment: Equipment,
  boundary: StageBoundary
): CollisionResult | null {
  const eqBox = getEquipmentAABB(equipment);
  const clearanceThreshold = 0.3;

  const distance = distanceFromAABBToBoundary(eqBox, boundary);

  if (distance <= 0) {
    return {
      id: uuidv4(),
      type: 'equipment-boundary',
      object1: {
        id: equipment.id,
        name: equipment.name,
        type: 'equipment',
      },
      object2: {
        id: boundary.id,
        name: boundary.name,
        type: 'boundary',
      },
      distance: Math.max(0, distance),
      clearance: clearanceThreshold,
      isColliding: true,
      isNear: true,
      penetrationDepth: Math.abs(distance),
    };
  }

  if (distance < clearanceThreshold) {
    return {
      id: uuidv4(),
      type: 'equipment-boundary',
      object1: {
        id: equipment.id,
        name: equipment.name,
        type: 'equipment',
      },
      object2: {
        id: boundary.id,
        name: boundary.name,
        type: 'boundary',
      },
      distance,
      clearance: clearanceThreshold,
      isColliding: false,
      isNear: true,
      penetrationDepth: 0,
    };
  }

  return null;
}

function checkEquipmentEquipmentCollision(
  eq1: Equipment,
  eq2: Equipment
): CollisionResult | null {
  const box1 = getEquipmentAABB(eq1);
  const box2 = getEquipmentAABB(eq2);
  const clearanceThreshold = 0.1;

  const distance = distanceBetweenAABBs(box1, box2);

  if (distance <= 0) {
    return {
      id: uuidv4(),
      type: 'equipment-equipment',
      object1: {
        id: eq1.id,
        name: eq1.name,
        type: 'equipment',
      },
      object2: {
        id: eq2.id,
        name: eq2.name,
        type: 'equipment',
      },
      distance: Math.max(0, distance),
      clearance: clearanceThreshold,
      isColliding: true,
      isNear: true,
      penetrationDepth: Math.abs(distance),
    };
  }

  if (distance < clearanceThreshold) {
    return {
      id: uuidv4(),
      type: 'equipment-equipment',
      object1: {
        id: eq1.id,
        name: eq1.name,
        type: 'equipment',
      },
      object2: {
        id: eq2.id,
        name: eq2.name,
        type: 'equipment',
      },
      distance,
      clearance: clearanceThreshold,
      isColliding: false,
      isNear: true,
      penetrationDepth: 0,
    };
  }

  return null;
}

function checkTrussBoundaryCollision(
  truss: Truss,
  boundary: StageBoundary
): CollisionResult | null {
  const trussBox = getTrussAABB(truss);
  const clearanceThreshold = 0.2;

  const distance = distanceFromAABBToBoundary(trussBox, boundary);

  if (distance <= 0) {
    return {
      id: uuidv4(),
      type: 'truss-boundary',
      object1: {
        id: truss.id,
        name: truss.name,
        type: 'truss',
      },
      object2: {
        id: boundary.id,
        name: boundary.name,
        type: 'boundary',
      },
      distance: Math.max(0, distance),
      clearance: clearanceThreshold,
      isColliding: true,
      isNear: true,
      penetrationDepth: Math.abs(distance),
    };
  }

  if (distance < clearanceThreshold) {
    return {
      id: uuidv4(),
      type: 'truss-boundary',
      object1: {
        id: truss.id,
        name: truss.name,
        type: 'truss',
      },
      object2: {
        id: boundary.id,
        name: boundary.name,
        type: 'boundary',
      },
      distance,
      clearance: clearanceThreshold,
      isColliding: false,
      isNear: true,
      penetrationDepth: 0,
    };
  }

  return null;
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

function getTrussAABB(truss: Truss): AABB {
  const halfLength = truss.length / 2;
  const halfWidth = truss.width / 2;
  const halfHeight = truss.height / 2;
  
  return {
    min: {
      x: truss.position.x - halfLength,
      y: truss.position.y,
      z: truss.position.z - halfWidth,
    },
    max: {
      x: truss.position.x + halfLength,
      y: truss.position.y + halfHeight,
      z: truss.position.z + halfWidth,
    },
  };
}

function distanceFromAABBToBoundary(aabb: AABB, boundary: StageBoundary): number {
  if (boundary.vertices.length < 2) return Infinity;

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

  let minDist = Infinity;
  const n = boundary.vertices.length;

  for (let i = 0; i < n; i++) {
    const v1 = boundary.vertices[i];
    const v2 = boundary.vertices[(i + 1) % n];

    const segmentDist = distanceFromPointToSegment(aabbCenter, v1, v2);
    minDist = Math.min(minDist, segmentDist - aabbRadius);

    minDist = Math.min(minDist, vectorDistance(aabbCenter, v1) - aabbRadius);
  }

  if (boundary.vertices.length >= 3) {
    const planeDist = distanceFromPointToPolygonPlane(aabbCenter, boundary.vertices);
    if (planeDist !== null) {
      minDist = Math.min(minDist, planeDist - aabbRadius);
    }
  }

  return minDist;
}

function distanceBetweenAABBs(box1: AABB, box2: AABB): number {
  let dx = 0, dy = 0, dz = 0;

  if (box1.max.x < box2.min.x) {
    dx = box2.min.x - box1.max.x;
  } else if (box1.min.x > box2.max.x) {
    dx = box1.min.x - box2.max.x;
  }

  if (box1.max.y < box2.min.y) {
    dy = box2.min.y - box1.max.y;
  } else if (box1.min.y > box2.max.y) {
    dy = box1.min.y - box2.max.y;
  }

  if (box1.max.z < box2.min.z) {
    dz = box2.min.z - box1.max.z;
  } else if (box1.min.z > box2.max.z) {
    dz = box1.min.z - box2.max.z;
  }

  if (dx === 0 && dy === 0 && dz === 0) {
    let minOverlap = Infinity;
    
    if (box1.max.x >= box2.min.x && box1.min.x <= box2.max.x) {
      const overlapX = Math.min(box1.max.x, box2.max.x) - Math.max(box1.min.x, box2.min.x);
      minOverlap = Math.min(minOverlap, overlapX);
    }
    if (box1.max.y >= box2.min.y && box1.min.y <= box2.max.y) {
      const overlapY = Math.min(box1.max.y, box2.max.y) - Math.max(box1.min.y, box2.min.y);
      minOverlap = Math.min(minOverlap, overlapY);
    }
    if (box1.max.z >= box2.min.z && box1.min.z <= box2.max.z) {
      const overlapZ = Math.min(box1.max.z, box2.max.z) - Math.max(box1.min.z, box2.min.z);
      minOverlap = Math.min(minOverlap, overlapZ);
    }
    
    return -minOverlap;
  }

  return Math.sqrt(dx * dx + dy * dy + dz * dz);
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

function distanceFromPointToPolygonPlane(point: Vector3, vertices: Vector3[]): number | null {
  if (vertices.length < 3) return null;

  const v0 = vertices[0];
  const v1 = vertices[1];
  const v2 = vertices[2];

  const edge1 = subtractVectors(v1, v0);
  const edge2 = subtractVectors(v2, v0);

  const normal = crossProduct(edge1, edge2);
  const normalLength = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z);
  
  if (normalLength < 0.0001) return null;

  const normalizedNormal = multiplyVectorScalar(normal, 1 / normalLength);
  const planeOffset = -(normalizedNormal.x * v0.x + normalizedNormal.y * v0.y + normalizedNormal.z * v0.z);
  
  const distance = normalizedNormal.x * point.x + normalizedNormal.y * point.y + normalizedNormal.z * point.z + planeOffset;
  
  return Math.abs(distance);
}

function crossProduct(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function getValidationSummary(validation: ValidationResult): {
  errors: string[];
  warnings: string[];
  safe: boolean;
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  validation.hoistLoads.forEach(h => {
    if (h.isOverloaded) {
      errors.push(`吊点超载: 负载 ${h.staticLoad.toFixed(1)}kg / 额定 ${h.maxRatedLoad}kg (${(h.loadRatio * 100).toFixed(0)}%)`);
    } else if (h.isWarning) {
      warnings.push(`吊点接近满载: 负载 ${h.staticLoad.toFixed(1)}kg / 额定 ${h.maxRatedLoad}kg (${(h.loadRatio * 100).toFixed(0)}%)`);
    }
  });

  if (validation.unbalance.isUnbalanced) {
    errors.push(`偏载超限: 最大偏载比 ${(validation.unbalance.maxRatio * 100).toFixed(1)}%`);
  }

  validation.collisions.forEach(c => {
    if (c.isColliding) {
      errors.push(`碰撞检测: ${c.object1.name} 与 ${c.object2.name} 发生碰撞 (穿透深度: ${c.penetrationDepth.toFixed(2)}m)`);
    } else if (c.isNear) {
      warnings.push(`接近警告: ${c.object1.name} 与 ${c.object2.name} 距离过近 (距离: ${c.distance.toFixed(2)}m)`);
    }
  });

  return {
    errors,
    warnings,
    safe: validation.isSafe,
  };
}
