export interface TimePoint {
  hour: number;
  minute: number;
}

export interface TimeRange {
  start: TimePoint;
  end: TimePoint;
}

export interface Camera {
  id: string;
  name: string;
  powerConsumption: number;
  compatibleBatteryTypes: string[];
}

export interface Battery {
  id: string;
  name: string;
  type: string;
  capacity: number;
  initialCharge: number;
  currentCharge: number;
  status: BatteryStatus;
  assignedTo?: string;
  chargingPort?: string;
}

export type BatteryStatus = 'idle' | 'in_use' | 'charging' | 'low' | 'critical';

export interface Charger {
  id: string;
  name: string;
  ports: ChargingPort[];
}

export interface ChargingPort {
  id: string;
  chargerId: string;
  name: string;
  compatibleBatteryTypes: string[];
  chargingSpeed: number;
  occupiedBy?: string;
}

export interface Scene {
  id: string;
  name: string;
  timeRange: TimeRange;
  cameras: SceneCameraAssignment[];
  notes?: string;
}

export interface SceneCameraAssignment {
  cameraId: string;
  batteryId?: string;
}

export interface ShootingSchedule {
  id: string;
  name: string;
  date: string;
  scenes: Scene[];
  cameras: Camera[];
  batteries: Battery[];
  chargers: Charger[];
}

export interface SimulationConfig {
  lowBatteryThreshold: number;
  criticalBatteryThreshold: number;
  timeStepMinutes: number;
}

export type RiskType = 'battery_critical' | 'battery_low' | 'port_conflict' | 'cross_scene_late' | 'simultaneous_use' | 'battery_depleted';

export interface Risk {
  id: string;
  type: RiskType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  time: TimePoint;
  description: string;
  details: Record<string, unknown>;
  sceneId?: string;
}

export interface BatterySnapshot {
  batteryId: string;
  charge: number;
  status: BatteryStatus;
  assignedTo?: string;
  chargingPort?: string;
}

export interface TimeStepState {
  time: TimePoint;
  batterySnapshots: BatterySnapshot[];
  activeScenes: string[];
  risks: Risk[];
  chargingPortUsage: Record<string, string | undefined>;
}

export interface SimulationResult {
  schedule: ShootingSchedule;
  config: SimulationConfig;
  timeSteps: TimeStepState[];
  allRisks: Risk[];
  isMidnightCrossing: boolean;
}

export interface ManualAdjustment {
  id: string;
  timestamp: number;
  type: 'assign_battery' | 'unassign_battery' | 'assign_charger' | 'unassign_charger';
  details: Record<string, unknown>;
}

export interface AppState {
  currentSchedule: ShootingSchedule;
  simulationResult?: SimulationResult;
  selectedScene?: string;
  selectedBattery?: string;
  history: ManualAdjustment[];
  historyIndex: number;
  isSimulating: boolean;
}

export type AppAction =
  | { type: 'LOAD_SCHEDULE'; payload: ShootingSchedule }
  | { type: 'RUN_SIMULATION'; payload: SimulationResult }
  | { type: 'SELECT_SCENE'; payload: string | undefined }
  | { type: 'SELECT_BATTERY'; payload: string | undefined }
  | { type: 'APPLY_ADJUSTMENT'; payload: ManualAdjustment }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'SET_SIMULATING'; payload: boolean };
