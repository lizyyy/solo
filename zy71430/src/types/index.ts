
export interface Mineral {
  id: string;
  name: string;
  nameCn: string;
  spectrum: number[];
  value: number;
  color: string;
  source: string;
  version: string;
}

export interface Equipment {
  id: string;
  name: string;
  type: 'scanner' | 'drill' | 'transport';
  powerCost: number;
  efficiency: number;
  icon: string;
  description: string;
}

export interface MineCell {
  id: string;
  x: number;
  y: number;
  status: 'unknown' | 'scanned' | 'mined';
  mineral: Mineral | null;
  mineralType: string | null;
  playerGuess: string | null;
  isCorrect: boolean | null;
  minedQuantity: number;
}

export interface InventoryItem {
  mineralId: string;
  mineralName: string;
  quantity: number;
  isMixed: boolean;
  unitValue: number;
}

export interface OperationRecord {
  timestamp: number;
  type: 'scan' | 'guess' | 'mine' | 'inventory';
  cellId: string;
  cellPosition: { x: number; y: number };
  equipment: string;
  powerCost: number;
  result: {
    mineralType?: string;
    playerGuess?: string;
    isCorrect?: boolean;
    quantity?: number;
    scoreChange?: number;
  };
}

export interface GameState {
  phase: 'playing' | 'ended';
  power: number;
  maxPower: number;
  score: number;
  mineGrid: MineCell[][];
  inventory: InventoryItem[];
  inventoryCapacity: number;
  currentInventory: number;
  selectedEquipment: string | null;
  selectedCell: string | null;
  operationHistory: OperationRecord[];
  gameStartTime: number;
  gameEndTime: number | null;
  gameVersion: string;
  rulesVersion: string;
  messages: GameMessage[];
  powerHistory: { time: number; power: number }[];
}

export interface GameMessage {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  text: string;
  timestamp: number;
}

export interface ScoreBreakdown {
  totalScore: number;
  correctMining: {
    count: number;
    score: number;
    details: { mineral: string; quantity: number; value: number }[];
  };
  wrongGuess: {
    count: number;
    penalty: number;
    details: { cell: string; guessed: string; actual: string }[];
  };
  mixedInventory: {
    count: number;
    penalty: number;
    details: { mineral: string; quantity: number }[];
  };
  powerEfficiency: {
    remainingPower: number;
    bonus: number;
  };
  finalVerdict: 'success' | 'failed' | 'partial';
  reasons: string[];
}

export type FilterType = 'all' | 'scan' | 'guess' | 'mine' | 'inventory';
