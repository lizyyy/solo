export interface TowerCraneConfig {
  id: string;
  name: string;
  position: { x: number; z: number };
  height: number;
  maxRadius: number;
  minRadius: number;
  maxWeight: number;
  weightRadiusCurve: Array<{ radius: number; maxWeight: number }>;
  currentAngle: number;
  currentRadius: number;
}

export interface Building {
  id: string;
  name: string;
  position: { x: number; z: number };
  dimensions: { width: number; depth: number; height: number };
  color: string;
}

export interface DangerZone {
  id: string;
  name: string;
  type: 'restricted' | 'warning' | 'safe';
  shape: 'circle' | 'rectangle';
  position: { x: number; z: number };
  radius?: number;
  dimensions?: { width: number; depth: number };
  occupied: boolean;
}

export interface LiftObject {
  weight: number;
  startPosition: { x: number; z: number };
  endPosition: { x: number; z: number };
  currentProgress: number;
  liftHeight: number;
}

export interface Environment {
  windSpeed: number;
  maxAllowedWindSpeed: number;
  timeOfDay: 'day' | 'night';
}

export interface Risk {
  id: string;
  type: 'radius_exceeded' | 'weight_exceeded' | 'wind_exceeded' | 'zone_occupied' | 'collision';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
}

export type ViewMode = 'free' | 'top' | 'side' | 'firstPerson';

export interface SceneState {
  crane: TowerCraneConfig;
  buildings: Building[];
  dangerZones: DangerZone[];
  liftObject: LiftObject;
  environment: Environment;
  risks: Risk[];
  isPlaying: boolean;
  currentTime: number;
  selectedView: ViewMode;
  showReportModal: boolean;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
}

export interface SampleScene {
  id: string;
  name: string;
  description: string;
  sceneData: Omit<SceneState, 'isPlaying' | 'currentTime' | 'selectedView' | 'showReportModal' | 'leftPanelOpen' | 'rightPanelOpen'>;
}
