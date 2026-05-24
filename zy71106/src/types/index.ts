export interface PVComponent {
  id: string;
  name: string;
  group: string;
  position: { x: number; y: number; z: number };
  size: { width: number; height: number };
  rotation: number;
  shadowStats: ShadowStats;
}

export interface ShadowStats {
  totalHours: number;
  shadowHours: number;
  shadowRate: number;
  monthlyData: MonthShadowData[];
}

export interface MonthShadowData {
  month: number;
  shadowHours: number;
  peakShadowHours: number;
}

export interface Tree {
  id: string;
  position: { x: number; y: number; z: number };
  height: number;
  radius: number;
}

export interface Roof {
  width: number;
  depth: number;
  height: number;
  parapetHeight: number;
  slope: number;
}

export interface SolarPosition {
  altitude: number;
  azimuth: number;
  x: number;
  y: number;
  z: number;
}

export interface FilterCondition {
  groups: string[];
  shadowRateMin: number;
  shadowRateMax: number;
}

export interface CameraState {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
}

export interface SceneData {
  roof: Roof;
  trees: Tree[];
  components: PVComponent[];
}

export interface ReportSnapshot {
  time: {
    month: number;
    day: number;
    hour: number;
  };
  camera: CameraState;
  filter: FilterCondition;
  selectedComponents: string[];
  statistics: ReportStatistics;
  sceneImage?: string;
  timestamp: string;
}

export interface ReportStatistics {
  totalComponents: number;
  filteredComponents: number;
  averageShadowRate: number;
  maxShadowRate: number;
  minShadowRate: number;
  totalShadowHours: number;
  componentStats: ComponentStat[];
}

export interface ComponentStat {
  id: string;
  name: string;
  group: string;
  shadowRate: number;
  shadowHours: number;
}

export type ViewPreset = 'overview' | 'top' | 'front' | 'side' | 'birdseye';
