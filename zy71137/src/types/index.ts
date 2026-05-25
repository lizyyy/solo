export type PesticideType = 'herbicide' | 'insecticide' | 'fungicide' | 'organic';

export interface PesticideInfo {
  id: PesticideType;
  name: string;
  toxicity: 'low' | 'medium' | 'high';
  driftRisk: number;
  maxAllowedConcentration: number;
}

export interface Sprinkler {
  id: string;
  position: [number, number, number];
  sprayRate: number;
  dropletSize: number;
}

export interface AdjacentField {
  id: string;
  name: string;
  position: [number, number, number];
  size: [number, number];
  bufferZone: number;
}

export interface Canal {
  position: [number, number, number];
  size: [number, number];
  flowDirection: number;
}

export interface Orchard {
  position: [number, number, number];
  size: [number, number];
  treeRows: number;
  treesPerRow: number;
}

export interface OrchardScene {
  id: string;
  name: string;
  description: string;
  type: 'normal' | 'conflict' | 'empty';
  orchard: Orchard;
  sprinklers: Sprinkler[];
  canal: Canal;
  adjacentFields: AdjacentField[];
  defaultParams: SimulationParams;
}

export interface SimulationParams {
  windSpeed: number;
  windDirection: number;
  pesticideType: PesticideType;
  bufferThreshold: number;
  simulationSpeed: number;
}

export type AlertType = 'buffer' | 'canal' | 'concentration';
export type AlertSeverity = 'warning' | 'danger';

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  location?: [number, number, number];
  timestamp: number;
  fieldName?: string;
  fieldId?: string;
}

export interface ParticleData {
  id: number;
  position: [number, number, number];
  velocity: [number, number, number];
  lifetime: number;
  maxLifetime: number;
  size: number;
}

export interface DriftReport {
  sceneId: string;
  sceneName: string;
  simulationTime: number;
  params: SimulationParams;
  alerts: Alert[];
  maxDriftDistance: number;
  affectedAreas: string[];
  conclusion: 'safe' | 'warning' | 'unsafe';
  recommendations: string[];
  generatedAt: string;
}

export type CameraView = 'default' | 'top' | 'front' | 'side';