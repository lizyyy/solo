export interface Position {
  x: number;
  y: number;
  z?: number;
}

export interface Size {
  width: number;
  depth: number;
  height?: number;
}

export interface Hall {
  id: string;
  name: string;
  dimensions: Size;
  gridSize: number;
  entrances: Entrance[];
  exits: Exit[];
  walls: Wall[];
  pillars: Pillar[];
  fixedObstacles: FixedObstacle[];
}

export interface Entrance {
  id: string;
  name: string;
  position: Position;
  size: Size;
  isMain: boolean;
}

export interface Exit {
  id: string;
  name: string;
  position: Position;
  size: Size;
  isEmergency: boolean;
}

export interface Wall {
  id: string;
  position: Position;
  size: Size;
}

export interface Pillar {
  id: string;
  position: Position;
  size: Size;
}

export interface FixedObstacle {
  id: string;
  name: string;
  position: Position;
  size: Size;
}

export interface Booth {
  id: string;
  name: string;
  type: BoothType;
  position: Position;
  size: Size;
  rotation: number;
  isPopular: boolean;
  powerDemand: number;
  powerZoneId?: string;
  contactName?: string;
  contactPhone?: string;
  notes?: string;
  props: Prop[];
}

export type BoothType = 
  | 'standard'
  | 'corner'
  | 'island'
  | 'double'
  | 'premium'
  | 'stage'
  | 'info_desk'
  | 'food'
  | 'sponsor'
  | 'other';

export interface Prop {
  id: string;
  name: string;
  type: PropType;
  position: Position;
  size: Size;
  powerDemand?: number;
}

export type PropType =
  | 'display_rack'
  | 'table'
  | 'chair'
  | 'tv_monitor'
  | 'sign'
  | 'banner'
  | 'demo_equipment'
  | 'other';

export interface FlowZone {
  id: string;
  name: string;
  position: Position;
  size: Size;
  expectedFootTraffic: number;
  priority: 'high' | 'medium' | 'low';
}

export interface PowerZone {
  id: string;
  name: string;
  position: Position;
  size: Size;
  maxPower: number;
  circuitBreakers: CircuitBreaker[];
}

export interface CircuitBreaker {
  id: string;
  name: string;
  maxPower: number;
}

export interface Plan {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  hall: Hall;
  booths: Booth[];
  flowZones: FlowZone[];
  powerZones: PowerZone[];
}

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low';

export interface ValidationResult {
  ruleId: string;
  ruleName: string;
  category: ValidationCategory;
  passed: boolean;
  riskLevel: RiskLevel;
  message: string;
  details?: string;
  affectedObjects?: AffectedObject[];
  location?: Position;
}

export type ValidationCategory =
  | 'safety'
  | 'flow'
  | 'power'
  | 'layout'
  | 'compliance';

export interface AffectedObject {
  id: string;
  type: 'booth' | 'prop' | 'exit' | 'entrance' | 'zone' | 'other';
  name: string;
}

export interface PlanComparison {
  planA: PlanSummary;
  planB: PlanSummary;
  differences: ComparisonDifference[];
  recommendations: string[];
}

export interface PlanSummary {
  id: string;
  name: string;
  totalBooths: number;
  totalPowerDemand: number;
  totalValidationErrors: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
}

export interface ComparisonDifference {
  category: string;
  metric: string;
  planAValue: number | string;
  planBValue: number | string;
  winner?: 'A' | 'B' | 'none';
}

export interface LayoutReport {
  planId: string;
  planName: string;
  generatedAt: Date;
  hallInfo: Hall;
  boothsSummary: {
    total: number;
    byType: Record<BoothType, number>;
    popularCount: number;
    totalPowerDemand: number;
  };
  validationResults: ValidationResult[];
  summary: {
    totalIssues: number;
    byLevel: Record<RiskLevel, number>;
    byCategory: Record<ValidationCategory, number>;
  };
  recommendations: string[];
}

export type ReportFormat = 'markdown' | 'html' | 'json';

export type ViewMode = '3d' | 'topdown';

export interface AppState {
  currentPlan: Plan | null;
  selectedBoothId: string | null;
  viewMode: ViewMode;
  validationResults: ValidationResult[];
  isLoading: boolean;
}
