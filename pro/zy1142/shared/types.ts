export type PhysicsProblemType = 'incline' | 'projectile' | 'spring';

export interface PhysicsParameter {
  name: string;
  label: string;
  unit: string;
  value: number;
  description?: string;
  min?: number;
  max?: number;
}

export interface PhysicsProblem {
  id: string;
  type: PhysicsProblemType;
  title: string;
  description: string;
  parameters: PhysicsParameter[];
  createdAt: number;
  updatedAt: number;
  notes?: string;
}

export interface PhysicsSolution {
  problemId: string;
  problemType: PhysicsProblemType;
  parameters: PhysicsParameter[];
  equations: Equation[];
  derivations: DerivationStep[];
  substitutions: SubstitutionStep[];
  results: CalculationResult[];
  trajectory: TrajectoryPoint[];
  keyQuantities: KeyQuantity[];
  diagrams: DiagramInfo[];
  finalAnswers: FinalAnswer[];
}

export interface Equation {
  id: string;
  latex: string;
  description: string;
  type: 'definition' | 'principle' | 'derived';
}

export interface DerivationStep {
  step: number;
  equation: string;
  latex: string;
  explanation: string;
  rule?: string;
}

export interface SubstitutionStep {
  step: number;
  equation: string;
  latex: string;
  values: { [key: string]: number };
  explanation: string;
}

export interface CalculationResult {
  name: string;
  label: string;
  value: number;
  unit: string;
  description?: string;
  significantFigures?: number;
}

export interface TrajectoryPoint {
  time: number;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  ax?: number;
  ay?: number;
  extension?: number;
  velocity?: number;
  acceleration?: number;
}

export interface KeyQuantity {
  name: string;
  label: string;
  value: number;
  unit: string;
  phase?: string;
}

export interface DiagramInfo {
  type: 'force' | 'coordinate' | 'trajectory' | 'spring';
  description: string;
}

export interface FinalAnswer {
  label: string;
  value: number;
  unit: string;
  latex: string;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: number;
  rule?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  normalizedParams?: PhysicsParameter[];
}

export interface ProblemRecord {
  id: string;
  type: PhysicsProblemType;
  title: string;
  description: string;
  parameters: PhysicsParameter[];
  solution?: PhysicsSolution;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export type ExportFormat = 'markdown' | 'html' | 'json';

export interface ExportOptions {
  format: ExportFormat;
  includeDerivations: boolean;
  includeTrajectory: boolean;
  includeDiagrams: boolean;
}
