import type {
  Vector3,
  InstrumentCart,
  SterileZone,
  Staff,
  ErrorItem,
  SceneElement,
} from '../types';

export const checkAABBCollision = (
  pos1: Vector3,
  size1: { width: number; depth: number },
  pos2: Vector3,
  size2: { width: number; depth: number }
): boolean => {
  const minX1 = pos1.x - size1.width / 2;
  const maxX1 = pos1.x + size1.width / 2;
  const minZ1 = pos1.z - size1.depth / 2;
  const maxZ1 = pos1.z + size1.depth / 2;

  const minX2 = pos2.x - size2.width / 2;
  const maxX2 = pos2.x + size2.width / 2;
  const minZ2 = pos2.z - size2.depth / 2;
  const maxZ2 = pos2.z + size2.depth / 2;

  return minX1 < maxX2 && maxX1 > minX2 && minZ1 < maxZ2 && maxZ1 > minZ2;
};

export const isPointInRect = (
  point: Vector3,
  rectPos: Vector3,
  rectSize: { width: number; depth: number }
): boolean => {
  const minX = rectPos.x - rectSize.width / 2;
  const maxX = rectPos.x + rectSize.width / 2;
  const minZ = rectPos.z - rectSize.depth / 2;
  const maxZ = rectPos.z + rectSize.depth / 2;

  return point.x >= minX && point.x <= maxX && point.z >= minZ && point.z <= maxZ;
};

export const lineSegmentIntersection = (
  p1: Vector3,
  p2: Vector3,
  p3: Vector3,
  p4: Vector3
): Vector3 | null => {
  const denom =
    (p4.z - p3.z) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.z - p1.z);

  if (Math.abs(denom) < 0.0001) return null;

  const ua =
    ((p4.x - p3.x) * (p1.z - p3.z) - (p4.z - p3.z) * (p1.x - p3.x)) / denom;
  const ub =
    ((p2.x - p1.x) * (p1.z - p3.z) - (p2.z - p1.z) * (p1.x - p3.x)) / denom;

  if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
    return {
      x: p1.x + ua * (p2.x - p1.x),
      y: 0,
      z: p1.z + ua * (p2.z - p1.z),
    };
  }

  return null;
};

export const lineIntersectsRect = (
  p1: Vector3,
  p2: Vector3,
  rectPos: Vector3,
  rectSize: { width: number; depth: number }
): boolean => {
  if (isPointInRect(p1, rectPos, rectSize) || isPointInRect(p2, rectPos, rectSize)) {
    return true;
  }

  const corners = [
    { x: rectPos.x - rectSize.width / 2, z: rectPos.z - rectSize.depth / 2 },
    { x: rectPos.x + rectSize.width / 2, z: rectPos.z - rectSize.depth / 2 },
    { x: rectPos.x + rectSize.width / 2, z: rectPos.z + rectSize.depth / 2 },
    { x: rectPos.x - rectSize.width / 2, z: rectPos.z + rectSize.depth / 2 },
  ];

  for (let i = 0; i < 4; i++) {
    const c1 = { x: corners[i].x, y: 0, z: corners[i].z };
    const c2 = { x: corners[(i + 1) % 4].x, y: 0, z: corners[(i + 1) % 4].z };
    if (lineSegmentIntersection(p1, p2, c1, c2)) {
      return true;
    }
  }

  return false;
};

export const detectCollisions = (elements: SceneElement[]): ErrorItem[] => {
  const errors: ErrorItem[] = [];
  const carts = elements.filter((e) => e.type === 'instrumentCart') as InstrumentCart[];
  const sterileZones = elements.filter((e) => e.type === 'sterileZone') as SterileZone[];
  const staffs = elements.filter((e) => e.type === 'staff') as Staff[];

  for (let i = 0; i < carts.length; i++) {
    for (let j = i + 1; j < carts.length; j++) {
      if (
        checkAABBCollision(
          carts[i].position,
          { width: carts[i].width, depth: carts[i].depth },
          carts[j].position,
          { width: carts[j].width, depth: carts[j].depth }
        )
      ) {
        errors.push({
          id: `collision-${carts[i].id}-${carts[j].id}`,
          type: 'collision',
          severity: 'error',
          message: `器械车 "${carts[i].name}" 与 "${carts[j].name}" 发生碰撞`,
          position: {
            x: (carts[i].position.x + carts[j].position.x) / 2,
            y: 0.5,
            z: (carts[i].position.z + carts[j].position.z) / 2,
          },
          elementIds: [carts[i].id, carts[j].id],
        });
      }
    }
  }

  for (const staff of staffs) {
    if (staff.path.length < 2) continue;

    for (let i = 0; i < staff.path.length - 1; i++) {
      const p1 = staff.path[i].position;
      const p2 = staff.path[i + 1].position;

      for (const zone of sterileZones) {
        if (lineIntersectsRect(p1, p2, zone.position, { width: zone.width, depth: zone.depth })) {
          errors.push({
            id: `sterile-${staff.id}-${zone.id}-${i}`,
            type: 'sterileCross',
            severity: 'error',
            message: `"${staff.name}" 的路径穿越了无菌区 "${zone.name}"`,
            position: {
              x: (p1.x + p2.x) / 2,
              y: 0.1,
              z: (p1.z + p2.z) / 2,
            },
            timestamp: staff.path[i].timestamp,
            elementIds: [staff.id, zone.id],
          });
          break;
        }
      }
    }
  }

  for (let i = 0; i < staffs.length; i++) {
    for (let j = i + 1; j < staffs.length; j++) {
      const staff1 = staffs[i];
      const staff2 = staffs[j];

      if (staff1.path.length < 2 || staff2.path.length < 2) continue;

      for (let a = 0; a < staff1.path.length - 1; a++) {
        const p1 = staff1.path[a].position;
        const p2 = staff1.path[a + 1].position;
        const t1Start = staff1.path[a].timestamp;
        const t1End = staff1.path[a + 1].timestamp;

        for (let b = 0; b < staff2.path.length - 1; b++) {
          const p3 = staff2.path[b].position;
          const p4 = staff2.path[b + 1].position;
          const t2Start = staff2.path[b].timestamp;
          const t2End = staff2.path[b + 1].timestamp;

          const timeOverlap = !(t1End < t2Start || t2End < t1Start);
          if (!timeOverlap) continue;

          const intersection = lineSegmentIntersection(p1, p2, p3, p4);
          if (intersection) {
            errors.push({
              id: `cross-${staff1.id}-${staff2.id}-${a}-${b}`,
              type: 'routeCross',
              severity: 'warning',
              message: `"${staff1.name}" 与 "${staff2.name}" 的路径在时间上交叉`,
              position: intersection,
              timestamp: Math.max(t1Start, t2Start),
              elementIds: [staff1.id, staff2.id],
            });
          }
        }
      }
    }
  }

  return errors;
};
