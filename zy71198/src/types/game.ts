export type GameStatus = 'menu' | 'playing' | 'paused' | 'ended';
export type VehicleStatus = 'idle' | 'moving' | 'repairing' | 'returning';
export type LampStatus = 'normal' | 'broken' | 'assigned' | 'repairing' | 'repaired' | 'timeout';
export type Priority = 'low' | 'normal' | 'high' | 'critical';
export type ActionType = 'dispatch' | 'cancel' | 'repair' | 'timeout' | 'waste' | 'bonus' | 'base' | 'route';

export interface Point {
  x: number;
  y: number;
}

export interface Node {
  id: string;
  x: number;
  y: number;
  type: 'intersection' | 'lamp' | 'depot';
  lampId?: string;
}

export interface Edge {
  id: string;
  from: string;
  to: string;
  distance: number;
  cost: number;
}

export interface Vehicle {
  id: string;
  name: string;
  status: VehicleStatus;
  currentNodeId: string;
  targetNodeId: string | null;
  path: string[];
  pathIndex: number;
  progress: number;
  speed: number;
  spareParts: number;
  maxSpareParts: number;
  targetLampId: string | null;
  repairProgress: number;
  emptyTime: number;
  routeCost: number;
  routeDistance: number;
}

export interface StreetLamp {
  id: string;
  nodeId: string;
  x: number;
  y: number;
  status: LampStatus;
  priority: Priority;
  timeRemaining: number;
  maxTime: number;
  repairCost: number;
  repairTime: number;
  baseScore: number;
  assignedVehicleId: string | null;
}

export interface SpareParts {
  total: number;
  used: number;
  wasted: number;
}

export interface ScoreBreakdown {
  baseScore: number;
  priorityBonus: number;
  timeBonus: number;
  errorPenalty: number;
  timeoutPenalty: number;
  wastePenalty: number;
  routeCostPenalty: number;
}

export interface RouteDetail {
  vehicleId: string;
  vehicleName: string;
  lampId: string;
  path: string[];
  distance: number;
  cost: number;
  costPenalty: number;
}

export interface ActionRecord {
  timestamp: number;
  gameTime: number;
  type: ActionType;
  vehicleId?: string;
  lampId?: string;
  details: string;
  scoreChange: number;
}

export interface GameState {
  id: string;
  status: GameStatus;
  level: number;
  score: number;
  timeRemaining: number;
  gameSpeed: number;
  isPaused: boolean;
  vehicles: Vehicle[];
  lamps: StreetLamp[];
  nodes: Node[];
  edges: Edge[];
  depotNodeId: string;
  spareParts: SpareParts;
  scoreBreakdown: ScoreBreakdown;
  actions: ActionRecord[];
  routeDetails: RouteDetail[];
  selectedVehicleId: string | null;
  selectedLampId: string | null;
  hoveredLampId: string | null;
  gameStartTime: number;
  failureReason: string | null;
}

export interface HistoryRecord {
  id: string;
  timestamp: number;
  finalScore: number;
  grade: string;
  level: number;
  scoreBreakdown: ScoreBreakdown;
  failureReason?: string;
  actions: ActionRecord[];
  routeDetails: RouteDetail[];
  totalTime: number;
}
