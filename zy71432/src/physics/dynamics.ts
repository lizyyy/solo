import { GRAVITY, MAX_SPEED } from './constants';
import type { CarParams, PhysicsState, IntermediateValues } from '../types';

export const calculateGrip = (
  car: CarParams,
  downForce: number
): { grip: number; intermediate: { normalForce: number; baseGrip: number; downForceContribution: number } } => {
  const weight = car.mass * GRAVITY;
  const normalForce = weight + downForce;
  const baseGrip = car.tireGrip;
  const downForceContribution = downForce > 0 ? 0.3 * (downForce / weight) : 0;
  const grip = baseGrip + downForceContribution;
  
  return {
    grip,
    intermediate: {
      normalForce,
      baseGrip,
      downForceContribution
    }
  };
};

export const calculateEffectivePower = (
  basePower: number,
  speed: number,
  grip: number
): { effectivePower: number; intermediate: { speedEfficiency: number; gripEfficiency: number } } => {
  const speedEfficiency = speed > 10 ? Math.min(1, 0.6 + 0.4 * (speed / MAX_SPEED)) : 0.5;
  const gripEfficiency = Math.min(1, 0.7 + 0.3 * grip);
  const effectivePower = basePower * speedEfficiency * gripEfficiency;
  
  return {
    effectivePower,
    intermediate: { speedEfficiency, gripEfficiency }
  };
};

export const calculateDynamics = (
  currentSpeed: number,
  car: CarParams,
  dragForce: number,
  downForce: number,
  grip: number,
  curvature: number
): {
  acceleration: number;
  newSpeed: number;
  gripLimit: number;
  isCornering: boolean;
  intermediate: IntermediateValues;
} => {
  const { effectivePower } = calculateEffectivePower(car.power, currentSpeed, grip);
  
  const thrustForce = currentSpeed > 0.1 ? effectivePower / currentSpeed : effectivePower * 10;
  const netForce = thrustForce - dragForce;
  const acceleration = netForce / car.mass;
  
  let newSpeed = currentSpeed + acceleration * 0.016;
  newSpeed = Math.max(0, Math.min(MAX_SPEED, newSpeed));
  
  const isCornering = Math.abs(curvature) > 0.01;
  const weight = car.mass * GRAVITY;
  const normalForce = weight + downForce;
  const maxLateralForce = grip * normalForce;
  const gripLimit = Math.sqrt((maxLateralForce / car.mass) * 100);
  
  if (isCornering) {
    const radius = 1 / Math.abs(curvature);
    const requiredLateralAccel = (newSpeed * newSpeed) / radius;
    const maxLateralAccel = maxLateralForce / car.mass;
    
    if (requiredLateralAccel > maxLateralAccel * 0.95) {
      const maxSafeSpeed = Math.sqrt(maxLateralAccel * 0.9 * radius);
      newSpeed = Math.min(newSpeed, maxSafeSpeed);
    }
  }
  
  return {
    acceleration,
    newSpeed,
    gripLimit,
    isCornering,
    intermediate: {
      airDensity: 0,
      dragCoeff: 0,
      liftCoeff: 0,
      dynamicPressure: 0,
      maxCornerSpeed: isCornering ? Math.sqrt((grip * normalForce / car.mass) * (1 / Math.abs(curvature))) : 0,
      requiredGrip: isCornering ? (newSpeed * newSpeed * Math.abs(curvature)) / GRAVITY : 0,
      availableGrip: grip
    }
  };
};

export const updatePhysicsState = (
  prevState: PhysicsState,
  car: CarParams,
  dragForce: number,
  downForce: number,
  grip: number,
  curvature: number,
  relativeWindSpeed: number
): PhysicsState => {
  const { acceleration, newSpeed, intermediate } = calculateDynamics(
    prevState.speed,
    car,
    dragForce,
    downForce,
    grip,
    curvature
  );
  
  const { effectivePower } = calculateEffectivePower(car.power, newSpeed, grip);
  
  return {
    speed: newSpeed,
    acceleration,
    dragForce,
    downForce,
    grip,
    effectivePower,
    relativeWindSpeed
  };
};
