import type { SensorData, DeviceParams, EnergyPoint } from '../types';

export function calculateKineticEnergy(
  sensorData: SensorData[],
  mass: number
): EnergyPoint[] {
  return sensorData.map((data) => ({
    timestamp: data.timestamp,
    value: 0.5 * mass * data.velocity * data.velocity,
    unit: 'J',
  }));
}

export function calculatePotentialEnergy(
  sensorData: SensorData[],
  params: DeviceParams
): EnergyPoint[] {
  const { mass, gravity, slopeAngle } = params;
  const angleRad = (slopeAngle * Math.PI) / 180;
  let distance = 0;
  let prevTime = sensorData[0]?.timestamp || 0;

  return sensorData.map((data, index) => {
    if (index > 0) {
      const dt = (data.timestamp - prevTime) / 1000;
      distance += data.velocity * dt;
    }
    prevTime = data.timestamp;

    const height = distance * Math.sin(angleRad);
    return {
      timestamp: data.timestamp,
      value: mass * gravity * height,
      unit: 'J',
    };
  });
}

export function calculateTotalEnergy(
  kineticEnergy: EnergyPoint[],
  potentialEnergy: EnergyPoint[]
): EnergyPoint[] {
  return kineticEnergy.map((ke, index) => ({
    timestamp: ke.timestamp,
    value: ke.value + (potentialEnergy[index]?.value || 0),
    unit: 'J',
  }));
}

export function calculateEnergyLoss(totalEnergy: EnergyPoint[]): EnergyPoint[] {
  return totalEnergy.map((te, index) => {
    const prevValue = index > 0 ? totalEnergy[index - 1].value : te.value;
    return {
      timestamp: te.timestamp,
      value: Math.max(0, prevValue - te.value),
      unit: 'J',
    };
  });
}

export function calculateAverage(points: EnergyPoint[]): number {
  if (points.length === 0) return 0;
  const sum = points.reduce((acc, p) => acc + p.value, 0);
  return sum / points.length;
}

export function calculateTotal(points: EnergyPoint[]): number {
  return points.reduce((acc, p) => acc + p.value, 0);
}

export function calculateMaxValue(points: EnergyPoint[]): number {
  if (points.length === 0) return 0;
  return Math.max(...points.map((p) => p.value));
}

export function calculateMinValue(points: EnergyPoint[]): number {
  if (points.length === 0) return 0;
  return Math.min(...points.map((p) => p.value));
}

export interface EnergyCalculationResult {
  kineticEnergy: EnergyPoint[];
  potentialEnergy: EnergyPoint[];
  totalEnergy: EnergyPoint[];
  energyLoss: EnergyPoint[];
  avgKineticEnergy: number;
  avgPotentialEnergy: number;
  totalEnergyLoss: number;
}

export function performEnergyCalculation(
  sensorData: SensorData[],
  deviceParams: DeviceParams
): EnergyCalculationResult {
  const kineticEnergy = calculateKineticEnergy(sensorData, deviceParams.mass);
  const potentialEnergy = calculatePotentialEnergy(sensorData, deviceParams);
  const totalEnergy = calculateTotalEnergy(kineticEnergy, potentialEnergy);
  const energyLoss = calculateEnergyLoss(totalEnergy);

  return {
    kineticEnergy,
    potentialEnergy,
    totalEnergy,
    energyLoss,
    avgKineticEnergy: calculateAverage(kineticEnergy),
    avgPotentialEnergy: calculateAverage(potentialEnergy),
    totalEnergyLoss: calculateTotal(energyLoss),
  };
}
