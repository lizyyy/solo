export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface TrajectoryPoint extends Point3D {
  timestamp: number;
  speed?: number;
}

export interface TerrainData {
  heightmap: number[][];
  width: number;
  depth: number;
  scale: number;
  unit: 'meter' | 'feet';
}

export interface Trajectory {
  id: string;
  skierName: string;
  points: TrajectoryPoint[];
  color: string;
}

export interface FallPoint {
  id: string;
  position: Point3D;
  timestamp: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  skierName: string;
}

export interface RescueStation {
  id: string;
  name: string;
  position: Point3D;
  responseTime: number;
  personnel: number;
}

export interface RiskZone {
  id: string;
  name: string;
  level: 'low' | 'medium' | 'high';
  polygon: Point3D[];
  isClosed: boolean;
  reason: string;
}

export interface RescueRoute {
  id: string;
  name: string;
  points: Point3D[];
  fromStation: string;
  toPoint: string;
  estimatedTime: number;
  color: string;
}

export interface Weather {
  condition: 'sunny' | 'cloudy' | 'snowy' | 'windy';
  temperature: number;
  windSpeed: number;
  visibility: number;
  timestamp: string;
}

export type ValidationErrorType = 
  | 'elevation_unit' 
  | 'trajectory_out_of_bounds' 
  | 'route_through_closed_zone';

export interface ValidationError {
  type: ValidationErrorType;
  severity: 'error' | 'warning';
  message: string;
  location?: Point3D;
  details?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface SceneData {
  terrain: TerrainData;
  trajectories: Trajectory[];
  fallPoints: FallPoint[];
  rescueStations: RescueStation[];
  riskZones: RiskZone[];
  rescueRoutes: RescueRoute[];
  weather: Weather;
  validation: ValidationResult;
}

export interface LayerVisibility {
  terrain: boolean;
  trajectories: boolean;
  fallPoints: boolean;
  rescueStations: boolean;
  riskZones: boolean;
  rescueRoutes: boolean;
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  speed: number;
}

export interface CameraView {
  position: Point3D;
  target: Point3D;
}

export type CameraPreset = 'overview' | 'top' | 'side' | 'closeup';
