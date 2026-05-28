export type Unit = 'mm' | 'cm' | 'in';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type IssueStatus = 'discovered' | 'corrected' | 'confirmed';

export type IssueType =
  | 'temp_diff_sign'
  | 'material_missing'
  | 'unit_mixed'
  | 'high_stress'
  | 'excessive_shrinkage'
  | 'cooling_issue'
  | 'bed_temp_issue'
  | 'other';

export interface Material {
  id: string;
  name: string;
  thermalExpansionCoeff: number;
  glassTransitionTemp: number;
  meltingTemp: number;
  adhesionStrength: number;
  recommendedBedTemp: number;
  recommendedNozzleTemp: number;
  heatResistance: number;
  warpResistance: number;
}

export interface PrintBatch {
  id: string;
  materialId: string;
  bedTemp: number;
  nozzleTemp: number;
  ambientTemp: number;
  modelWidth: number;
  modelHeight: number;
  modelDepth: number;
  widthUnit: Unit;
  heightUnit: Unit;
  depthUnit: Unit;
  coolingFanSpeed: number;
  layerHeight: number;
  printSpeed: number;
  createdAt: string;
  status: 'draft' | 'analyzed' | 'confirmed';
  createdBy: string;
}

export interface ValidationError {
  type: 'temp_diff_sign' | 'material_missing' | 'unit_mixed';
  field?: string;
  message: string;
  details: Record<string, unknown>;
  autoFixable: boolean;
}

export interface StressPoint {
  x: number;
  y: number;
  value: number;
  riskLevel: RiskLevel;
  detailRowId: string;
}

export interface TemperaturePoint {
  layer: number;
  nozzle: number;
  bed: number;
  ambient: number;
}

export interface StressResult {
  id: string;
  batchId: string;
  temperatureDiff: number;
  tempDiffSign: number;
  shrinkageRate: number;
  totalShrinkage: number;
  stressRiskScore: number;
  riskLevel: RiskLevel;
  stressDistribution: StressPoint[][];
  temperatureCurve: TemperaturePoint[];
  shrinkageByDimension: {
    width: number;
    height: number;
    depth: number;
  };
  coolingRate: number;
  validationErrors: ValidationError[];
  analysisTime: string;
}

export interface IssueTrack {
  id: string;
  batchId: string;
  issueType: IssueType;
  description: string;
  detailRowId?: string;
  stressPoint?: { x: number; y: number };
  discoveredBy: string;
  discoveredAt: string;
  status: IssueStatus;
  correctionId?: string;
}

export interface Correction {
  id: string;
  issueTrackId: string;
  suggestion: string;
  adjustedParams: Partial<PrintBatch>;
  expectedImprovement: number;
  correctedBy: string;
  correctedAt: string;
  confirmationResult?: 'pass' | 'fail';
  confirmedBy?: string;
  confirmedAt?: string;
  notes?: string;
}

export interface Suggestion {
  id: string;
  type: 'bed_temp' | 'cooling' | 'material' | 'dimension' | 'environment';
  title: string;
  description: string;
  parameter: string;
  currentValue: string;
  recommendedValue: string;
  expectedImprovement: number;
}

export interface ComparisonItem {
  batchId: string;
  batchName: string;
  material: string;
  bedTemp: number;
  nozzleTemp: number;
  stressRiskScore: number;
  shrinkageRate: number;
  riskLevel: RiskLevel;
  status: string;
}

export interface ReportData {
  batchId: string;
  generatedAt: string;
  analysisSummary: {
    material: string;
    riskLevel: RiskLevel;
    stressScore: number;
    shrinkageRate: number;
    keyIssues: string[];
  };
  corrections: Correction[];
  issues: IssueTrack[];
  confirmedBy?: string;
  confirmedAt?: string;
}
