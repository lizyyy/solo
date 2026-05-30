export interface SourceInfo {
  id: string;
  source: string;
  importTime: number;
  rawData: string;
}

export interface CarParams extends SourceInfo {
  mass: number;
  power: number;
  baseDragCoeff: number;
  baseLiftCoeff: number;
  frontalArea: number;
  tireGrip: number;
}

export interface WingConfig extends SourceInfo {
  angle: number;
  dragFactor: number;
  liftFactor: number;
}

export interface WindConfig extends SourceInfo {
  speed: number;
  direction: number;
}

export interface PhysicsState {
  speed: number;
  acceleration: number;
  dragForce: number;
  downForce: number;
  grip: number;
  effectivePower: number;
  relativeWindSpeed: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface FrameData {
  frameNumber: number;
  timestamp: number;
  position: Position;
  heading: number;
  physics: PhysicsState;
  params: {
    wingAngle: number;
    windSpeed: number;
    windDirection: number;
  };
  sourceTag: string;
  trackProgress: number;
  sector: number;
}

export type IssueType = 'high_drag' | 'low_grip' | 'corner_loss';
export type TriggerSource = 'car' | 'wing' | 'wind';

export interface DiagnosticIssue {
  id: string;
  type: IssueType;
  severity: 1 | 2 | 3 | 4 | 5;
  startTime: number;
  endTime: number;
  triggerSource: TriggerSource;
  triggerId: string;
  threshold: number;
  actualValue: number;
  suggestion: string;
  frames: number[];
  trackPosition: number;
}

export interface LapRecord {
  id: string;
  carId: string;
  wingId: string;
  windId: string;
  totalTime: number;
  sectorTimes: [number, number, number];
  maxSpeed: number;
  avgSpeed: number;
  status: 'running' | 'paused' | 'completed' | 'crashed';
  startTime: number;
  endTime: number;
  frameData: FrameData[];
  issues: DiagnosticIssue[];
  carParams: CarParams;
  wingConfig: WingConfig;
  windConfig: WindConfig;
}

export type GameStatus = 'idle' | 'running' | 'paused' | 'finished';

export interface TrackPoint {
  x: number;
  y: number;
  curvature: number;
  sector: number;
}

export interface IntermediateValues {
  airDensity: number;
  dragCoeff: number;
  liftCoeff: number;
  dynamicPressure: number;
  maxCornerSpeed: number;
  requiredGrip: number;
  availableGrip: number;
}
