export type UnitType = 'm' | 'cm' | 'mm' | 'm³/h' | 'm³/s' | 'mg/m³' | 'ppm' | 'Pa';

export type StoveType = 'wok' | 'fryer' | 'grill' | 'steamer' | 'oven';

export type ExhaustType = 'hood' | 'wall' | 'ceiling';

export type AnomalyCategory = 'data' | 'rule' | 'material';

export type AnomalySeverity = 'error' | 'warning' | 'info';

export interface Point2D {
  x: number;
  y: number;
}

export interface Dimensions {
  width: number;
  height: number;
  unit: UnitType;
}

export interface Position {
  x: number;
  y: number;
  z?: number;
  unit: UnitType;
}

export interface Stove {
  id: string;
  name: string;
  type: StoveType;
  position: Position;
  dimensions: Dimensions;
  fumeEmissionRate: number;
  heatOutput: number;
  enabled: boolean;
}

export interface ExhaustVent {
  id: string;
  name: string;
  type: ExhaustType;
  position: Position;
  dimensions: Dimensions;
  airflowRate: number;
  captureEfficiency: number;
  enabled: boolean;
}

export interface DetectionPoint {
  id: string;
  name: string;
  position: Position;
  threshold?: number;
}

export interface Obstacle {
  id: string;
  name: string;
  position: Position;
  dimensions: Dimensions;
  permeability: number;
}

export interface VersionInfo {
  version: string;
  createdAt: string;
  createdBy: string;
  modifiedAt: string;
  modifiedBy: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  comments: string[];
}

export interface KitchenLayout {
  id: string;
  name: string;
  description?: string;
  dimensions: Dimensions;
  gridResolution: number;
  stoves: Stove[];
  exhaustVents: ExhaustVent[];
  detectionPoints: DetectionPoint[];
  obstacles: Obstacle[];
  version: VersionInfo;
  metadata?: Record<string, string>;
}

export interface GridCell {
  x: number;
  y: number;
  concentration: number;
  velocity: Point2D;
  temperature: number;
}

export interface SimulationResult {
  layoutId: string;
  layoutName: string;
  version: string;
  timestamp: string;
  gridSize: { width: number; height: number };
  gridResolution: number;
  cells: GridCell[];
  detectionPointResults: DetectionPointResult[];
  overallStats: SimulationStats;
  anomalies: Anomaly[];
  simulationTime: number;
}

export interface DetectionPointResult {
  id: string;
  name: string;
  position: Position;
  concentration: number;
  threshold?: number;
  exceeded: boolean;
}

export interface SimulationStats {
  maxConcentration: number;
  avgConcentration: number;
  minConcentration: number;
  concentrationStdDev: number;
  exhaustEfficiency: number;
  totalAirflow: number;
  totalEmission: number;
}

export interface Anomaly {
  id: string;
  category: AnomalyCategory;
  severity: AnomalySeverity;
  field?: string;
  message: string;
  suggestion: string;
  value?: any;
  expected?: any;
}

export interface ValidationRule {
  id: string;
  name: string;
  category: AnomalyCategory;
  severity: AnomalySeverity;
  field?: string;
  validate: (layout: KitchenLayout) => Anomaly | null;
}

export interface HeatmapConfig {
  colorScheme: 'viridis' | 'plasma' | 'rainbow' | 'red-blue';
  minValue?: number;
  maxValue?: number;
  showLegend: boolean;
  showGrid: boolean;
}

export interface ReportConfig {
  format: 'html' | 'markdown' | 'json';
  includeHeatmap: boolean;
  includeStats: boolean;
  includeAnomalies: boolean;
  includeDetectionPoints: boolean;
}

export type ComparisonResult = {
  layout1Id: string;
  layout2Id: string;
  layout1Name: string;
  layout2Name: string;
  differences: {
    field: string;
    value1: any;
    value2: any;
  }[];
  statDifferences: {
    metric: string;
    value1: number;
    value2: number;
    change: number;
    changePercent: number;
  }[];
};
