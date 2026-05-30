import { ExperimentParams, ExperimentResult } from '../types';

const MU0 = 4 * Math.PI * 1e-7;
const SPECIFIC_HEAT_COPPER = 385;
const DENSITY_COPPER = 8960;
const RESISTIVITY_COPPER = 1.68e-8;

export function calculateForce(params: ExperimentParams, position: number): number {
  const { coilCurrent, coilTurns, stageCount, trackLength } = params;
  const stageLength = trackLength / stageCount;
  const currentStage = Math.floor(position / stageLength);

  if (currentStage >= stageCount) return 0;

  const stageProgress = (position % stageLength) / stageLength;
  const efficiency = Math.sin(stageProgress * Math.PI);
  const baseForce = (MU0 * coilTurns * coilCurrent * coilCurrent) / (2 * Math.PI * 0.1);

  return baseForce * efficiency;
}

export function simulateStep(
  params: ExperimentParams,
  currentVelocity: number,
  position: number,
  deltaTime: number
): { velocity: number; acceleration: number; position: number } {
  const force = calculateForce(params, position);
  const acceleration = force / params.projectileMass;
  const newVelocity = currentVelocity + acceleration * deltaTime;
  const newPosition = position + (currentVelocity + newVelocity) * 0.5 * deltaTime;

  return {
    velocity: Math.max(0, newVelocity),
    acceleration,
    position: Math.min(newPosition, params.trackLength),
  };
}

export function calculateTemperature(
  params: ExperimentParams,
  currentTime: number,
  duration: number
): { coil: number; track: number } {
  const baseTemp = 25;
  const progress = currentTime / duration;

  const coilPower = params.coilCurrent * params.coilCurrent * RESISTIVITY_COPPER * 100;
  const coilMass = params.coilTurns * 0.01 * DENSITY_COPPER * Math.PI * 0.001 * 0.001;
  const coilTempRise = (coilPower * currentTime) / (coilMass * SPECIFIC_HEAT_COPPER);

  const trackTempRise = coilTempRise * 0.3 * (1 - Math.exp(-progress * 5));

  return {
    coil: baseTemp + coilTempRise * 0.1,
    track: baseTemp + trackTempRise,
  };
}

export function runFullSimulation(params: ExperimentParams): ExperimentResult {
  const dt = 0.0001;
  let position = 0;
  let velocity = 0;
  let maxAcceleration = 0;
  let time = 0;
  const velocityData: { time: number; velocity: number }[] = [];
  const temperatureData: { time: number; coil: number; track: number }[] = [];

  while (position < params.trackLength && time < 0.1) {
    const result = simulateStep(params, velocity, position, dt);
    velocity = result.velocity;
    position = result.position;
    maxAcceleration = Math.max(maxAcceleration, result.acceleration);
    time += dt;

    if (velocityData.length % 10 === 0) {
      velocityData.push({ time: time * 1000, velocity });
      const temps = calculateTemperature(params, time, 0.05);
      temperatureData.push({ time: time * 1000, ...temps });
    }
  }

  const kineticEnergy = 0.5 * params.projectileMass * velocity * velocity;
  const inputEnergy = params.coilCurrent * params.coilCurrent * RESISTIVITY_COPPER * 100 * time;
  const efficiency = inputEnergy > 0 ? (kineticEnergy / inputEnergy) * 100 : 0;
  const finalTemps = calculateTemperature(params, time, time);

  return {
    finalVelocity: velocity,
    maxAcceleration,
    kineticEnergy,
    maxTemperature: Math.max(finalTemps.coil, finalTemps.track),
    efficiency,
    duration: time * 1000,
    velocityData,
    temperatureData,
  };
}

export function getTemperatureColor(temp: number): string {
  const normalized = Math.min(Math.max((temp - 25) / 200, 0), 1);
  const r = Math.floor(255 * normalized);
  const g = Math.floor(200 * (1 - normalized));
  const b = Math.floor(255 * (1 - normalized));
  return `rgb(${r}, ${g}, ${b})`;
}
