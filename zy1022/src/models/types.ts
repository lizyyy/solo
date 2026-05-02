export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  depth: number;
}

export interface TimeSlot {
  startHour: number;
  endHour: number;
}

export interface Room {
  width: number;
  depth: number;
  height: number;
  name?: string;
}

export interface PlantTray {
  id: string;
  name?: string;
  position: Rect;
  height: number;
  minLuxRequired: number;
  plantType?: string;
}

export interface LightModel {
  id: string;
  name: string;
  power: number;
  beamAngle: number;
  baseLux: number;
  heatLevel: HeatLevel;
  description?: string;
}

export interface LightFixture {
  id: string;
  name?: string;
  modelId: string;
  position: Point3D;
  timeSlots: TimeSlot[];
}

export enum HeatLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export interface ElectricityConfig {
  pricePerKwh: number;
  dailyBudget: number;
}

export interface LightingScenario {
  id: string;
  name: string;
  description?: string;
  room: Room;
  plantTrays: PlantTray[];
  lightModels: LightModel[];
  fixtures: LightFixture[];
  electricity: ElectricityConfig;
}

export interface PointCoverage {
  x: number;
  y: number;
  z: number;
  totalLux: number;
  contributingLights: string[];
  meetsRequirement: boolean;
  requiredLux: number;
}

export interface TrayCoverage {
  trayId: string;
  trayName?: string;
  totalPoints: number;
  coveredPoints: number;
  coverageRatio: number;
  minLux: number;
  maxLux: number;
  avgLux: number;
  darkZones: Point3D[];
  samplePoints: PointCoverage[];
  meetsRequirement: boolean;
}

export interface LightUsage {
  lightId: string;
  lightName?: string;
  modelId: string;
  power: number;
  dailyHours: number;
  dailyKwh: number;
  dailyCost: number;
  timeSlots: TimeSlot[];
}

export interface DailyConsumption {
  totalKwh: number;
  totalCost: number;
  budgetExceeded: boolean;
  budgetExcess: number;
  perLight: LightUsage[];
}

export interface Risk {
  type: RiskType;
  severity: 'low' | 'medium' | 'high';
  message: string;
  details?: Record<string, unknown>;
}

export enum RiskType {
  DARK_ZONE = 'dark_zone',
  OVERLAP_WASTE = 'overlap_waste',
  HEAT_RISK = 'heat_risk',
  TIME_CONFLICT = 'time_conflict',
  BUDGET_EXCEEDED = 'budget_exceeded',
  OUTSIDE_ROOM = 'outside_room',
  INVALID_CONFIG = 'invalid_config',
}

export interface ScoreBreakdown {
  coverage: number;
  costEfficiency: number;
  heatRisk: number;
  scheduling: number;
}

export interface ScoreResult {
  total: number;
  breakdown: ScoreBreakdown;
  maxTotal: number;
  letterGrade: string;
}

export interface EvaluationResult {
  scenarioId: string;
  scenarioName: string;
  trayCoverages: TrayCoverage[];
  overallCoverage: {
    totalPoints: number;
    coveredPoints: number;
    coverageRatio: number;
  };
  consumption: DailyConsumption;
  risks: Risk[];
  score: ScoreResult;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

export interface ValidationWarning {
  field: string;
  message: string;
  value?: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface MarkdownReport {
  format: 'markdown';
  content: string;
}

export interface HtmlReport {
  format: 'html';
  content: string;
}

export type Report = MarkdownReport | HtmlReport;
