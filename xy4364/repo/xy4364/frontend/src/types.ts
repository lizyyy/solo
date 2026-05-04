export interface Batch {
  id: string;
  batchNumber: string;
  fabricType: string;
  customerName: string;
  targetColor: {
    L: number;
    a: number;
    b: number;
  };
  measuredColor?: {
    L: number;
    a: number;
    b: number;
  };
  deltaE?: number;
  createdAt: number;
  updatedAt: number;
}

export interface TemperatureCurve {
  id: string;
  batchId: string;
  targetCurve: Array<{
    time: number;
    temperature: number;
  }>;
  actualCurve: Array<{
    time: number;
    temperature: number;
  }>;
  temperatureDeviation?: number;
  createdAt: number;
}

export interface Formula {
  id: string;
  batchId: string;
  targetFormula: Array<{
    chemicalName: string;
    dosage: number;
    unit: string;
  }>;
  actualFormula: Array<{
    chemicalName: string;
    dosage: number;
    unit: string;
    added: boolean;
  }>;
  missingChemicals: string[];
  createdAt: number;
}

export interface ReviewRecord {
  id: string;
  batchId: string;
  reviewer: string;
  judgement: 'pass' | 'rework' | 'pending';
  notes?: string;
  reworkPriority?: number;
  reworkReason?: string;
  createdAt: number;
  updatedAt: number;
}

export interface RiskAssessment {
  batchId: string;
  batchNumber: string;
  customerName: string;
  deltaE: number;
  temperatureDeviation: number;
  missingChemicalsCount: number;
  reworkPriority: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface BatchDetail {
  batch: Batch;
  temperatureCurve?: TemperatureCurve;
  formula?: Formula;
  reviewRecord?: ReviewRecord;
  riskAssessment: RiskAssessment;
}
