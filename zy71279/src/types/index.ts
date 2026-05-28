export type Vec3 = [number, number, number];

export interface MeshData {
  vertices: Float32Array;
  faces: Uint32Array;
  normals: Float32Array;
  faceCount: number;
  vertexCount: number;
  boundingBox: { min: Vec3; max: Vec3 };
  name: string;
}

export interface ErrorSample {
  position: Vec3;
  distance: number;
  faceIndex: number;
  normal: Vec3;
}

export enum SimplificationAlgorithm {
  QUADRIC_EDGE_COLLAPSE = 'quadric_edge_collapse',
  CLUSTERING = 'clustering',
  VERTEX_CLUSTERING = 'vertex_clustering',
  MESHDECIMATOR = 'meshdecimator'
}

export interface EstimationParams {
  algorithm: SimplificationAlgorithm;
  targetFaceCount: number;
  errorThreshold: number;
  preserveBorders: boolean;
  preserveNormals: boolean;
}

export interface PrintParams {
  layerHeight: number;
  infillRate: number;
  printSpeed: number;
  wallThickness: number;
  nozzleDiameter: number;
}

export interface MeshQualityResult {
  hasNormalFlip: boolean;
  normalFlipFaces: number[];
  hasHoles: boolean;
  holeBoundaries: number[][];
  nonManifoldEdges: number[];
  degenerateFaces: number[];
  errors: DetailedError[];
}

export interface Material {
  id: string;
  code: string;
  name: string;
  type: string;
  density: number;
  costPerGram: number;
  printSpeed: number;
  nozzleTemp: number;
  bedTemp: number;
  createdAt: Date;
  updatedAt: Date;
  isDuplicateWarning: boolean;
}

export interface EstimationTask {
  id: string;
  modelName: string;
  originalFaces: number;
  simplifiedFaces: number;
  simplificationRatio: number;
  algorithm: SimplificationAlgorithm;
  errorThreshold: number;
  layerHeight: number;
  infillRate: number;
  materialId: string;
  status: 'pending' | 'completed' | 'failed' | 'duplicate';
  errorMessage: string;
  createdAt: Date;
  duplicateCheckHash: string;
  isDuplicate: boolean;
  originalTaskId?: string;
}

export interface ErrorAnalysis {
  id: string;
  taskId: string;
  maxError: number;
  minError: number;
  meanError: number;
  stdDeviation: number;
  errorDistribution: { range: [number, number]; count: number }[];
  maxErrorPoints: { position: Vec3; error: number }[];
  hasNormalFlip: boolean;
  normalFlipCount: number;
  hasHoles: boolean;
  holeCount: number;
  volume: number;
  surfaceArea: number;
  qualityResult: MeshQualityResult;
}

export interface PrintEstimation {
  id: string;
  taskId: string;
  printTimeHours: number;
  materialWeight: number;
  materialCost: number;
  totalCost: number;
  energyConsumption: number;
}

export interface ConstraintCheck {
  id: string;
  taskId: string;
  constraintName: string;
  passed: boolean;
  details: string;
  actualValue: number;
  allowedValue: number;
  severity: 'error' | 'warning' | 'info';
}

export interface Constraint {
  name: string;
  description: string;
  threshold: number;
  severity: 'error' | 'warning' | 'info';
  check: (analysis: ErrorAnalysis, printEst: PrintEstimation) => { passed: boolean; actual: number };
}

export type ViewMode = 'wireframe' | 'solid' | 'heatmap';

export interface DetailedError {
  type: 'normal_flip' | 'hole' | 'error_scale' | 'degenerate_face' | 'non_manifold' | 'other';
  severity: 'error' | 'warning' | 'info';
  message: string;
  location?: Vec3;
  faceIndex?: number;
  details: Record<string, unknown>;
}
