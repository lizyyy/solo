export type GameStatus = 'menu' | 'levelSelect' | 'playing' | 'paused' | 'settlement' | 'replay';

export type NodeType = 'start' | 'normal' | 'supply' | 'end';

export type ItemType = 'medicine' | 'bandage' | 'tool';

export type HistoryAction = 'move' | 'supply' | 'event' | 'inventory';

export interface TeamState {
  health: number;
  maxHealth: number;
  actionPoints: number;
  maxActionPoints: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  type: ItemType;
  weight: number;
  quantity: number;
  expiryTurn?: number;
  isExpired: boolean;
  description: string;
}

export interface SupplyItem extends InventoryItem {
  price?: number;
}

export interface MapNode {
  id: string;
  name: string;
  x: number;
  y: number;
  type: NodeType;
  connections: string[];
  supplyItems?: SupplyItem[];
  description?: string;
  isCritical?: boolean;
}

export interface EventChoice {
  text: string;
  effect: {
    health?: number;
    actionPoints?: number;
    score?: number;
    removeItems?: string[];
    addItems?: InventoryItem[];
  };
}

export interface GameEvent {
  id: string;
  title: string;
  description: string;
  choices: EventChoice[];
  probability: number;
  icon: string;
}

export interface ActiveEvent extends GameEvent {
  triggeredAt: number;
}

export interface ScorePenalty {
  reason: string;
  amount: number;
}

export interface ScoreBreakdown {
  total: number;
  baseScore: number;
  timeBonus: number;
  healthBonus: number;
  inventoryBonus: number;
  noExpiredBonus: number;
  supplyVisitedBonus: number;
  eventChoicesBonus: number;
  penalties: ScorePenalty[];
}

export interface HistoryStep {
  turn: number;
  action: HistoryAction;
  nodeId?: string;
  eventId?: string;
  choiceIndex?: number;
  inventorySnapshot: InventoryItem[];
  teamState: TeamState;
  scoreSnapshot: number;
  timestamp: number;
}

export interface Level {
  id: string;
  name: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  maxWeight: number;
  maxTurns: number;
  nodes: MapNode[];
  startInventory: InventoryItem[];
  startNode: string;
  endNode: string;
  criticalSupplyNodes?: string[];
  eventPool: string[];
  eventChance: number;
}

export interface ReplayData {
  version: string;
  levelId: string;
  levelName: string;
  timestamp: number;
  duration: number;
  finalScore: ScoreBreakdown;
  isWin: boolean;
  failReason?: string;
  steps: HistoryStep[];
}

export interface GameState {
  status: GameStatus;
  currentLevel: Level | null;
  turn: number;
  maxTurns: number;
  team: TeamState;
  inventory: InventoryItem[];
  currentNode: string;
  visitedNodes: string[];
  activeEvent: ActiveEvent | null;
  history: HistoryStep[];
  score: ScoreBreakdown;
  isWin: boolean;
  failReason: string | null;
  gameStartTime: number;
  replayData: ReplayData | null;
  replayStepIndex: number;
}

export interface GameActions {
  startGame: (level: Level) => void;
  pauseGame: () => void;
  resumeGame: () => void;
  restartGame: () => void;
  endGame: () => void;
  endTurn: () => void;
  moveToNode: (nodeId: string) => void;
  canUseEventChoice: (choiceIndex: number) => { canUse: boolean; missingItems: string[] };
  handleEventChoice: (choiceIndex: number) => void;
  discardItem: (itemId: string, quantity: number) => void;
  supplyItem: (itemId: string) => void;
  checkWinCondition: () => void;
  calculateFinalScore: () => ScoreBreakdown;
  saveReplayData: () => void;
  goToMenu: () => void;
  goToLevelSelect: () => void;
  startReplay: (replayData: ReplayData) => void;
  replayNextStep: () => void;
  replayPrevStep: () => void;
  replayGoToStep: (index: number) => void;
  exportReport: () => string;
}
