export interface Mold {
  id: string;
  name: string;
  color: string;
  category: string;
}

export interface Order {
  id: string;
  name: string;
  moldId: string;
  productionTime: number;
  quantity: number;
  deadline: number;
  delayPenalty: number;
}

export interface Level {
  id: number;
  name: string;
  description: string;
  molds: Mold[];
  orders: Order[];
  targetCost: number;
  initialMoldId: string;
  sameCategoryCleanTime: number;
  crossCategoryCleanTime: number;
  changeoverFixedCost: number;
  laborCostPerMinute: number;
  idleCostPerMinute: number;
}

export type ProductionEventType = 'start' | 'changeover' | 'cleaning' | 'produce' | 'complete' | 'delay';

export interface ProductionEvent {
  type: ProductionEventType;
  time: number;
  orderId?: string;
  moldId?: string;
  cost: number;
  description: string;
}

export interface GameCosts {
  total: number;
  changeover: number;
  cleaning: number;
  idle: number;
  delay: number;
}

export type GameStatus = 'idle' | 'scheduling' | 'running' | 'paused' | 'completed' | 'failed';

export interface GameState {
  levelId: number;
  status: GameStatus;
  scheduledOrders: string[];
  currentTime: number;
  currentMoldId: string;
  currentOrderIndex: number;
  currentPhase: 'idle' | 'cleaning' | 'producing' | 'waiting';
  phaseStartTime: number;
  phaseDuration: number;
  costs: GameCosts;
  completedOrders: string[];
  events: ProductionEvent[];
  failReason?: string;
  speed: number;
}

export interface GameHistory {
  id: string;
  levelId: number;
  timestamp: number;
  finalCost: number;
  targetCost: number;
  score: string;
  scheduledOrders: string[];
  events: ProductionEvent[];
  isWin: boolean;
}

export interface LevelProgress {
  completed: boolean;
  bestScore: string;
  bestCost: number;
  stars: number;
}

export type ScoreRating = 'S' | 'A' | 'B' | 'C' | 'D';

export interface ScheduleBar {
  orderId: string;
  startTime: number;
  endTime: number;
  color: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'delayed';
}
