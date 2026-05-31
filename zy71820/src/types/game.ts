export interface Product {
  id: string;
  name: string;
  baseCost: number;
  basePrice: number;
  emoji: string;
}

export interface Customer {
  id: string;
  name: string;
  patience: number;
  budget: number;
  preferences: string[];
  emoji: string;
}

export interface LevelConfig {
  id: string;
  name: string;
  duration: number;
  products: Product[];
  customers: Customer[];
  source: 'draft' | 'player_feedback';
  contact: string;
  createdAt: number;
  updatedAt: number;
  version: string;
}

export type CustomerState = 'walking' | 'waiting' | 'ordering' | 'leaving' | 'happy';

export interface CustomerInstance {
  id: string;
  customerId: string;
  x: number;
  y: number;
  targetX: number;
  state: CustomerState;
  patience: number;
  maxPatience: number;
  order?: string;
  waitTime: number;
  budget: number;
  emoji: string;
}

export interface GameState {
  levelId: string;
  timeRemaining: number;
  score: number;
  satisfaction: number;
  inventory: Record<string, number>;
  prices: Record<string, number>;
  customers: CustomerInstance[];
  isPaused: boolean;
  isGameOver: boolean;
  totalCustomersServed: number;
  totalCustomersLost: number;
  revenue: number;
  costs: number;
}

export interface GameSaveState {
  id: string;
  gameState: GameState;
  savedAt: number;
  isDisconnected: boolean;
}
