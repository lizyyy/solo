import { calculateTorque, calculateIdealAntiSkating } from '../utils/physics';
import { CalibrationParams } from '../types/calibration';

export interface TorqueBreakdown {
  totalTorque: number;
  effectiveLength: number;
  forceNewtons: number;
  idealAntiSkating: number;
  antiSkatingDeviation: number;
}

export const calculateTorqueBreakdown = (
  params: CalibrationParams
): TorqueBreakdown => {
  const { stylusPressure, tonearmLength, antiSkating, antiSkatingDirection } =
    params;

  const effectiveLength = tonearmLength * 0.85;
  const forceNewtons = (stylusPressure / 1000) * 9.8;
  const totalTorque = calculateTorque(stylusPressure, tonearmLength);

  const idealAntiSkating = calculateIdealAntiSkating(stylusPressure, tonearmLength);

  const directionMultiplier = antiSkatingDirection === 'reverse' ? -1 : 1;
  const actualAntiSkating = antiSkating * directionMultiplier;
  const antiSkatingDeviation = actualAntiSkating - idealAntiSkating;

  return {
    totalTorque,
    effectiveLength,
    forceNewtons,
    idealAntiSkating,
    antiSkatingDeviation,
  };
};

export const getTorqueStatus = (
  torque: number,
  pressure: number
): { status: 'normal' | 'high' | 'low'; message: string } => {
  const expectedMin = calculateTorque(1.2, 220);
  const expectedMax = calculateTorque(2.5, 280);

  if (torque > expectedMax) {
    return {
      status: 'high',
      message: `力矩偏高 (${torque.toFixed(3)} mN·m)，可能导致唱片过度磨损`,
    };
  }
  if (torque < expectedMin) {
    return {
      status: 'low',
      message: `力矩偏低 (${torque.toFixed(3)} mN·m)，可能导致循迹不良`,
    };
  }
  return {
    status: 'normal',
    message: `力矩正常 (${torque.toFixed(3)} mN·m)`,
  };
};
