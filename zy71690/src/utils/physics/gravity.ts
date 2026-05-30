import type { Body, Marble, Vector2, PhysicsParams, ErrorMark } from '@/types';

const MAX_VELOCITY = 1000;
const MIN_DISTANCE = 5;

export function calculateGravityForce(
  body1: { x: number; y: number; mass: number },
  body2: { x: number; y: number; mass: number },
  G: number
): Vector2 {
  const dx = body2.x - body1.x;
  const dy = body2.y - body1.y;
  const distanceSq = dx * dx + dy * dy;
  const distance = Math.sqrt(distanceSq);

  if (distance < MIN_DISTANCE) {
    return { x: 0, y: 0 };
  }

  const forceMagnitude = (G * body1.mass * body2.mass) / distanceSq;
  const forceX = (forceMagnitude * dx) / distance;
  const forceY = (forceMagnitude * dy) / distance;

  return { x: forceX, y: forceY };
}

export function calculateNetGravity(
  marble: { x: number; y: number },
  bodies: Body[],
  G: number,
  frame: number,
  errorMarks: ErrorMark[]
): { force: Vector2; errors: ErrorMark[] } {
  let netForceX = 0;
  let netForceY = 0;
  const newErrors: ErrorMark[] = [...errorMarks];

  for (const body of bodies) {
    const dx = body.x - marble.x;
    const dy = body.y - marble.y;
    const distanceSq = dx * dx + dy * dy;
    const distance = Math.sqrt(distanceSq);

    if (distance < MIN_DISTANCE) continue;

    const forceMagnitude = (G * body.mass) / distanceSq;
    const forceX = (forceMagnitude * dx) / distance;
    const forceY = (forceMagnitude * dy) / distance;

    const dotProduct = dx * forceX + dy * forceY;
    if (dotProduct < 0) {
      const existingError = newErrors.find(
        (e) => e.type === 'gravity_direction' && e.frame === frame
      );
      if (!existingError) {
        newErrors.push({
          id: `err_${Date.now()}_${Math.random()}`,
          type: 'gravity_direction',
          frame,
          timestamp: Date.now(),
          description: `引力方向错误：力向量不指向星体 ${body.id}`,
          data: {
            bodyId: body.id,
            distance,
            force: { x: forceX, y: forceY },
            direction: { x: dx, y: dy },
            dotProduct,
          },
        });
      }
    }

    netForceX += forceX;
    netForceY += forceY;
  }

  return {
    force: { x: netForceX, y: netForceY },
    errors: newErrors,
  };
}

export function checkVelocityOverflow(
  vx: number,
  vy: number,
  frame: number,
  errorMarks: ErrorMark[]
): { velocity: Vector2; errors: ErrorMark[] } {
  const speed = Math.sqrt(vx * vx + vy * vy);
  const newErrors = [...errorMarks];

  if (speed > MAX_VELOCITY || !isFinite(speed)) {
    const clampedVx = isFinite(vx) ? Math.sign(vx) * Math.min(Math.abs(vx), MAX_VELOCITY) : 0;
    const clampedVy = isFinite(vy) ? Math.sign(vy) * Math.min(Math.abs(vy), MAX_VELOCITY) : 0;

    const existingError = newErrors.find(
      (e) => e.type === 'velocity_overflow' && e.frame === frame
    );
    if (!existingError) {
      newErrors.push({
        id: `err_${Date.now()}_${Math.random()}`,
        type: 'velocity_overflow',
        frame,
        timestamp: Date.now(),
        description: `速度溢出：速度 ${speed.toFixed(2)} 超过最大限制 ${MAX_VELOCITY}`,
        data: {
          originalVelocity: { x: vx, y: vy },
          clampedVelocity: { x: clampedVx, y: clampedVy },
          speed,
          maxVelocity: MAX_VELOCITY,
        },
      });
    }

    return {
      velocity: { x: clampedVx, y: clampedVy },
      errors: newErrors,
    };
  }

  return {
    velocity: { x: vx, y: vy },
    errors: newErrors,
  };
}

export function checkCollision(
  marble: Marble,
  bodies: Body[],
  frame: number,
  errorMarks: ErrorMark[]
): { collided: boolean; bodyId?: string; errors: ErrorMark[] } {
  const newErrors = [...errorMarks];

  for (const body of bodies) {
    const dx = marble.x - body.x;
    const dy = marble.y - body.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const minDistance = marble.radius + body.radius;

    if (distance < minDistance) {
      return {
        collided: true,
        bodyId: body.id,
        errors: newErrors,
      };
    }

    if (distance < minDistance * 1.5 && distance >= minDistance) {
      const existingError = newErrors.find(
        (e) => e.type === 'collision_miss' && e.data?.bodyId === body.id
      );
      if (!existingError) {
        newErrors.push({
          id: `err_${Date.now()}_${Math.random()}`,
          type: 'collision_miss',
          frame,
          timestamp: Date.now(),
          description: `碰撞漏判警告：距离星体 ${body.id} 仅 ${distance.toFixed(2)}px`,
          data: {
            bodyId: body.id,
            distance,
            minDistance,
            threshold: minDistance * 1.5,
          },
        });
      }
    }
  }

  return {
    collided: false,
    errors: newErrors,
  };
}

export function updateBodies(
  bodies: Body[],
  params: PhysicsParams,
  frame: number
): { bodies: Body[]; errors: ErrorMark[] } {
  const newBodies = bodies.map((body) => ({ ...body }));
  let errors: ErrorMark[] = [];

  for (let i = 0; i < newBodies.length; i++) {
    let ax = 0;
    let ay = 0;

    for (let j = 0; j < newBodies.length; j++) {
      if (i === j) continue;

      const gravityResult = calculateGravityForce(
        newBodies[i],
        newBodies[j],
        params.gravitationalConstant
      );
      ax += gravityResult.x / newBodies[i].mass;
      ay += gravityResult.y / newBodies[i].mass;
    }

    newBodies[i].vx += ax * params.timeStep;
    newBodies[i].vy += ay * params.timeStep;

    const velCheck = checkVelocityOverflow(newBodies[i].vx, newBodies[i].vy, frame, errors);
    newBodies[i].vx = velCheck.velocity.x;
    newBodies[i].vy = velCheck.velocity.y;
    errors = velCheck.errors;

    newBodies[i].x += newBodies[i].vx * params.timeStep;
    newBodies[i].y += newBodies[i].vy * params.timeStep;
  }

  return { bodies: newBodies, errors };
}
