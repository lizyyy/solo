export type Vector3 = [number, number, number];

export type RiskLevel = 'safe' | 'warning' | 'danger';

export type VehicleType = 'car' | 'suv' | 'van' | 'truck';

export type Unit = 'm' | 'cm';

export interface Garage {
  id: string;
  name: string;
  entrances: Entrance[];
  ramps: Ramp[];
  beams: Beam[];
  signs: Sign[];
}

export interface Entrance {
  id: string;
  name: string;
  position: Vector3;
  minHeight: number;
  hasSign: boolean;
}

export interface Ramp {
  id: string;
  points: Vector3[];
  width: number;
  slope: number;
  transitionPoints: TransitionPoint[];
}

export interface TransitionPoint {
  id: string;
  position: Vector3;
  measuredHeight: number;
  riskLevel: RiskLevel;
}

export interface Beam {
  id: string;
  position: Vector3;
  size: Vector3;
  bottomHeight: number;
}

export interface Sign {
  id: string;
  entranceId: string;
  position: Vector3;
  height: number;
  text: string;
}

export interface Vehicle {
  id: string;
  name: string;
  type: VehicleType;
  height: number;
  width: number;
  length: number;
  unit: Unit;
}

export interface HeightReport {
  garageId: string;
  vehicleId: string;
  checkTime: Date;
  overallResult: 'pass' | 'fail' | 'warning';
  riskPoints: RiskPoint[];
  measurements: Measurement[];
  missingSigns: string[];
}

export interface RiskPoint {
  id: string;
  location: string;
  position: Vector3;
  clearHeight: number;
  vehicleHeight: number;
  delta: number;
  level: 'warning' | 'danger';
  description: string;
}

export interface Measurement {
  id: string;
  position: Vector3;
  clearHeight: number;
  groundHeight: number;
  ceilingHeight: number;
}

export interface CameraPreset {
  id: string;
  name: string;
  position: Vector3;
  target: Vector3;
}

export interface SimulationState {
  isPlaying: boolean;
  progress: number;
  currentPosition: Vector3;
  speed: number;
}

export interface AppState {
  selectedGarage: Garage | null;
  selectedVehicle: Vehicle | null;
  simulation: SimulationState;
  riskPoints: RiskPoint[];
  currentReport: HeightReport | null;
  cameraPreset: string;
  showRiskMarkers: boolean;
  showMeasurements: boolean;
}
