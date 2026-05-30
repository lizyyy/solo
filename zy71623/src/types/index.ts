export interface Point {
  x: number;
  y: number;
}

export interface PolygonBlock {
  id: string;
  name: string;
  vertices: Point[];
  area: number;
  weight: number;
  strength: number;
  color: string;
}

export interface BridgePier {
  id: string;
  position: Point;
  height: number;
  width: number;
}

export interface Truck {
  id: string;
  weight: number;
  position: Point;
  speed: number;
}

export interface PlacedPolygon {
  instanceId: string;
  blockId: string;
  position: Point;
  rotation: number;
  vertices: Point[];
}

export interface Level {
  id: string;
  name: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  areaBudget: number;
  requiredStrength: number;
  piers: BridgePier[];
  availableBlocks: PolygonBlock[];
  truck: Truck;
  startPoint: Point;
  endPoint: Point;
  bridgeWidth: number;
  bridgeHeight: number;
}

export type ValidationErrorType = 
  | 'area_exceeded' 
  | 'not_connected' 
  | 'overlap' 
  | 'not_closed'
  | 'no_bridge'
  | 'gap_detected';

export interface ValidationError {
  type: ValidationErrorType;
  message: string;
  polygonId?: string;
  details: Record<string, any>;
}

export interface ValidationWarning {
  type: string;
  message: string;
  details?: Record<string, any>;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export type PolygonState = 'normal' | 'stressed' | 'broken';

export interface PolygonStateData {
  instanceId: string;
  state: PolygonState;
  stress: number;
}

export interface ReplayFrame {
  time: number;
  truckPosition: Point;
  polygonStates: PolygonStateData[];
}

export interface SimulationResult {
  success: boolean;
  maxLoad: number;
  maxStress: number;
  failurePoint?: Point;
  failureReason?: string;
  failureTime?: number;
  stressMap: Record<string, number>;
  replayData: ReplayFrame[];
  totalDistance: number;
}

export interface GameRecord {
  id: string;
  levelId: string;
  levelName: string;
  timestamp: number;
  success: boolean;
  usedArea: number;
  areaBudget: number;
  maxStress: number;
  failureReason?: string;
  placedPolygons: PlacedPolygon[];
}

export interface ReportData {
  level: Level;
  validationResult: ValidationResult;
  simulationResult: SimulationResult;
  usedArea: number;
  efficiency: number;
  suggestions: string[];
}
