import type { PhysicsParams, DataPoint } from '@/types/simulation';
import { nanoid } from 'nanoid';

export function calculatePotentialEnergy(mass: number, height: number, gravity: number): number {
  return mass * gravity * height;
}

export function calculateKineticEnergy(mass: number, velocity: number): number {
  return 0.5 * mass * velocity * velocity;
}

export function calculateFrictionForce(normalForce: number, frictionCoeff: number): number {
  return frictionCoeff * normalForce;
}

export function calculateAirDragForce(dragCoeff: number, airDensity: number, velocity: number, frontalArea: number): number {
  return 0.5 * dragCoeff * airDensity * frontalArea * velocity * velocity;
}

export function calculateHeight(position: number, rampAngle: number, rampLength: number): number {
  const angleRad = (rampAngle * Math.PI) / 180;
  const maxDistance = rampLength;
  const effectivePosition = Math.min(Math.max(position, 0), maxDistance);
  return (maxDistance - effectivePosition) * Math.sin(angleRad);
}

export function calculateAcceleration(params: PhysicsParams, velocity: number): number {
  const angleRad = (params.rampAngle * Math.PI) / 180;
  const gravitationalComponent = params.gravity * Math.sin(angleRad);
  const normalForce = params.skateboardMass * params.gravity * Math.cos(angleRad);
  const frictionForce = calculateFrictionForce(normalForce, params.frictionCoeff);
  const airDragForce = calculateAirDragForce(
    params.airDragCoeff,
    params.airDensity || 1.225,
    velocity,
    params.frontalArea || 0.5
  );
  const totalResistance = frictionForce + airDragForce;
  const netForce = params.skateboardMass * gravitationalComponent - totalResistance;
  return netForce / params.skateboardMass;
}

export function runPhysicsSimulation(params: PhysicsParams, timeStep: number = 0.01, maxTime: number = 10): DataPoint[] {
  const dataPoints: DataPoint[] = [];
  let position = 0;
  let velocity = 0;
  let totalFrictionLoss = 0;
  let totalAirDragLoss = 0;
  const initialHeight = calculateHeight(0, params.rampAngle, params.rampLength);
  const initialPE = calculatePotentialEnergy(params.skateboardMass, initialHeight, params.gravity);

  dataPoints.push({
    id: nanoid(),
    timestamp: 0,
    position: 0,
    velocity: 0,
    potentialEnergy: initialPE,
    kineticEnergy: 0,
    frictionLoss: 0,
    airDragLoss: 0,
    totalEnergy: initialPE,
    acceleration: calculateAcceleration(params, 0),
    normalForce: params.skateboardMass * params.gravity * Math.cos((params.rampAngle * Math.PI) / 180),
    frictionForce: calculateFrictionForce(
      params.skateboardMass * params.gravity * Math.cos((params.rampAngle * Math.PI) / 180),
      params.frictionCoeff
    ),
    airDragForce: 0,
    isSupplemented: false,
  });

  let currentTime = timeStep;
  while (currentTime <= maxTime && position < params.rampLength) {
    const acceleration = calculateAcceleration(params, velocity);
    const newVelocity = velocity + acceleration * timeStep;
    if (newVelocity < 0) break;
    const distanceTraveled = velocity * timeStep + 0.5 * acceleration * timeStep * timeStep;
    const newPosition = position + distanceTraveled;
    if (newPosition >= params.rampLength) break;

    const height = calculateHeight(newPosition, params.rampAngle, params.rampLength);
    const normalForce = params.skateboardMass * params.gravity * Math.cos((params.rampAngle * Math.PI) / 180);
    const frictionForce = calculateFrictionForce(normalForce, params.frictionCoeff);
    const airDragForce = calculateAirDragForce(
      params.airDragCoeff,
      params.airDensity || 1.225,
      newVelocity,
      params.frontalArea || 0.5
    );

    totalFrictionLoss += frictionForce * distanceTraveled;
    totalAirDragLoss += airDragForce * distanceTraveled;

    const pe = calculatePotentialEnergy(params.skateboardMass, height, params.gravity);
    const ke = calculateKineticEnergy(params.skateboardMass, newVelocity);

    dataPoints.push({
      id: nanoid(),
      timestamp: Math.round(currentTime * 1000) / 1000,
      position: Math.round(newPosition * 1000) / 1000,
      velocity: Math.round(newVelocity * 1000) / 1000,
      potentialEnergy: Math.round(pe * 1000) / 1000,
      kineticEnergy: Math.round(ke * 1000) / 1000,
      frictionLoss: Math.round(totalFrictionLoss * 1000) / 1000,
      airDragLoss: Math.round(totalAirDragLoss * 1000) / 1000,
      totalEnergy: Math.round((pe + ke) * 1000) / 1000,
      acceleration: Math.round(acceleration * 1000) / 1000,
      normalForce: Math.round(normalForce * 1000) / 1000,
      frictionForce: Math.round(frictionForce * 1000) / 1000,
      airDragForce: Math.round(airDragForce * 1000) / 1000,
      isSupplemented: false,
    });

    position = newPosition;
    velocity = newVelocity;
    currentTime += timeStep;
  }
  return dataPoints;
}
