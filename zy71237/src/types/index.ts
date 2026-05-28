export type ArtworkType = 'canvas' | 'paper' | 'scroll';
export type ActionCategory = 'cleaning' | 'retouching' | 'reinforcing';
export type RiskLevel = 'low' | 'medium' | 'high';
export type GamePhase = 'intro' | 'playing' | 'result';
export type Grade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

export interface Artwork {
  id: string;
  name: string;
  description: string;
  imageType: ArtworkType;
  initialStain: number;
  initialPaintLayer: number;
  initialStructure: number;
  timeBudget: number;
  materials: string[];
  creationEra: string;
  paintComposition: string;
  difficulty: 'easy' | 'hard';
  imageColors: {
    base: string;
    accent: string;
    detail: string;
  };
}

export interface DataGap {
  id: string;
  field: keyof Artwork | 'unknown';
  displayName: string;
  hint: string;
  detectCost: number;
  resolved: boolean;
  actualValue: string;
}

export interface ActionEffects {
  stainDelta?: number;
  paintLayerDelta?: number;
  structureDelta?: number;
}

export interface ActionRisks {
  materialIncompatibility?: string[];
  overCleaningChance?: number;
  paintDamageChance?: number;
  structureDamageChance?: number;
}

export interface RestorationAction {
  id: string;
  category: ActionCategory;
  name: string;
  description: string;
  riskLevel: RiskLevel;
  timeCost: number;
  effects: ActionEffects;
  risks: ActionRisks;
  materialRequirements: string[];
}

export interface StateSnapshot {
  stain: number;
  paintLayer: number;
  structure: number;
  remainingTime: number;
}

export interface HistoryEntry {
  id: string;
  timestamp: number;
  actionType: ActionCategory;
  actionName: string;
  riskLevel: RiskLevel;
  stateBefore: StateSnapshot;
  stateAfter: StateSnapshot;
  feedback: string;
  consequences: string[];
  materialsUsed: string[];
}

export interface FinalScore {
  appearance: number;
  structure: number;
  materialCompatibility: number;
  timeEfficiency: number;
  riskControl: number;
  total: number;
  grade: Grade;
}

export interface GameState {
  currentPhase: GamePhase;
  selectedArtwork: Artwork | null;
  currentStain: number;
  currentPaintLayer: number;
  currentStructure: number;
  remainingTime: number;
  history: HistoryEntry[];
  dataGaps: DataGap[];
  selectedAction: RestorationAction | null;
  finalScore: FinalScore | null;
  usedMaterials: string[];
  riskEvents: string[];
  showRiskPreview: boolean;
}

export interface ActionResult {
  newState: Partial<GameState>;
  feedback: string;
  consequences: string[];
  riskOccurred: boolean;
}

export interface MaterialCompatibility {
  compatible: boolean;
  issues: string[];
}

export interface RestorationReport {
  artworkName: string;
  artworkDescription: string;
  initialState: StateSnapshot;
  finalState: StateSnapshot;
  history: HistoryEntry[];
  score: FinalScore;
  dataGapsResolved: number;
  dataGapsTotal: number;
  riskEvents: string[];
  materialsUsed: string[];
  timestamp: number;
}

export type GameAction =
  | { type: 'START_GAME'; payload: { artwork: Artwork; dataGaps: DataGap[] } }
  | { type: 'SELECT_ACTION'; payload: RestorationAction | null }
  | { type: 'TOGGLE_RISK_PREVIEW'; payload: boolean }
  | { type: 'EXECUTE_ACTION'; payload: { action: RestorationAction; result: ActionResult } }
  | { type: 'DETECT_GAP'; payload: { gapId: string; cost: number } }
  | { type: 'FINISH_GAME'; payload: FinalScore }
  | { type: 'RESET_GAME' };
