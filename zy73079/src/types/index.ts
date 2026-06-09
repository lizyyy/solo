export interface InspectionRecord {
  id: string;
  deviceId: string;
  inspectionTime: number;
  inspector: string;
  temperature: number;
  vibration: number;
  rotationSpeed: number;
  cutterWear: number;
  isAlarm: boolean;
  alarmType?: 'temperature' | 'vibration' | 'wear' | null;
  sourceImportId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface JudgementImpact {
  id: string;
  metric: 'temperature' | 'vibration' | 'wear' | 'overall';
  beforeStatus: 'normal' | 'warning' | 'anomaly';
  afterStatus: 'normal' | 'warning' | 'anomaly';
  reason: string;
}

export interface Remark {
  id: string;
  inspectionId: string;
  content: string;
  author: string;
  createdAt: number;
  isSupplementary: boolean;
  supplementaryTime?: number;
  judgementImpacts: JudgementImpact[];
  reportAnchorId?: string;
}

export interface AnomalyAttribution {
  id: string;
  inspectionId: string;
  anomalyType: string;
  rootCause: string;
  confidence: number;
  relatedMetric: 'temperature' | 'vibration' | 'wear';
  calculationVersion: string;
  confirmedBy?: string;
  confirmedAt?: number;
  status: 'pending' | 'confirmed' | 'clarified';
  clarifiedRemarkId?: string;
}

export interface PartReplacement {
  id: string;
  time: number;
  deviceId: string;
  partName: string;
  oldModel: string;
  newModel: string;
  quantity: number;
  operator: string;
  reason: string;
  dataImpactNote: string;
  relatedInspectionIds: string[];
}

export interface ImportLog {
  id: string;
  importTime: number;
  fileName: string;
  totalRecords: number;
  duplicateRecords: number;
  preservedRemarks: number;
  status: 'success' | 'partial' | 'failed';
}

export interface CalculationCriterion {
  version: string;
  updatedAt: number;
  updatedBy: string;
  temperatureThreshold: number;
  vibrationThreshold: number;
  wearThreshold: number;
  formulaDescription: string;
  isActive: boolean;
}

export interface ReportSection {
  id: string;
  title: string;
  content: string;
  createdAt: number;
}

export type StoreStatus = 'normal' | 'warning' | 'anomaly';
