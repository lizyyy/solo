import type { Body, Marble, EnergyState } from '@/types';

export function calculateKineticEnergy(marble: { vx: number; vy: number }, mass: number = 1): number {
  const speedSq = marble.vx * marble.vx + marble.vy * marble.vy;
  return 0.5 * mass * speedSq;
}

export function calculatePotentialEnergy(
  position: { x: number; y: number },
  bodies: Body[],
  G: number
): number {
  let potential = 0;

  for (const body of bodies) {
    const dx = body.x - position.x;
    const dy = body.y - position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 0) {
      potential -= (G * body.mass) / distance;
    }
  }

  return potential;
}

export function calculateEnergyState(
  marble: Marble,
  bodies: Body[],
  G: number
): EnergyState {
  const kinetic = calculateKineticEnergy(marble);
  const potential = calculatePotentialEnergy(marble, bodies, G);

  return {
    kinetic,
    potential,
    total: kinetic + potential,
  };
}

export function calculateSystemCenterOfMass(bodies: Body[]): { x: number; y: number } {
  let totalMass = 0;
  let weightedX = 0;
  let weightedY = 0;

  for (const body of bodies) {
    totalMass += body.mass;
    weightedX += body.x * body.mass;
    weightedY += body.y * body.mass;
  }

  if (totalMass === 0) return { x: 0, y: 0 };

  return {
    x: weightedX / totalMass,
    y: weightedY / totalMass,
  };
}

export function checkEscapeCondition(
  marble: Marble,
  bodies: Body[],
  G: number,
  escapeThreshold: number,
  canvasWidth: number,
  canvasHeight: number
): { escaped: boolean; escapeDistance?: number } {
  const energy = calculateEnergyState(marble, bodies, G);

  if (energy.total > escapeThreshold) {
    const com = calculateSystemCenterOfMass(bodies);
    const dx = marble.x - com.x;
    const dy = marble.y - com.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const maxDistance = Math.max(canvasWidth, canvasHeight) * 1.5;
    if (distance > maxDistance) {
      return { escaped: true, escapeDistance: distance };
    }
  }

  if (
    marble.x < -100 ||
    marble.x > canvasWidth + 100 ||
    marble.y < -100 ||
    marble.y > canvasHeight + 100
  ) {
    const com = calculateSystemCenterOfMass(bodies);
    const dx = marble.x - com.x;
    const dy = marble.y - com.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return { escaped: true, escapeDistance: distance };
  }

  return { escaped: false };
}

export function normalizeEnergy(
  energy: EnergyState,
  maxKinetic: number,
  minPotential: number
): { kinetic: number; potential: number; total: number } {
  const normalizedKinetic = maxKinetic > 0 ? energy.kinetic / maxKinetic : 0;
  const potentialRange = Math.abs(minPotential);
  const normalizedPotential = potentialRange > 0 ? (energy.potential - minPotential) / potentialRange : 0;
  const normalizedTotal = (normalizedKinetic + normalizedPotential) / 2;

  return {
    kinetic: Math.max(0, Math.min(1, normalizedKinetic)),
    potential: Math.max(0, Math.min(1, normalizedPotential)),
    total: Math.max(0, Math.min(1, normalizedTotal)),
  };
}
