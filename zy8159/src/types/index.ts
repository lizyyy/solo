export type CellType = 'floor' | 'wall' | 'exit' | 'case';

export type GamePhase = 'planning' | 'playerAction' | 'guardAction' | 'eventPhase' | 'riskCheck' | 'gameOver';

export type GameResult = 'inProgress' | 'victory' | 'defeat' | 'timeout';

export interface Position {
  x: number;
  y: number;
}

export interface Artifact {
  id: string;
  name: string;
  value: number;
  weight: number;
  caseId: string;
  isCollected: boolean;
  isSecured: boolean;
}

export interface DisplayCase {
  id: string;
  position: Position;
  isLocked: boolean;
  unlockTurns: number;
  artifactId: string | null;
}

export interface Custodian {
  id: string;
  name: string;
  position: Position;
  maxLoad: number;
  currentLoad: number;
  carriedArtifacts: string[];
  canMove: boolean;
  isSelected: boolean;
}

export interface Guard {
  id: string;
  name: string;
  position: Position;
  patrolRoute: Position[];
  currentRouteIndex: number;
  viewRange: number;
  direction: 'up' | 'down' | 'left' | 'right';
}

export interface EventCard {
  id: string;
  name: string;
  description: string;
  type: 'positive' | 'negative' | 'neutral';
  triggerTurns: number[];
  duration: number;
  isActive: boolean;
  turnsRemaining: number;
}

export interface Risk {
  id: string;
  type: 'routeConflict' | 'timeout' | 'guardDetection' | 'powerFailure';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  relatedEntities: string[];
}

export interface LogEntry {
  turn: number;
  timestamp: number;
  type: 'info' | 'warning' | 'danger' | 'success';
  message: string;
  details?: string;
}

export interface MapConfig {
  width: number;
  height: number;
  grid: CellType[][];
  exitPositions: Position[];
}

export interface GameConfig {
  map: MapConfig;
  artifacts: Artifact[];
  displayCases: DisplayCase[];
  custodians: Custodian[];
  guards: Guard[];
  eventCards: EventCard[];
  maxTurns: number;
  totalArtifactsToSecure: number;
}

export interface GameState {
  turn: number;
  phase: GamePhase;
  result: GameResult;
  isPowerOutage: boolean;
  powerOutageTurnsRemaining: number;
  custodians: Custodian[];
  guards: Guard[];
  displayCases: DisplayCase[];
  artifacts: Artifact[];
  activeEvents: EventCard[];
  risks: Risk[];
  logs: LogEntry[];
  securedArtifactsCount: number;
  totalArtifactsToSecure: number;
  maxTurns: number;
}

export interface MoveAction {
  custodianId: string;
  from: Position;
  to: Position;
}

export interface UnlockAction {
  custodianId: string;
  caseId: string;
}

export interface CollectAction {
  custodianId: string;
  artifactId: string;
  caseId: string;
}

export interface DepositAction {
  custodianId: string;
  artifactId: string;
  exitPosition: Position;
}

export interface ReplayAction {
  turn: number;
  actionType: 'move' | 'unlock' | 'collect' | 'deposit' | 'endTurn';
  action: MoveAction | UnlockAction | CollectAction | DepositAction | null;
  custodianId?: string;
  timestamp: number;
}

export interface ReplayData {
  gameId: string;
  startTime: number;
  endTime: number;
  initialConfig: GameConfig;
  actions: ReplayAction[];
  finalState: GameState;
}

export interface ReviewReport {
  gameId: string;
  date: string;
  result: GameResult;
  totalTurns: number;
  securedArtifacts: number;
  totalArtifacts: number;
  custodianStats: {
    custodianId: string;
    name: string;
    movesMade: number;
    artifactsCollected: number;
    artifactsDeposited: number;
  }[];
  eventsEncountered: {
    turn: number;
    eventName: string;
    eventType: string;
  }[];
  risksDetected: {
    turn: number;
    riskType: string;
    severity: string;
    description: string;
  }[];
  performanceSummary: string;
  recommendations: string[];
}
