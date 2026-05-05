export interface Node {
  id: string;
  name: string;
  type: 'building' | 'unit' | 'branch';
  parentId?: string;
  x: number;
  y: number;
}

export interface Pipe {
  id: string;
  name: string;
  fromNodeId: string;
  toNodeId: string;
  diameter: number;
  length: number;
  roughness: number;
  flowRate?: number;
  pressureDrop?: number;
}

export interface Valve {
  id: string;
  name: string;
  pipeId: string;
  opening: number;
  kvValue: number;
  notes?: string;
}

export interface PumpCurvePoint {
  flowRate: number;
  head: number;
}

export interface PumpCurve {
  id: string;
  name: string;
  points: PumpCurvePoint[];
  maxFlowRate: number;
  maxHead: number;
  efficiency?: number;
}

export interface TemperatureData {
  nodeId: string;
  supplyTemp: number;
  returnTemp: number;
  timestamp: string;
}

export interface CalculationStep {
  step: number;
  description: string;
  inputs: Record<string, number>;
  outputs: Record<string, number>;
  formula: string;
}

export interface AbnormalData {
  type: 'valve' | 'temperature' | 'pressure' | 'flow';
  location: string;
  currentValue: number;
  expectedRange: { min: number; max: number };
  severity: 'low' | 'medium' | 'high';
  suggestion: string;
}

export interface AdjustmentSuggestion {
  valveId: string;
  valveName: string;
  currentOpening: number;
  suggestedOpening: number;
  adjustmentAmount: number;
  priority: 'high' | 'medium' | 'low';
  reasoning: string;
}

export interface CalculationResult {
  id: string;
  projectId: string;
  timestamp: string;
  totalFlowRate: number;
  systemPressureDrop: number;
  operatingPoint: { flowRate: number; head: number };
  pipeResults: {
    pipeId: string;
    flowRate: number;
    velocity: number;
    pressureDrop: number;
    reynoldsNumber: number;
  }[];
  valveResults: {
    valveId: string;
    pressureDrop: number;
    flowCoefficient: number;
    isBalanced: boolean;
  }[];
  steps: CalculationStep[];
  abnormalData: AbnormalData[];
  suggestions: AdjustmentSuggestion[];
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  nodes: Node[];
  pipes: Pipe[];
  valves: Valve[];
  pumpCurve: PumpCurve;
  temperatureData: TemperatureData[];
  userNotes?: string;
  lastCalculationResult?: CalculationResult;
}

export interface ProjectListItem {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  nodeCount: number;
  pipeCount: number;
  valveCount: number;
  hasCalculation: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: string[];
  warnings?: string[];
}
