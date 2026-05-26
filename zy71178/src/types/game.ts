export interface Position {
  x: number;
  y: number;
}

export type RobotStatus = 'idle' | 'moving' | 'charging' | 'picking' | 'dead';

export interface Robot {
  id: string;
  name: string;
  position: Position;
  targetPosition?: Position;
  battery: number;
  status: RobotStatus;
  path: Position[];
  pathIndex: number;
  moveProgress: number;
  currentOrderId?: string;
  color: string;
}

export interface Shelf {
  id: string;
  position: Position;
  hasGoods: boolean;
  goodsType?: string;
}

export type OrderStatus = 'pending' | 'in_progress' | 'completed' | 'timeout';

export interface OrderItem {
  shelfId: string;
  quantity: number;
  picked: boolean;
}

export interface Order {
  id: string;
  items: OrderItem[];
  createdAt: number;
  deadline: number;
  status: OrderStatus;
  assignedRobotId?: string;
}

export type ObstacleType = 'wall' | 'pillar';

export interface Obstacle {
  id: string;
  position: Position;
  type: ObstacleType;
}

export interface ChargingStation {
  id: string;
  position: Position;
}

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Level {
  id: string;
  name: string;
  difficulty: Difficulty;
  description: string;
  gridSize: { width: number; height: number };
  robots: Robot[];
  shelves: Shelf[];
  obstacles: Obstacle[];
  chargingStations: ChargingStation[];
  orders: Order[];
  timeLimit: number;
}

export type GameEventType = 
  | 'move' 
  | 'collision' 
  | 'pick' 
  | 'charge' 
  | 'order_complete' 
  | 'battery_dead'
  | 'order_timeout'
  | 'invalid_path';

export interface GameEvent {
  timestamp: number;
  type: GameEventType;
  data: Record<string, any>;
}

export type Rating = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

export interface Score {
  baseScore: number;
  efficiencyBonus: number;
  collisionPenalty: number;
  timeoutPenalty: number;
  batteryPenalty: number;
  invalidPathPenalty: number;
  total: number;
  rating: Rating;
}

export interface GameRecord {
  id: string;
  levelId: string;
  startTime: number;
  endTime: number;
  score: Score;
  events: GameEvent[];
  finalState: {
    robots: Robot[];
    orders: Order[];
  };
}

export type GameSpeed = 1 | 2 | 4;

export interface GameState {
  level: Level | null;
  gameSpeed: GameSpeed;
  isPaused: boolean;
  isGameOver: boolean;
  isPlaying: boolean;
  
  robots: Robot[];
  orders: Order[];
  
  selectedRobotId: string | null;
  hoveredPosition: Position | null;
  previewPath: Position[];
  
  gameTime: number;
  realTime: number;
  
  score: Score;
  collisionCount: number;
  timeoutCount: number;
  batteryDeadCount: number;
  invalidPathCount: number;
  
  events: GameEvent[];
  currentRecordId: string | null;
}

export interface GameActions {
  startGame: (levelId: string) => void;
  pauseGame: () => void;
  resumeGame: () => void;
  restartGame: () => void;
  endGame: () => void;
  setGameSpeed: (speed: GameSpeed) => void;
  selectRobot: (robotId: string | null) => void;
  setHoveredPosition: (pos: Position | null) => void;
  assignTarget: (robotId: string, target: Position) => void;
  assignOrder: (robotId: string, orderId: string) => void;
  tick: (deltaTime: number) => void;
}
