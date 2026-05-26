export interface Position {
  x: number;
  y: number;
}

export interface Restaurant {
  id: string;
  name: string;
  position: Position;
  oilPerTurn: number;
  barrelCapacity: number;
  currentOil: number;
}

export interface Station {
  id: string;
  name: string;
  position: Position;
}

export interface Truck {
  capacity: number;
  currentLoad: number;
  position: Position;
  maxDistancePerTurn: number;
}

export interface GameEvent {
  id: string;
  title: string;
  description: string;
  type: 'positive' | 'negative' | 'neutral';
  effect: {
    type: 'oil_increase' | 'complaint' | 'capacity_change' | 'road_block' | 'bonus_score';
    value: number;
    target?: string;
  };
}

export interface RouteNode {
  type: 'restaurant' | 'station';
  id: string;
  position: Position;
}

export interface TurnAction {
  turn: number;
  route: RouteNode[];
  totalDistance: number;
  collectedOil: Record<string, number>;
  complaints: number;
  scoreThisTurn: number;
  restaurantStates: Array<{
    id: string;
    currentOil: number;
    isOverflowing: boolean;
  }>;
  event?: GameEvent;
}

export interface Level {
  id: string;
  name: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  description: string;
  maxTurns: number;
  maxComplaints: number;
  targetScore: number;
  gridSize: { width: number; height: number };
  restaurants: Array<Omit<Restaurant, 'currentOil'>>;
  station: Station;
  truck: Omit<Truck, 'position'>;
  eventProbability: number;
  isBoundaryCase?: boolean;
  boundaryDescription?: string;
}

export interface GameState {
  level: Level | null;
  restaurants: Restaurant[];
  station: Station | null;
  truck: Truck | null;
  currentTurn: number;
  score: number;
  complaints: number;
  isPaused: boolean;
  isGameOver: boolean;
  isWin: boolean;
  failureReason?: string;
  currentEvent?: GameEvent;
  plannedRoute: RouteNode[];
  turnHistory: TurnAction[];
  gamePhase: 'menu' | 'playing' | 'settlement' | 'replay';
  replayTurnIndex: number;
  isAnimating: boolean;
}

export interface GameHistory {
  id: string;
  timestamp: string;
  levelId: string;
  levelName: string;
  isWin: boolean;
  finalScore: number;
  totalTurns: number;
  maxTurns: number;
  failureReason: string | null;
  turns: TurnAction[];
  initialRestaurants: Restaurant[];
}

export interface ScoreBreakdown {
  baseScore: number;
  efficiencyBonus: number;
  capacityBonus: number;
  overflowPenalty: number;
  complaintPenalty: number;
  turnBonus: number;
  total: number;
}
