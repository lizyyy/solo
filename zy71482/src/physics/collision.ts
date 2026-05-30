import { StoneParams, TrajectoryPoint, CollisionEvent, Vector2D, STONE_RADIUS } from '../types';
import { getPositionAtTime } from './trajectory';

function distance(a: Vector2D, b: Vector2D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function checkStoneCollision(
  stone1: StoneParams,
  traj1: TrajectoryPoint[],
  stone2: StoneParams,
  traj2: TrajectoryPoint[]
): CollisionEvent | null {
  if (stone1.id === stone2.id) return null;
  
  const maxTime = Math.max(
    traj1[traj1.length - 1].timestamp,
    traj2[traj2.length - 1].timestamp
  );
  
  const step = 0.005;
  let time = 0;
  
  while (time < maxTime) {
    const pos1 = getPositionAtTime(traj1, time);
    const pos2 = getPositionAtTime(traj2, time);
    
    const dist = distance(pos1.position, pos2.position);
    
    if (dist <= 2 * STONE_RADIUS) {
      let low = Math.max(0, time - step);
      let high = time;
      
      for (let i = 0; i < 10; i++) {
        const mid = (low + high) / 2;
        const p1 = getPositionAtTime(traj1, mid);
        const p2 = getPositionAtTime(traj2, mid);
        const d = distance(p1.position, p2.position);
        
        if (d <= 2 * STONE_RADIUS) {
          high = mid;
        } else {
          low = mid;
        }
      }
      
      const collisionTime = high;
      const collisionPos1 = getPositionAtTime(traj1, collisionTime);
      const collisionPos2 = getPositionAtTime(traj2, collisionTime);
      
      return {
        id: `collision-${stone1.id}-${stone2.id}`,
        stoneA: stone1.id,
        stoneB: stone2.id,
        position: {
          x: (collisionPos1.position.x + collisionPos2.position.x) / 2,
          y: (collisionPos1.position.y + collisionPos2.position.y) / 2
        },
        timestamp: collisionTime,
        type: 'stone-stone'
      };
    }
    
    time += step;
  }
  
  return null;
}

export function detectAllCollisions(
  stones: StoneParams[],
  trajectories: Map<string, TrajectoryPoint[]>
): CollisionEvent[] {
  const collisions: CollisionEvent[] = [];
  const detectedPairs = new Set<string>();
  
  for (let i = 0; i < stones.length; i++) {
    for (let j = i + 1; j < stones.length; j++) {
      const stone1 = stones[i];
      const stone2 = stones[j];
      const traj1 = trajectories.get(stone1.id);
      const traj2 = trajectories.get(stone2.id);
      
      if (!traj1 || !traj2) continue;
      
      const pairKey = [stone1.id, stone2.id].sort().join('-');
      if (detectedPairs.has(pairKey)) continue;
      
      const collision = checkStoneCollision(stone1, traj1, stone2, traj2);
      if (collision) {
        collisions.push(collision);
        detectedPairs.add(pairKey);
      }
    }
  }
  
  return collisions.sort((a, b) => a.timestamp - b.timestamp);
}

export function resolveCollision(
  velocityA: Vector2D,
  velocityB: Vector2D,
  positionA: Vector2D,
  positionB: Vector2D,
  restitution: number = 0.95
): { velocityA: Vector2D; velocityB: Vector2D } {
  const dx = positionB.x - positionA.x;
  const dy = positionB.y - positionA.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  if (dist === 0) return { velocityA, velocityB };
  
  const nx = dx / dist;
  const ny = dy / dist;
  
  const dvx = velocityA.x - velocityB.x;
  const dvy = velocityA.y - velocityB.y;
  
  const dvn = dvx * nx + dvy * ny;
  
  if (dvn > 0) return { velocityA, velocityB };
  
  const impulse = -(1 + restitution) * dvn / 2;
  
  return {
    velocityA: {
      x: velocityA.x + impulse * nx,
      y: velocityA.y + impulse * ny
    },
    velocityB: {
      x: velocityB.x - impulse * nx,
      y: velocityB.y - impulse * ny
    }
  };
}
