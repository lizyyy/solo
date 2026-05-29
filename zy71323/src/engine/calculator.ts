import type {
  EstimationParams,
  TideCycleSegment,
  CalculationResult,
  PeriodIntegrationResult,
  DeviceCheckResult,
  ConstraintViolation,
} from '@/types';
import { normalizeToMetric } from './unitConverter';

const RHO = 1025;
const G = 9.81;
const JOULES_TO_KWH = 3.6e6;

export const calculatePotentialEnergy = (
  tidalRange: number,
  area: number,
  efficiency: number
): number => {
  return (0.5 * RHO * G * area * Math.pow(tidalRange, 2) * efficiency) / JOULES_TO_KWH;
};

export const calculateKineticEnergy = (
  velocity: number,
  area: number,
  efficiency: number,
  durationHours: number
): number => {
  const seconds = durationHours * 3600;
  return (0.5 * RHO * area * Math.pow(velocity, 3) * efficiency * seconds) / JOULES_TO_KWH;
};

export const calculatePower = (
  velocity: number,
  area: number,
  efficiency: number
): number => {
  return 0.5 * RHO * area * Math.pow(velocity, 3) * efficiency / 1000;
};

export const integratePeriod = (
  segments: TideCycleSegment[],
  params: EstimationParams
): PeriodIntegrationResult[] => {
  const area = normalizeToMetric(params.impellerArea, params.impellerAreaUnit);
  
  return segments.map(segment => {
    const duration = segment.endTime - segment.startTime;
    const velocity = normalizeToMetric(segment.flowVelocity, 'm/s');
    const power = calculatePower(velocity, area, params.efficiency);
    const energy = power * duration;
    
    return {
      segmentId: segment.id,
      timeRange: `${segment.startTime.toString().padStart(2, '0')}:00 - ${segment.endTime.toString().padStart(2, '0')}:00`,
      power,
      energy,
      valid: duration > 0 && velocity > 0,
    };
  });
};

export const checkDeviceConstraints = (
  params: EstimationParams,
  maxPower: number
): DeviceCheckResult => {
  const violations: ConstraintViolation[] = [];
  const { deviceConstraints, efficiency, flowVelocity, flowVelocityUnit } = params;
  
  const velocity = normalizeToMetric(flowVelocity, flowVelocityUnit);
  
  if (efficiency > deviceConstraints.maxEfficiency) {
    violations.push({
      type: 'efficiency',
      field: 'efficiency',
      message: `效率 ${efficiency.toFixed(4)} 超过设备最大允许效率 ${deviceConstraints.maxEfficiency.toFixed(4)}`,
      actual: efficiency,
      limit: deviceConstraints.maxEfficiency,
      severity: 'error',
    });
  }
  
  if (maxPower > deviceConstraints.ratedPower) {
    violations.push({
      type: 'power',
      field: 'ratedPower',
      message: `计算功率 ${maxPower.toFixed(2)} kW 超过设备额定功率 ${deviceConstraints.ratedPower.toFixed(2)} kW`,
      actual: maxPower,
      limit: deviceConstraints.ratedPower,
      severity: 'error',
    });
  }
  
  if (velocity > deviceConstraints.maxFlowVelocity) {
    violations.push({
      type: 'velocity',
      field: 'maxFlowVelocity',
      message: `流速 ${velocity.toFixed(2)} m/s 超过设备最大允许流速 ${deviceConstraints.maxFlowVelocity.toFixed(2)} m/s`,
      actual: velocity,
      limit: deviceConstraints.maxFlowVelocity,
      severity: 'warning',
    });
  }
  
  if (velocity < deviceConstraints.minFlowVelocity) {
    violations.push({
      type: 'velocity',
      field: 'minFlowVelocity',
      message: `流速 ${velocity.toFixed(2)} m/s 低于设备启动流速 ${deviceConstraints.minFlowVelocity.toFixed(2)} m/s`,
      actual: velocity,
      limit: deviceConstraints.minFlowVelocity,
      severity: 'warning',
    });
  }
  
  return {
    passed: violations.filter(v => v.severity === 'error').length === 0,
    violations,
  };
};

export const calculateEnergy = (params: EstimationParams): CalculationResult => {
  const tidalRange = normalizeToMetric(params.tidalRange, params.tidalRangeUnit);
  const flowVelocity = normalizeToMetric(params.flowVelocity, params.flowVelocityUnit);
  const impellerArea = normalizeToMetric(params.impellerArea, params.impellerAreaUnit);
  
  const potentialEnergy = calculatePotentialEnergy(
    tidalRange,
    impellerArea,
    params.efficiency
  );
  
  const kineticEnergyPerHour = calculatePower(
    flowVelocity,
    impellerArea,
    params.efficiency
  );
  
  const kineticEnergyDaily = kineticEnergyPerHour * 24;
  
  const periodIntegration = integratePeriod(params.tideCycles, params);
  
  const totalPeriodEnergy = periodIntegration.reduce((sum, seg) => sum + seg.energy, 0);
  const maxPower = Math.max(...periodIntegration.map(seg => seg.power), 0);
  
  const deviceCheck = checkDeviceConstraints(params, maxPower);
  
  const dailyGeneration = totalPeriodEnergy;
  const annualGeneration = dailyGeneration * 365.25 / 1000;
  
  const capacityFactor = deviceCheck.passed && params.deviceConstraints.ratedPower > 0
    ? (dailyGeneration / 24) / params.deviceConstraints.ratedPower
    : 0;
  
  return {
    potentialEnergy,
    kineticEnergy: kineticEnergyDaily,
    totalEnergy: potentialEnergy + totalPeriodEnergy,
    dailyGeneration,
    annualGeneration,
    capacityFactor,
    periodIntegration,
    deviceCheck,
  };
};
