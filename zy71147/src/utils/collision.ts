
import { Block, Pier, GantryRail, LiftingPath, CollisionResult, Vector3 } from '../types';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getAABB(
  position: Vector3,
  dimensions: { width: number; height: number; depth: number }
) {
  const halfW = dimensions.width / 2;
  const halfH = dimensions.height / 2;
  const halfD = dimensions.depth / 2;
  return {
    minX: position.x - halfW,
    maxX: position.x + halfW,
    minY: position.y,
    maxY: position.y + dimensions.height,
    minZ: position.z - halfD,
    maxZ: position.z + halfD,
  };
}

function aabbIntersect(a: ReturnType<typeof getAABB>, b: ReturnType<typeof getAABB>): boolean {
  return (
    a.minX <= b.maxX && a.maxX >= b.minX &&
    a.minY <= b.maxY && a.maxY >= b.minY &&
    a.minZ <= b.maxZ && a.maxZ >= b.minZ
  );
}

function distancePointToSegment(point: Vector3, segStart: Vector3, segEnd: Vector3): number {
  const dx = segEnd.x - segStart.x;
  const dy = segEnd.y - segStart.y;
  const dz = segEnd.z - segStart.z;
  const lengthSq = dx * dx + dy * dy + dz * dz;
  
  if (lengthSq === 0) {
    return Math.sqrt(
      Math.pow(point.x - segStart.x, 2) +
      Math.pow(point.y - segStart.y, 2) +
      Math.pow(point.z - segStart.z, 2)
    );
  }
  
  let t = ((point.x - segStart.x) * dx + (point.y - segStart.y) * dy + (point.z - segStart.z) * dz) / lengthSq;
  t = clamp(t, 0, 1);
  
  const closestX = segStart.x + t * dx;
  const closestY = segStart.y + t * dy;
  const closestZ = segStart.z + t * dz;
  
  return Math.sqrt(
    Math.pow(point.x - closestX, 2) +
    Math.pow(point.y - closestY, 2) +
    Math.pow(point.z - closestZ, 2)
  );
}

export function checkBlockPierCollision(block: Block, pier: Pier): CollisionResult | null {
  const blockAABB = getAABB(block.position, block.dimensions);
  const pierAABB = getAABB(pier.position, pier.dimensions);
  
  if (aabbIntersect(blockAABB, pierAABB)) {
    return {
      id: `collision-${block.id}-${pier.id}`,
      type: 'pier',
      severity: 'error',
      message: `${block.name} 与 ${pier.name} 发生碰撞`,
      position: {
        x: (block.position.x + pier.position.x) / 2,
        y: (block.position.y + block.dimensions.height / 2 + pier.position.y + pier.dimensions.height / 2) / 2,
        z: (block.position.z + pier.position.z) / 2,
      },
      blockId: block.id,
      pierId: pier.id,
    };
  }
  return null;
}

export function checkPathPierCollision(
  path: LiftingPath,
  block: Block,
  pier: Pier,
  progress: number
): CollisionResult | null {
  if (path.waypoints.length < 2) return null;
  
  const totalSegments = path.waypoints.length - 1;
  const currentProgress = progress * totalSegments;
  const segmentIndex = Math.floor(Math.min(currentProgress, totalSegments - 1));
  const segmentProgress = currentProgress - segmentIndex;
  
  const start = path.waypoints[segmentIndex];
  const end = path.waypoints[Math.min(segmentIndex + 1, path.waypoints.length - 1)];
  
  const currentPos = {
    x: start.x + (end.x - start.x) * segmentProgress,
    y: start.y + (end.y - start.y) * segmentProgress,
    z: start.z + (end.z - start.z) * segmentProgress,
  };
  
  const movingBlock = { ...block, position: currentPos };
  return checkBlockPierCollision(movingBlock, pier);
}

export function checkLiftingPointDirection(block: Block): CollisionResult[] {
  const results: CollisionResult[] = [];
  
  block.liftingPoints.forEach((lp) => {
    if (!lp.isValid) {
      results.push({
        id: `lp-${block.id}-${lp.id}`,
        type: 'liftingPoint',
        severity: 'warning',
        message: `${block.name} 吊点方向不正确`,
        position: {
          x: block.position.x + lp.position.x,
          y: block.position.y + lp.position.y + 2,
          z: block.position.z + lp.position.z,
        },
        blockId: block.id,
      });
    }
  });
  
  return results;
}

export function checkRailBoundary(block: Block, rails: GantryRail[]): CollisionResult[] {
  const results: CollisionResult[] = [];
  
  if (rails.length < 2) return results;
  
  const minX = Math.min(rails[0].start.x, rails[1].start.x);
  const maxX = Math.max(rails[0].end.x, rails[1].end.x);
  const minZ = Math.min(rails[0].start.z, rails[1].start.z);
  const maxZ = Math.max(rails[0].end.z, rails[1].end.z);
  
  const halfW = block.dimensions.width / 2;
  const halfD = block.dimensions.depth / 2;
  
  if (block.position.x - halfW < minX || block.position.x + halfW > maxX ||
      block.position.z - halfD < minZ || block.position.z + halfD > maxZ) {
    results.push({
      id: `rail-${block.id}`,
      type: 'rail',
      severity: 'error',
      message: `${block.name} 超出龙门吊轨道范围`,
      position: block.position,
      blockId: block.id,
    });
  }
  
  return results;
}

export function checkPathClearance(
  path: LiftingPath,
  block: Block,
  piers: Pier[],
  progress: number
): CollisionResult[] {
  const results: CollisionResult[] = [];
  
  if (path.waypoints.length < 2 || progress <= 0) return results;
  
  const totalSegments = path.waypoints.length - 1;
  const checkPoints = Math.min(Math.ceil(progress * totalSegments * 10), 50);
  
  if (checkPoints === 0) return results;
  
  for (let i = 0; i <= checkPoints; i++) {
    const t = (i / checkPoints) * progress;
    const pos = interpolatePath(path, t);
    const testBlock = { ...block, position: pos };
    
    for (const pier of piers) {
      const collision = checkBlockPierCollision(testBlock, pier);
      if (collision && !results.find(r => r.pierId === pier.id && r.blockId === block.id)) {
        results.push({
          ...collision,
          type: 'path',
          message: `吊装路径与 ${pier.name} 冲突`,
        });
      }
    }
  }
  
  return results;
}

function interpolatePath(path: LiftingPath, t: number): Vector3 {
  if (path.waypoints.length === 0) return { x: 0, y: 0, z: 0 };
  if (path.waypoints.length === 1) return path.waypoints[0];
  
  const totalSegments = path.waypoints.length - 1;
  const scaledT = t * totalSegments;
  const segmentIndex = Math.floor(Math.min(scaledT, totalSegments - 1));
  const segmentT = scaledT - segmentIndex;
  
  const start = path.waypoints[segmentIndex];
  const end = path.waypoints[Math.min(segmentIndex + 1, path.waypoints.length - 1)];
  
  return {
    x: start.x + (end.x - start.x) * segmentT,
    y: start.y + (end.y - start.y) * segmentT,
    z: start.z + (end.z - start.z) * segmentT,
  };
}

export function checkAllCollisions(
  blocks: Block[],
  piers: Pier[],
  rails: GantryRail[],
  liftingPaths: LiftingPath[],
  timelineProgress: number
): CollisionResult[] {
  const results: CollisionResult[] = [];
  
  blocks.forEach((block) => {
    const path = liftingPaths.find(p => p.blockId === block.id);
    const currentPos = path ? interpolatePath(path, timelineProgress) : block.position;
    const movingBlock = { ...block, position: currentPos };
    
    piers.forEach((pier) => {
      const collision = checkBlockPierCollision(movingBlock, pier);
      if (collision) {
        results.push(collision);
      }
    });
    
    results.push(...checkLiftingPointDirection(movingBlock));
    results.push(...checkRailBoundary(movingBlock, rails));
    
    if (path) {
      results.push(...checkPathClearance(path, block, piers, timelineProgress));
    }
  });
  
  const uniqueResults: CollisionResult[] = [];
  const seen = new Set<string>();
  
  results.forEach((r) => {
    const key = `${r.type}-${r.blockId || ''}-${r.pierId || ''}-${r.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueResults.push(r);
    }
  });
  
  return uniqueResults;
}

export function getBlockPositionAtProgress(
  block: Block,
  liftingPaths: LiftingPath[],
  progress: number
): Vector3 {
  const path = liftingPaths.find(p => p.blockId === block.id);
  if (!path || path.waypoints.length < 2) {
    return block.position;
  }
  return interpolatePath(path, progress);
}

