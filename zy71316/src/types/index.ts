export interface SourceInfo {
  documentName: string;
  documentVersion: string;
  provider: string;
  remarks: string;
}

export interface SimulationParams {
  probeMass: number;
  probeMassSource: SourceInfo;
  
  parachuteArea: number;
  parachuteAreaSource: SourceInfo;
  deploymentAltitude: number;
  deploymentAltitudeSource: SourceInfo;
  
  atmosphericDensity: number;
  atmosphericDensitySource: SourceInfo;
  
  initialVelocity: number;
  initialVelocitySource: SourceInfo;
  initialAltitude: number;
  initialAltitudeSource: SourceInfo;
  
  batchId: string;
  operator: string;
  timestamp: Date;
}

export type RiskType = 'ZERO_DENSITY' | 'VELOCITY_DIVERGENCE' | 'LOW_DEPLOYMENT_ALTITUDE';

export interface TrajectoryPoint {
  time: number;
  altitude: number;
  velocity: number;
  acceleration: number;
  dragForce: number;
  parachuteDeployed: boolean;
  risks: RiskType[];
}

export interface RiskExplanation {
  title: string;
  description: string;
  impact: string;
  mitigation: string;
  relatedParams: string[];
}

export interface TraceRecord {
  pointIndex: number;
  riskType: RiskType;
  paramSources: Record<string, SourceInfo>;
  calculationChain: string[];
}

export interface SimulationResult {
  params: SimulationParams;
  trajectory: TrajectoryPoint[];
  risks: TraceRecord[];
  finalVelocity: number;
  totalTime: number;
  landedSafely: boolean;
}

export const MARS_GRAVITY = 3.71;
export const DRAG_COEFFICIENT_PROBE = 1.2;
export const DRAG_COEFFICIENT_PARACHUTE = 1.5;
export const MIN_SAFE_LANDING_VELOCITY = 10;
