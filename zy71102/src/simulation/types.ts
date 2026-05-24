export interface Point {
  x: number;
  y: number;
}

export interface Wall {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Stair {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  direction: 'up' | 'down';
  capacity: number;
}

export interface Gate {
  id: string;
  x: number;
  y: number;
  type: 'entry' | 'exit' | 'both';
  status: 'open' | 'closed';
  speed: number;
}

export interface Exit {
  id: string;
  x: number;
  y: number;
  width: number;
  name: string;
}

export interface Platform {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PassengerBatch {
  id: string;
  startTime: number;
  count: number;
  spawnX: number;
  spawnY: number;
  speed: number;
}

export interface ClosedArea {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  reason: string;
}

export interface StationLayout {
  width: number;
  height: number;
  walls: Wall[];
  stairs: Stair[];
  gates: Gate[];
  exits: Exit[];
  platforms: Platform[];
}

export interface StationScene {
  id: string;
  name: string;
  description: string;
  layout: StationLayout;
  passengerBatches: PassengerBatch[];
  closedAreas: ClosedArea[];
}

export type PassengerStatus = 'moving' | 'waiting' | 'stuck' | 'exited';

export interface Passenger {
  id: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  status: PassengerStatus;
  speed: number;
  path: Point[];
  pathIndex: number;
  waitTime: number;
  spawnTime: number;
  exitTime: number | null;
  exitId: string | null;
}

export type BottleneckType = 'stair' | 'gate' | 'corridor';
export type BottleneckSeverity = 'low' | 'medium' | 'high';

export interface Bottleneck {
  id: string;
  type: BottleneckType;
  x: number;
  y: number;
  severity: BottleneckSeverity;
  queueLength: number;
  avgWaitTime: number;
  relatedId?: string;
}

export interface TimePoint {
  time: number;
  totalPassengers: number;
  exitedCount: number;
  waitingCount: number;
  stuckCount: number;
}

export interface Statistics {
  totalPassengers: number;
  exitedCount: number;
  waitingCount: number;
  stuckCount: number;
  avgEvacuationTime: number;
  maxWaitTime: number;
  bottleneckRanking: Bottleneck[];
  timeSeriesData: TimePoint[];
  completionRate: number;
}

export interface SimulationState {
  isPlaying: boolean;
  currentTime: number;
  speed: number;
  passengers: Passenger[];
  bottlenecks: Bottleneck[];
  statistics: Statistics;
  selectedScene: StationScene | null;
  is2DMode: boolean;
  cameraView: 'default' | 'top' | 'angle' | 'firstPerson';
}

export const GRID_SIZE = 0.5;
export const PASSENGER_RADIUS = 0.3;
export const BOTTLENECK_THRESHOLD = {
  low: 3,
  medium: 6,
  high: 10
};
