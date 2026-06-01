export interface Resources {
  buses: number;
  drivers: number;
  budget: number;
  reputation: number;
}

export type EventType = 'normal' | 'emergency' | 'rework';

export interface EventOption {
  id: string;
  text: string;
  resourceCost: Partial<Resources>;
  isCorrect: boolean;
  scoreChange: number;
  feedback: string;
  ruleReference: string;
}

export interface GameEvent {
  id: string;
  title: string;
  description: string;
  type: EventType;
  options: EventOption[];
  ruleHint?: string;
}

export interface MaterialPackage {
  id: string;
  name: string;
  description: string;
  source: string;
  createdAt: string;
  createdBy: string;
  isSample: boolean;
  gameDuration: number;
  initialResources: Resources;
  events: GameEvent[];
}

export type GameStatus = 'playing' | 'completed' | 'failed';
export type FailureType = 'rule_misunderstanding' | 'timeout';

export interface DecisionRecord {
  eventId: string;
  eventTitle: string;
  selectedOptionId: string;
  selectedOptionText: string;
  isCorrect: boolean;
  scoreChange: number;
  timeTaken: number;
  timestamp: string;
  ruleReference: string;
}

export interface GameState {
  id: string;
  materialId: string;
  materialName: string;
  startTime: string;
  endTime?: string;
  status: GameStatus;
  failureType?: FailureType;
  currentEventIndex: number;
  resources: Resources;
  score: number;
  decisions: DecisionRecord[];
  totalTimeUsed: number;
}

export interface AdjustmentItem {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  reason: string;
}

export interface SupplementRecord {
  gameId: string;
  supplementedAt: string;
  supplementedBy: string;
  notes: string;
  originalScore: number;
  adjustedScore?: number;
  adjustments: AdjustmentItem[];
}

export type ValidationErrorType = 'empty_level' | 'duplicate_event' | 'resource_out_of_bounds' | 'missing_correct_option';

export interface ValidationError {
  type: ValidationErrorType;
  message: string;
  location?: string;
  suggestion: string;
}

export interface ValidationWarning {
  type: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}
