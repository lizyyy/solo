import { Ball, CollisionResult, CollisionType, TrajectoryFrame } from '../types';

export const BALL_COLORS = ['#FF6B35', '#00E5FF', '#00E676', '#FFD600', '#FF1744'];

const EPSILON = 0.001;

export function computeMomentum(balls: Ball[]): number {
  return balls.reduce((sum, b) => sum + b.mass * b.velocity, 0);
}

export function computeEnergy(balls: Ball[]): number {
  return balls.reduce((sum, b) => sum + 0.5 * b.mass * b.velocity * b.velocity, 0);
}

function computeElastic(balls: Ball[]): Ball[] {
  const result = balls.map(b => ({ ...b }));
  for (let i = 0; i < result.length; i++) {
    for (let j = i + 1; j < result.length; j++) {
      const m1 = result[i].mass;
      const m2 = result[j].mass;
      const v1 = result[i].velocity;
      const v2 = result[j].velocity;
      const totalMass = m1 + m2;
      result[i] = {
        ...result[i],
        velocity: ((m1 - m2) * v1 + 2 * m2 * v2) / totalMass
      };
      result[j] = {
        ...result[j],
        velocity: ((m2 - m1) * v2 + 2 * m1 * v1) / totalMass
      };
    }
  }
  return result;
}

function computePerfectlyInelastic(balls: Ball[]): Ball[] {
  const totalMomentum = balls.reduce((sum, b) => sum + b.mass * b.velocity, 0);
  const totalMass = balls.reduce((sum, b) => sum + b.mass, 0);
  const v = totalMomentum / totalMass;
  return balls.map(b => ({ ...b, velocity: v }));
}

function computeInelastic(balls: Ball[], restitution: number): Ball[] {
  const result = balls.map(b => ({ ...b }));
  for (let i = 0; i < result.length; i++) {
    for (let j = i + 1; j < result.length; j++) {
      const m1 = result[i].mass;
      const m2 = result[j].mass;
      const v1 = result[i].velocity;
      const v2 = result[j].velocity;
      const totalMass = m1 + m2;
      result[i] = {
        ...result[i],
        velocity: (m1 * v1 + m2 * v2 + m2 * restitution * (v2 - v1)) / totalMass
      };
      result[j] = {
        ...result[j],
        velocity: (m1 * v1 + m2 * v2 + m1 * restitution * (v1 - v2)) / totalMass
      };
    }
  }
  return result;
}

export function generateTrajectory(
  beforeBalls: Ball[],
  afterBalls: Ball[],
  durationMs: number,
  fps: number
): TrajectoryFrame[] {
  const timeStep = 1000 / fps;
  const totalFrames = Math.round(durationMs / timeStep);
  const midFrame = Math.floor(totalFrames / 2);
  const frames: TrajectoryFrame[] = [];

  const halfDurationSec = durationMs / 2 / 1000;

  const midPositions = beforeBalls.map(b => ({
    x: b.positionX + b.velocity * halfDurationSec,
    y: b.positionY
  }));

  const endPositions = afterBalls.map((b, i) => ({
    x: midPositions[i].x + b.velocity * halfDurationSec,
    y: b.positionY
  }));

  for (let i = 0; i <= totalFrames; i++) {
    const timestamp = i * timeStep;
    const ballStates = beforeBalls.map((before, idx) => {
      const after = afterBalls[idx];
      let x: number, y: number, vx: number, vy: number;

      if (i <= midFrame) {
        const progress = midFrame > 0 ? i / midFrame : 1;
        x = before.positionX + (midPositions[idx].x - before.positionX) * progress;
        y = before.positionY;
        vx = before.velocity;
        vy = 0;
      } else {
        const postFrames = totalFrames - midFrame;
        const progress = postFrames > 0 ? (i - midFrame) / postFrames : 1;
        x = midPositions[idx].x + (endPositions[idx].x - midPositions[idx].x) * progress;
        y = before.positionY;
        vx = after.velocity;
        vy = 0;
      }

      return { id: before.id, x, y, vx, vy };
    });

    frames.push({ timestamp, balls: ballStates });
  }

  return frames;
}

export function computeCollision(
  balls: Ball[],
  type: CollisionType,
  restitution: number = 0.5
): { afterBalls: Ball[]; result: CollisionResult } {
  const safeBalls = balls.map(b => ({
    ...b,
    mass: b.mass <= 0 ? EPSILON : b.mass
  }));

  const momentumBefore = computeMomentum(safeBalls);
  const energyBefore = computeEnergy(safeBalls);

  let afterBalls: Ball[];

  if (type === 'elastic') {
    afterBalls = computeElastic(safeBalls);
  } else if (type === 'perfectly_inelastic') {
    afterBalls = computePerfectlyInelastic(safeBalls);
  } else {
    afterBalls = computeInelastic(safeBalls, restitution);
  }

  const momentumAfter = computeMomentum(afterBalls);
  const energyAfter = computeEnergy(afterBalls);

  const momentumDeviation = momentumBefore !== 0
    ? Math.abs((momentumAfter - momentumBefore) / momentumBefore)
    : Math.abs(momentumAfter - momentumBefore);

  const energyDeviation = energyBefore !== 0
    ? Math.abs((energyAfter - energyBefore) / energyBefore)
    : Math.abs(energyAfter - energyBefore);

  const trajectoryFrames = generateTrajectory(safeBalls, afterBalls, 2000, 60);

  return {
    afterBalls,
    result: {
      momentumBefore,
      momentumAfter,
      energyBefore,
      energyAfter,
      momentumConserved: momentumDeviation < 0.01,
      energyConserved: energyDeviation < 0.01,
      momentumDeviation,
      energyDeviation,
      trajectoryFrames
    }
  };
}
