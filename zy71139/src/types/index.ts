export interface Fan {
  id: string;
  name: string;
  position: { x: number; y: number; z: number };
  direction: 'forward' | 'backward';
  isOn: boolean;
  power: number;
  zone: 'inlet' | 'middle' | 'outlet';
}

export interface SmokeParticle {
  id: string;
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  density: number;
  life: number;
}

export interface EscapeRoute {
  id: string;
  name: string;
  position: { x: number; y: number; z: number };
  isBlocked: boolean;
}

export interface SmokeSource {
  position: { x: number; y: number; z: number };
  intensity: number;
  active: boolean;
}

export interface Vehicle {
  id: string;
  position: { x: number; y: number; z: number };
  direction: number;
}

export type CameraView = 'overview' | 'top' | 'side' | 'escape' | 'free';

export interface SimulationError {
  id: string;
  type: 'fan_wrong_direction' | 'escape_blocked' | 'timestep_error';
  severity: 'warning' | 'critical';
  timestamp: number;
  description: string;
  step: number;
}

export interface FanOperation {
  fanId: string;
  action: 'toggle' | 'direction' | 'power';
  value: boolean | string | number;
  timestamp: number;
  step: number;
}

export interface TimeStep {
  step: number;
  timestamp: number;
  fanStates: Fan[];
  smokeCoverage: number;
  escapeRoutesBlocked: string[];
}

export interface Scene {
  id: string;
  name: string;
  description: string;
  tunnelLength: number;
  fans: Fan[];
  escapeRoutes: EscapeRoute[];
  smokeSources: SmokeSource[];
  vehicles: Vehicle[];
}

export interface SimulationRecord {
  id: string;
  sceneName: string;
  startTime: number;
  endTime: number;
  timeSteps: TimeStep[];
  fanOperations: FanOperation[];
  errors: SimulationError[];
  finalScore: number;
}

export interface ReportData {
  summary: {
    totalTime: number;
    totalSteps: number;
    errorCount: number;
    criticalErrors: number;
    score: number;
  };
  timeline: TimeStep[];
  operations: FanOperation[];
  errors: {
    fan_wrong_direction: SimulationError[];
    escape_blocked: SimulationError[];
    timestep_error: SimulationError[];
  };
  recommendations: string[];
}

export interface SimulationState {
  isPlaying: boolean;
  currentStep: number;
  maxSteps: number;
  speed: number;
  fans: Fan[];
  smokeParticles: SmokeParticle[];
  escapeRoutes: EscapeRoute[];
  smokeSources: SmokeSource[];
  vehicles: Vehicle[];
  errors: SimulationError[];
  operations: FanOperation[];
  timeSteps: TimeStep[];
  cameraView: CameraView;
  selectedScene: Scene | null;
  startTime: number;
  smokeCoverage: number;
}
