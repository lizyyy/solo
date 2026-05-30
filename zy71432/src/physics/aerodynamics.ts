import { AIR_DENSITY } from './constants';
import type { CarParams, WingConfig, WindConfig, PhysicsState, IntermediateValues } from '../types';

export const calculateDragCoefficient = (
  car: CarParams,
  wing: WingConfig
): { Cd: number; intermediate: { baseCd: number; wingDragFactor: number } } => {
  const baseCd = car.baseDragCoeff;
  const wingDragFactor = wing.dragFactor;
  const Cd = baseCd * wingDragFactor;
  return {
    Cd,
    intermediate: { baseCd, wingDragFactor }
  };
};

export const calculateLiftCoefficient = (
  car: CarParams,
  wing: WingConfig
): { Cl: number; intermediate: { baseCl: number; wingLiftFactor: number } } => {
  const baseCl = car.baseLiftCoeff;
  const wingLiftFactor = wing.liftFactor;
  const Cl = baseCl + wingLiftFactor;
  return {
    Cl,
    intermediate: { baseCl, wingLiftFactor }
  };
};

export const calculateRelativeWind = (
  carSpeed: number,
  windSpeed: number,
  windDirection: number,
  carHeading: number
): { relativeSpeed: number; angle: number } => {
  const windRad = (windDirection * Math.PI) / 180;
  const headingRad = (carHeading * Math.PI) / 180;
  
  const windX = windSpeed * Math.cos(windRad);
  const windY = windSpeed * Math.sin(windRad);
  
  const carX = carSpeed * Math.cos(headingRad);
  const carY = carSpeed * Math.sin(headingRad);
  
  const relX = windX - carX;
  const relY = windY - carY;
  
  const relativeSpeed = Math.sqrt(relX * relX + relY * relY);
  const angle = Math.atan2(relY, relX) - headingRad;
  
  return { relativeSpeed, angle };
};

export const calculateAerodynamics = (
  speed: number,
  car: CarParams,
  wing: WingConfig,
  wind: WindConfig,
  heading: number
): {
  dragForce: number;
  downForce: number;
  relativeWindSpeed: number;
  intermediate: IntermediateValues;
} => {
  const { Cd, intermediate: cdInter } = calculateDragCoefficient(car, wing);
  const { Cl, intermediate: clInter } = calculateLiftCoefficient(car, wing);
  
  const { relativeSpeed } = calculateRelativeWind(
    speed * 3.6,
    wind.speed,
    wind.direction,
    heading
  );
  
  const relativeWindMs = relativeSpeed / 3.6;
  const dynamicPressure = 0.5 * AIR_DENSITY * relativeWindMs * relativeWindMs;
  
  const dragForce = dynamicPressure * Cd * car.frontalArea;
  const liftForce = dynamicPressure * Cl * car.frontalArea;
  const downForce = -liftForce;
  
  return {
    dragForce,
    downForce,
    relativeWindSpeed: relativeWindMs,
    intermediate: {
      airDensity: AIR_DENSITY,
      dragCoeff: Cd,
      liftCoeff: Cl,
      dynamicPressure,
      maxCornerSpeed: 0,
      requiredGrip: 0,
      availableGrip: 0
    }
  };
};

export const formatPhysicsForDisplay = (physics: PhysicsState) => ({
  speedKmh: (physics.speed * 3.6).toFixed(1),
  acceleration: physics.acceleration.toFixed(2),
  dragForceKN: (physics.dragForce / 1000).toFixed(2),
  downForceKN: (physics.downForce / 1000).toFixed(2),
  grip: physics.grip.toFixed(3),
  effectivePowerKW: (physics.effectivePower / 1000).toFixed(0)
});
