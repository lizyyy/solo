import { TowerCraneConfig, LiftObject } from '../types';

export const calculateMaxWeightForRadius = (
  crane: TowerCraneConfig,
  radius: number
): number => {
  const curve = crane.weightRadiusCurve;
  
  if (radius <= curve[0].radius) return curve[0].maxWeight;
  if (radius >= curve[curve.length - 1].radius) return curve[curve.length - 1].maxWeight;
  
  for (let i = 0; i < curve.length - 1; i++) {
    if (radius >= curve[i].radius && radius <= curve[i + 1].radius) {
      const ratio = (radius - curve[i].radius) / (curve[i + 1].radius - curve[i].radius);
      return curve[i].maxWeight - ratio * (curve[i].maxWeight - curve[i + 1].maxWeight);
    }
  }
  
  return curve[curve.length - 1].maxWeight;
};

export const calculateLiftPath = (
  liftObject: LiftObject,
  progress: number
): { x: number; y: number; z: number } => {
  const { startPosition, endPosition, liftHeight } = liftObject;
  
  let x: number, y: number, z: number;
  
  if (progress <= 0.25) {
    const p = progress / 0.25;
    x = startPosition.x;
    y = p * liftHeight;
    z = startPosition.z;
  } else if (progress <= 0.75) {
    const p = (progress - 0.25) / 0.5;
    x = startPosition.x + p * (endPosition.x - startPosition.x);
    y = liftHeight;
    z = startPosition.z + p * (endPosition.z - startPosition.z);
  } else {
    const p = (progress - 0.75) / 0.25;
    x = endPosition.x;
    y = liftHeight - p * liftHeight;
    z = endPosition.z;
  }
  
  return { x, y, z };
};

export const calculateCraneAngleForPosition = (
  cranePosition: { x: number; z: number },
  targetPosition: { x: number; z: number }
): number => {
  const dx = targetPosition.x - cranePosition.x;
  const dz = targetPosition.z - cranePosition.z;
  return Math.atan2(dx, dz) * (180 / Math.PI);
};

export const calculateCraneRadiusForPosition = (
  cranePosition: { x: number; z: number },
  targetPosition: { x: number; z: number }
): number => {
  const dx = targetPosition.x - cranePosition.x;
  const dz = targetPosition.z - cranePosition.z;
  return Math.sqrt(dx * dx + dz * dz);
};

export const getCurrentLiftRadius = (
  crane: TowerCraneConfig,
  liftObject: LiftObject
): number => {
  const currentPos = calculateLiftPath(liftObject, liftObject.currentProgress);
  return calculateCraneRadiusForPosition(crane.position, { x: currentPos.x, z: currentPos.z });
};

export const getCurrentLiftAngle = (
  crane: TowerCraneConfig,
  liftObject: LiftObject
): number => {
  const currentPos = calculateLiftPath(liftObject, liftObject.currentProgress);
  return calculateCraneAngleForPosition(crane.position, { x: currentPos.x, z: currentPos.z });
};
