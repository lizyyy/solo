import * as THREE from 'three';
import { Attitude } from '../types';

const SOLAR_CONSTANT = 1361;
const SPEED_OF_LIGHT = 3e8;
const REFLECTIVITY = 0.92;
const SAIL_AREA = 100;
const SPACECRAFT_MASS = 100;
const GRAVITATIONAL_PARAMETER = 1.327e20;
const AU = 1.496e11;

export const degToRad = (deg: number): number => (deg * Math.PI) / 180;
export const radToDeg = (rad: number): number => (rad * 180) / Math.PI;

export const toRadians = (attitude: Attitude): Attitude => {
  if (attitude.unit === 'rad') return attitude;
  return {
    alpha: degToRad(attitude.alpha),
    beta: degToRad(attitude.beta),
    gamma: degToRad(attitude.gamma),
    unit: 'rad',
  };
};

export const getSailNormal = (attitude: Attitude): THREE.Vector3 => {
  const radAtt = toRadians(attitude);
  const normal = new THREE.Vector3(0, 0, 1);
  
  const euler = new THREE.Euler(radAtt.alpha, radAtt.beta, radAtt.gamma, 'XYZ');
  normal.applyEuler(euler);
  
  return normal.normalize();
};

export const calculateRadiationPressure = (
  sailNormal: THREE.Vector3,
  sunDirection: THREE.Vector3,
  isReversed: boolean = false
): { acceleration: THREE.Vector3; magnitude: number } => {
  const incidenceAngle = sailNormal.angleTo(sunDirection);
  const cosIncidence = Math.cos(incidenceAngle);
  
  let magnitude = (2 * SOLAR_CONSTANT * SAIL_AREA * cosIncidence * cosIncidence * REFLECTIVITY) / 
    (SPEED_OF_LIGHT * SPACECRAFT_MASS);
  
  const direction = sailNormal.clone();
  if (isReversed) {
    direction.negate();
    magnitude *= -1;
  }
  
  const acceleration = direction.multiplyScalar(magnitude);
  
  return { acceleration, magnitude: Math.abs(magnitude) };
};

export const calculateGravitationalAcceleration = (
  position: THREE.Vector3
): THREE.Vector3 => {
  const distance = position.length();
  const distanceScaled = distance * AU * 0.01;
  const magnitude = GRAVITATIONAL_PARAMETER / (distanceScaled * distanceScaled);
  
  return position.clone().normalize().multiplyScalar(-magnitude * 1e-10);
};

export const verletIntegration = (
  position: THREE.Vector3,
  velocity: THREE.Vector3,
  acceleration: THREE.Vector3,
  dt: number
): { newPosition: THREE.Vector3; newVelocity: THREE.Vector3 } => {
  const newPosition = position.clone()
    .add(velocity.clone().multiplyScalar(dt))
    .add(acceleration.clone().multiplyScalar(0.5 * dt * dt));
  
  const newVelocity = velocity.clone()
    .add(acceleration.clone().multiplyScalar(dt));
  
  return { newPosition, newVelocity };
};

export const checkTrajectoryDivergence = (
  trajectory: { position: THREE.Vector3 }[],
  threshold: number = 5
): { isDivergent: boolean; divergenceIndex: number } => {
  if (trajectory.length < 10) return { isDivergent: false, divergenceIndex: -1 };
  
  for (let i = 10; i < trajectory.length; i++) {
    const recentPositions = trajectory.slice(i - 10, i);
    const distances = recentPositions.map(p => p.position.length());
    const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
    const variance = distances.reduce((a, b) => a + (b - avgDistance) ** 2, 0) / distances.length;
    
    if (variance > threshold * threshold && avgDistance > 3) {
      return { isDivergent: true, divergenceIndex: i };
    }
  }
  
  return { isDivergent: false, divergenceIndex: -1 };
};

export const calculateConclusion = (
  attitude: Attitude,
  pressureReversed: boolean,
  isDivergent: boolean
): 'consistent' | 'inconsistent' | 'needs-evidence' => {
  if (attitude.unit === 'rad' && Math.abs(attitude.alpha) > Math.PI * 2) {
    return 'inconsistent';
  }
  
  if (pressureReversed && !isDivergent) {
    return 'needs-evidence';
  }
  
  if (isDivergent || pressureReversed) {
    return 'inconsistent';
  }
  
  return 'consistent';
};
