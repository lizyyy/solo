export interface GreenhouseParams {
  width: number;
  length: number;
  height: number;
}

export interface PlantParams {
  rowSpacing: number;
  plantSpacing: number;
  plantHeight: number;
  canopyDiameter: number;
  rowsCount: number;
  plantsPerRow: number;
}

export interface RobotPath {
  enabled: boolean;
  width: number;
  position: number;
}

export interface LightParams {
  sunAngle: number;
  sunIntensity: number;
  timeOfDay: number;
}

export interface CameraState {
  position: [number, number, number];
  target: [number, number, number];
}

export interface ValidationResult {
  pathWidthOk: boolean;
  minPathWidth: number;
  actualPathWidth: number;
  canopyOverlap: boolean;
  lightCoverage: number;
  warnings: string[];
}

export interface SimulationState {
  greenhouse: GreenhouseParams;
  plants: PlantParams;
  robotPath: RobotPath;
  light: LightParams;
  camera: CameraState;
  validation: ValidationResult;
  heatmapData: number[][];
  showHeatmap: boolean;
  currentView: ViewPreset;
}

export interface ExportReport {
  timestamp: string;
  params: {
    greenhouse: GreenhouseParams;
    plants: PlantParams;
    robotPath: RobotPath;
    light: LightParams;
  };
  camera: CameraState;
  currentView: string;
  validation: ValidationResult;
  heatmapSummary: {
    avg: number;
    min: number;
    max: number;
  };
}

export type ViewPreset = 'overview' | 'side' | 'top' | 'front';

export interface SamplePreset {
  id: string;
  name: string;
  description: string;
  greenhouse: GreenhouseParams;
  plants: PlantParams;
  robotPath: RobotPath;
}
