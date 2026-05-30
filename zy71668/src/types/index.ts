export interface DroneParams {
  id: string;
  model: string;
  maxTakeoffWeight: number;
  emptyWeight: number;
  batteryCapacity: number;
  batteryVoltage: number;
  maxFlightTime: number;
  cruiseSpeed: number;
  frontalArea: number;
  dragCoefficient: number;
}

export interface WindData {
  speed: number;
  direction: number;
  flightDirection: number;
  altitude: number;
}

export interface PayloadData {
  cameraWeight: number;
  batteryWeight: number;
  accessoriesWeight: number;
  totalWeight: number;
}

export interface BatteryStatus {
  currentCapacity: number;
  cycleCount: number;
  temperature: number;
  health: number;
}

export interface Waypoint {
  id: string;
  lat: number;
  lng: number;
  altitude: number;
  speed: number;
  stayTime: number;
}

export type DataIssueType = 'empty' | 'typo' | 'duplicate' | 'invalid' | 'negative_margin';
export type Severity = 'error' | 'warning' | 'info';

export interface DataIssue {
  id: string;
  type: DataIssueType;
  severity: Severity;
  field: string;
  rowIndex?: number;
  message: string;
  suggestion: string;
  fixed: boolean;
}

export type RiskLevel = 'critical' | 'warning' | 'notice';
export type RiskCategory = 'battery' | 'wind' | 'payload' | 'navigation' | 'data';

export interface RiskItem {
  id: string;
  level: RiskLevel;
  category: RiskCategory;
  title: string;
  description: string;
  source: string;
  formula?: string;
  suggestion: string;
}

export interface CalculationResult {
  id: string;
  timestamp: number;
  droneParams: DroneParams;
  windData: WindData;
  payloadData: PayloadData;
  batteryStatus: BatteryStatus;
  waypoints: Waypoint[];

  baseEnergyConsumption: number;
  basePower: number;
  payloadEnergyImpact: number;
  windResistanceImpact: number;

  dragForce: number;
  dragPower: number;
  headwindComponent: number;
  airDensity: number;

  estimatedFlightTime: number;
  estimatedRange: number;
  returnBatteryThreshold: number;
  remainingBatteryMargin: number;
  totalDistance: number;
  returnDistance: number;

  risks: RiskItem[];
  confidenceScore: number;
}

export interface ChangeItem {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  reason: string;
}

export interface HistoryRecord {
  id: string;
  version: number;
  timestamp: number;
  author: string;
  description: string;
  changes: ChangeItem[];
  calculationResult: CalculationResult;
}

export type TabType = 'workspace' | 'calculator' | 'report' | 'history';

export interface AppState {
  activeTab: TabType;
  droneParams: DroneParams;
  windData: WindData;
  payloadData: PayloadData;
  batteryStatus: BatteryStatus;
  waypoints: Waypoint[];
  dataIssues: DataIssue[];
  calculationResult: CalculationResult | null;
  historyRecords: HistoryRecord[];
  conservativeFactor: number;
  safetyMargin: number;
}

export interface AppActions {
  setActiveTab: (tab: TabType) => void;
  setDroneParams: (params: Partial<DroneParams>) => void;
  setWindData: (data: Partial<WindData>) => void;
  setPayloadData: (data: Partial<PayloadData>) => void;
  setBatteryStatus: (status: Partial<BatteryStatus>) => void;
  setWaypoints: (waypoints: Waypoint[]) => void;
  addWaypoint: (waypoint: Waypoint) => void;
  removeWaypoint: (id: string) => void;
  setDataIssues: (issues: DataIssue[]) => void;
  fixDataIssue: (id: string) => void;
  calculate: () => void;
  setConservativeFactor: (factor: number) => void;
  setSafetyMargin: (margin: number) => void;
  saveToHistory: (author: string, description: string, changes: ChangeItem[]) => void;
  loadFromHistory: (id: string) => void;
  importData: (data: Record<string, unknown>[]) => void;
  reset: () => void;
}

export const DEFAULT_DRONE_PARAMS: DroneParams = {
  id: 'default',
  model: 'DJI Inspire 3',
  maxTakeoffWeight: 3995,
  emptyWeight: 2900,
  batteryCapacity: 4280,
  batteryVoltage: 22.8,
  maxFlightTime: 28,
  cruiseSpeed: 15,
  frontalArea: 0.15,
  dragCoefficient: 0.8,
};

export const DEFAULT_WIND_DATA: WindData = {
  speed: 5,
  direction: 0,
  flightDirection: 90,
  altitude: 100,
};

export const DEFAULT_PAYLOAD_DATA: PayloadData = {
  cameraWeight: 800,
  batteryWeight: 750,
  accessoriesWeight: 100,
  totalWeight: 1650,
};

export const DEFAULT_BATTERY_STATUS: BatteryStatus = {
  currentCapacity: 100,
  cycleCount: 50,
  temperature: 25,
  health: 95,
};

export const DEFAULT_WAYPOINTS: Waypoint[] = [
  { id: 'wp-1', lat: 31.2304, lng: 121.4737, altitude: 100, speed: 12, stayTime: 0 },
  { id: 'wp-2', lat: 31.2354, lng: 121.4837, altitude: 120, speed: 10, stayTime: 30 },
  { id: 'wp-3', lat: 31.2254, lng: 121.4637, altitude: 80, speed: 15, stayTime: 0 },
];

export const DRONE_MODELS: DroneParams[] = [
  {
    id: 'inspire-3',
    model: 'DJI Inspire 3',
    maxTakeoffWeight: 3995,
    emptyWeight: 2900,
    batteryCapacity: 4280,
    batteryVoltage: 22.8,
    maxFlightTime: 28,
    cruiseSpeed: 15,
    frontalArea: 0.15,
    dragCoefficient: 0.8,
  },
  {
    id: 'mavic-3-pro',
    model: 'DJI Mavic 3 Pro',
    maxTakeoffWeight: 958,
    emptyWeight: 895,
    batteryCapacity: 5000,
    batteryVoltage: 15.4,
    maxFlightTime: 43,
    cruiseSpeed: 12,
    frontalArea: 0.05,
    dragCoefficient: 0.6,
  },
  {
    id: 'phantom-4-rtk',
    model: 'DJI Phantom 4 RTK',
    maxTakeoffWeight: 1391,
    emptyWeight: 1294,
    batteryCapacity: 5870,
    batteryVoltage: 15.2,
    maxFlightTime: 30,
    cruiseSpeed: 12,
    frontalArea: 0.08,
    dragCoefficient: 0.7,
  },
  {
    id: 'matrice-300',
    model: 'DJI Matrice 300 RTK',
    maxTakeoffWeight: 9000,
    emptyWeight: 6300,
    batteryCapacity: 5935,
    batteryVoltage: 51.8,
    maxFlightTime: 55,
    cruiseSpeed: 18,
    frontalArea: 0.25,
    dragCoefficient: 0.9,
  },
];
