import type { Point3D, UVPoint } from './surface';

export type IssueType = 'normal_reversed' | 'boundary_gap' | 'sample_sparse';
export type Severity = 'warning' | 'error' | 'info';

export interface IssueLocation {
  materialId: string;
  position?: Point3D;
  uvRange?: UVPoint[];
  parameterRange?: [number, number];
  region?: string;
  vertexIndices?: number[];
}

export interface DiagnosisIssue {
  id: string;
  type: IssueType;
  severity: Severity;
  message: string;
  location: IssueLocation;
  suggestion: string;
  nextStep: string;
  detectedAt: number;
  resolved?: boolean;
  resolvedAt?: number;
  evidence: {
    before?: any;
    after?: any;
    parameters: Record<string, any>;
  };
}

export interface DiagnosisResult {
  issues: DiagnosisIssue[];
  summary: {
    totalIssues: number;
    byType: Record<IssueType, number>;
    byMaterial: Record<string, number>;
  };
}

export interface QualityThresholds {
  minSampleDensity: number;
  maxNormalAngleDeviation: number;
  maxBoundaryGap: number;
}
