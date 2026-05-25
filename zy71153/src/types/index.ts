export type SupplyType = 'water' | 'medicine' | 'tent';

export interface Supply {
  type: SupplyType;
  name: string;
  weight: number;
  emoji: string;
}

export interface SupplyInventory {
  water: number;
  medicine: number;
  tent: number;
}

export type NodeType = 'warehouse' | 'shelter' | 'junction';

export interface MapNode {
  id: string;
  type: NodeType;
  name: string;
  x: number;
  y: number;
  demand?: SupplyInventory;
  received?: SupplyInventory;
}

export type RoadStatus = 'clear' | 'congested' | 'blocked';

export interface Road {
  id: string;
  from: string;
  to: string;
  distance: number;
  status: RoadStatus;
  baseTime: number;
}

export type VehicleStatus = 'idle' | 'loading' | 'moving' | 'delivering' | 'returning';

export interface Vehicle {
  id: string;
  name: string;
  maxCapacity: number;
  currentLoad: SupplyInventory;
  currentWeight: number;
  status: VehicleStatus;
  currentNode: string;
  targetNodes: string[];
  progress: number;
  speed: number;
}

export type EventType = 'weather' | 'road_block' | 'demand_surge' | 'supply_loss';

export interface GameEvent {
  id: string;
  type: EventType;
  title: string;
  description: string;
  timestamp: number;
  affectedRoad?: string;
  affectedNode?: string;
  resolved: boolean;
}

export type WeatherType = 'sunny' | 'rainy' | 'stormy';

export type GamePhase = 'planning' | 'executing' | 'paused' | 'finished';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface LevelConfig {
  id: string;
  name: string;
  difficulty: Difficulty;
  description: string;
  initialSupplies: SupplyInventory;
  nodes: MapNode[];
  roads: Road[];
  vehicles: Vehicle[];
  maxTurns: number;
  timeLimit: number;
  eventProbability: number;
}

export type ActionType = 'load' | 'unload' | 'route' | 'start' | 'event';

interface LoadPayload {
  vehicleId: string;
  type: SupplyType;
  amount: number;
  isOverload: boolean;
}

interface UnloadPayload {
  vehicleId: string;
}

interface RoutePayload {
  vehicleId: string;
  route: string[];
}

interface StartPayload {
  turn: number;
}

interface EventPayload {
  eventId: string;
  eventType: EventType;
  title: string;
  description: string;
  affectedRoad?: string;
  affectedNode?: string;
  effect: {
    roadsChanged: boolean;
    nodesChanged: boolean;
    vehiclesChanged: boolean;
    weatherChanged: boolean;
  };
}

export type ActionPayload = LoadPayload | UnloadPayload | RoutePayload | StartPayload | EventPayload;

export interface ActionRecord {
  turn: number;
  timestamp: number;
  type: ActionType;
  payload: ActionPayload;
}

export function isLoadPayload(payload: ActionPayload): payload is LoadPayload {
  return 'type' in payload && 'amount' in payload;
}

export function isRoutePayload(payload: ActionPayload): payload is RoutePayload {
  return 'route' in payload;
}

export function isStartPayload(payload: ActionPayload): payload is StartPayload {
  return 'turn' in payload;
}

export function isEventPayload(payload: ActionPayload): payload is EventPayload {
  return 'eventType' in payload;
}

export interface ScoreDetail {
  category: string;
  score: number;
  maxScore: number;
  description: string;
}

export interface GameState {
  levelId: string;
  phase: GamePhase;
  turn: number;
  maxTurns: number;
  weather: WeatherType;
  warehouseSupplies: SupplyInventory;
  nodes: MapNode[];
  roads: Road[];
  vehicles: Vehicle[];
  events: GameEvent[];
  selectedVehicle: string | null;
  selectedRoute: string[];
  eventLog: string[];
  startTime: number;
  elapsedTime: number;
  isPaused: boolean;
  actionHistory: ActionRecord[];
  score: number;
  scoreDetails: ScoreDetail[];
  failReason?: string;
}

export interface HistoryRecord {
  id: string;
  levelId: string;
  levelName: string;
  difficulty: Difficulty;
  score: number;
  completedAt: number;
  elapsedTime: number;
  turns: number;
  isWin: boolean;
  actionHistory: ActionRecord[];
  finalState: GameState;
}

export interface SupplyConfig {
  type: SupplyType;
  name: string;
  weight: number;
  emoji: string;
}

export const SUPPLY_CONFIGS: SupplyConfig[] = [
  { type: 'water', name: '饮用水', weight: 1, emoji: '💧' },
  { type: 'medicine', name: '药品', weight: 0.5, emoji: '💊' },
  { type: 'tent', name: '帐篷', weight: 3, emoji: '⛺' },
];
