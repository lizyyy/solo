export interface Sprinkler {
  id: string;
  x: number;
  z: number;
  radius: number;
  flowRate: number;
  pressure: number;
  angle: number;
}

export interface Environment {
  slope: number;
  slopeDirection: number;
  windSpeed: number;
  windDirection: number;
  globalPressure: number;
}

export interface MissedZone {
  x: number;
  z: number;
  area: number;
  type: 'corner' | 'gap' | 'slope';
}

export interface CoverageResult {
  totalArea: number;
  coveredArea: number;
  missedArea: number;
  coverageRate: number;
  missedZones: MissedZone[];
  heatmap: Float32Array;
  gridSize: number;
}

export interface FieldConfig {
  width: number;
  height: number;
  resolution: number;
}

export interface ViewPreset {
  name: string;
  position: [number, number, number];
  target: [number, number, number];
}

export interface PresetScenario {
  id: string;
  name: string;
  description: string;
  field: FieldConfig;
  sprinklers: Sprinkler[];
  environment: Environment;
}

export type ViewMode = 'perspective' | 'top' | 'front' | 'side';

export interface AppState {
  sprinklers: Sprinkler[];
  environment: Environment;
  field: FieldConfig;
  coverageResult: CoverageResult | null;
  selectedSprinkler: string | null;
  viewMode: ViewMode;
  isPlaying: boolean;
  timeProgress: number;
  showHeatmap: boolean;
  showMissedZones: boolean;
  showSprinklerRanges: boolean;
}
