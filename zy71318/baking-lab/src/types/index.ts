export interface MoldMaterial {
  id: string;
  name: string;
  thermalConductivity: number;
  specificHeat: number;
  density: number;
  thickness: number;
  color: string;
  source: string;
  sourceUrl?: string;
}

export interface CakeDimensions {
  diameter: number;
  height: number;
}

export interface SimulationParams {
  id: string;
  materialId: string;
  ovenTemperature: number;
  initialTemperature: number;
  cakeDimensions: CakeDimensions;
  timeStep: number;
  totalTime: number;
}

export interface TemperaturePoint {
  time: number;
  temperature: number;
}

export interface SimulationResult {
  id: string;
  params: SimulationParams;
  material: MoldMaterial;
  temperatureCurve: TemperaturePoint[];
  maxTemperature: number;
  timeToTargetTemp: number | null;
  createdAt: number;
  status: 'pending' | 'running' | 'completed' | 'error';
  errorMessage?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export type SimulationStatus = 'idle' | 'running' | 'completed';

export interface WorkspaceState {
  simulations: SimulationResult[];
  selectedSimulations: string[];
  status: SimulationStatus;
  currentSimulation: SimulationResult | null;
}
