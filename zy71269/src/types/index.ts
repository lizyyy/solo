export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface PowerPoint {
  id: string;
  name: string;
  position: Position;
  power: number;
  temperature: number;
  status: 'normal' | 'warning' | 'critical';
}

export interface TempSensor {
  id: string;
  name: string;
  position: Position;
  temperature: number;
  isMissing: boolean;
  expectedLocation: string;
  lastCalibration: string;
}

export interface HeatSink {
  id: string;
  type: string;
  finCount: number;
  baseThickness: number;
  material: string;
  thermalResistance: number;
}

export interface AirChannel {
  id: string;
  name: string;
  direction: Position;
  speed: number;
  isReversed: boolean;
  inletTemp: number;
  outletTemp: number;
}

export interface Anomaly {
  id: string;
  type: 'color_scale' | 'missing_sensor' | 'wind_reversed';
  severity: 'low' | 'medium' | 'high';
  message: string;
  location?: Position;
  relatedItemId?: string;
}

export interface VersionEntry {
  version: string;
  timestamp: string;
  author: string;
  changes: string;
}

export interface ChipPackage {
  id: string;
  name: string;
  dimensions: { width: number; height: number; depth: number };
  powerPoints: PowerPoint[];
  tempSensors: TempSensor[];
  heatSinks: HeatSink[];
  airChannels: AirChannel[];
  versionHistory: VersionEntry[];
}

export interface ThermalReport {
  id: string;
  timestamp: string;
  summary: {
    maxTemp: number;
    minTemp: number;
    avgTemp: number;
    hotspotCount: number;
  };
  anomalies: Anomaly[];
  screenshot: string;
  powerPoints: PowerPoint[];
  sensors: TempSensor[];
}

export interface FilterConditions {
  tempRange: [number, number];
  powerRange: [number, number];
  showOnlyAnomalies: boolean;
}

export interface SectionPlane {
  axis: 'x' | 'y' | 'z' | null;
  position: number;
}

export interface ColorScale {
  min: number;
  max: number;
  colors: string[];
}
