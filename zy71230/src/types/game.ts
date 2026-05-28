import type { Tour, Stop, MerchItem, DecisionLog, RiskEvent, StopResult, GamePhase } from './tour';

export type StopPhase = 'risk_check' | 'show' | 'settled';

export interface GameState {
  currentTour: Tour | null;
  stops: Stop[];
  merchItems: MerchItem[];
  currentStopIndex: number;
  currentStopPhase: StopPhase;
  gamePhase: GamePhase;
  cashFlow: number;
  totalRevenue: number;
  totalExpense: number;
  riskIndex: number;
  decisions: DecisionLog[];
  riskEvents: RiskEvent[];
  stopResults: StopResult[];
  isPaused: boolean;
  isGameOver: boolean;
  gameOverReason?: string;
  dailySalesRate: Record<string, number>;
}

export interface GameActions {
  startTour: (tour: Tour, stops: Stop[], merchItems: MerchItem[]) => void;
  processStop: (stopId: string, results: StopResult) => void;
  recordDecision: (decision: Omit<DecisionLog, 'id' | 'createdAt'>) => void;
  recordRiskEvent: (event: Omit<RiskEvent, 'id' | 'triggeredAt'>) => void;
  resolveRisk: (riskId: string, optionId?: string) => void;
  dismissRisk: (riskId: string, impact: { cashFlow: number; description: string }) => void;
  updateCashFlow: (amount: number) => void;
  updateMerchStock: (merchItemId: string, quantityChange: number) => void;
  updateRiskIndex: (delta: number) => void;
  setCurrentStopIndex: (index: number) => void;
  setCurrentStopPhase: (phase: StopPhase) => void;
  goToPhase: (phase: GamePhase) => void;
  setPaused: (paused: boolean) => void;
  endGame: (reason?: string) => void;
  resetGame: () => void;
  loadGame: (state: GameState) => void;
}

export interface AlternativePath {
  decisionPointId: string;
  stopId: string;
  alternativeOptionId: string;
  alternativeOptionName: string;
  simulatedResult: {
    finalCashFlow: number;
    totalRevenue: number;
    totalExpense: number;
    netProfit: number;
    risksAvoided: string[];
    risksCreated: string[];
    isSuccess: boolean;
  };
}

export interface GameStats {
  totalStops: number;
  completedStops: number;
  successfulStops: number;
  totalRiskEvents: number;
  highRiskEvents: number;
  decisionsMade: number;
  averageDecisionRisk: number;
  bestPerformingStop: string | null;
  worstPerformingStop: string | null;
}
