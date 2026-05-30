import * as THREE from 'three';

export interface Attitude {
  alpha: number;
  beta: number;
  gamma: number;
  unit: 'deg' | 'rad';
}

export interface RadiationPressure {
  direction: THREE.Vector3;
  magnitude: number;
  isReversed: boolean;
}

export interface TrajectoryPoint {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  timestamp: number;
}

export type EvidenceType = 'attitude-change' | 'pressure-calc' | 'trajectory-event' | 'conclusion';

export interface EvidenceItem {
  timestamp: number;
  type: EvidenceType;
  description: string;
  data: Record<string, unknown>;
}

export type Conclusion = 'consistent' | 'inconsistent' | 'needs-evidence';

export interface SimulationScheme {
  id: string;
  name: string;
  createdAt: string;
  attitude: Attitude;
  radiationPressure: RadiationPressure;
  trajectory: TrajectoryPoint[];
  conclusion: Conclusion;
  evidenceLog: EvidenceItem[];
  hasUnitError?: boolean;
  hasPressureReverse?: boolean;
  divergenceTime?: number;
  arrivalDelay?: number;
}

export interface SimulationState {
  isPlaying: boolean;
  currentTime: number;
  timeScale: number;
  attitude: Attitude;
  radiationPressure: RadiationPressure;
  trajectory: TrajectoryPoint[];
  spacecraftPosition: THREE.Vector3;
  spacecraftVelocity: THREE.Vector3;
  evidenceLog: EvidenceItem[];
  conclusion: Conclusion;
}

export interface SchemeState {
  schemes: SimulationScheme[];
  selectedSchemeId: string | null;
  filter: 'all' | 'consistent' | 'inconsistent';
}
