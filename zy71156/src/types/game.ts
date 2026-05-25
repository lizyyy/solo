export type ElevatorStatus = 'normal' | 'fault' | 'rescuing' | 'rescued';
export type TeamStatus = 'idle' | 'moving' | 'working' | 'conflict';
export type GameStatus = 'menu' | 'playing' | 'paused' | 'ended' | 'replaying';
export type FaultType = 'door_jam' | 'power_out' | 'overload' | 'false_alarm' | 'cable_issue';
export type PassengerMood = 'calm' | 'anxious' | 'panic';
export type GameResult = 'win' | 'lose' | null;
export type LoseReason = 'timeout' | 'passenger_panic' | 'too_many_conflicts' | null;

export interface Elevator {
  id: string;
  name: string;
  currentFloor: number;
  targetFloor: number;
  status: ElevatorStatus;
  faultType: FaultType | null;
  passengerCount: number;
  assignedTeamId: string | null;
  waitTime: number;
  mood: PassengerMood;
  rescueProgress: number;
  isMoving: boolean;
}

export interface MaintenanceTeam {
  id: string;
  name: string;
  status: TeamStatus;
  assignedElevatorId: string | null;
  progress: number;
  currentFloor: number;
  targetFloor: number;
  isMoving: boolean;
}

export interface GameEvent {
  id: string;
  time: number;
  type: 'fault' | 'rescue_start' | 'rescue_complete' | 'timeout' | 'conflict' | 'mood_change' | 'info';
  message: string;
  elevatorId?: string;
  teamId?: string;
}

export interface LevelConfig {
  id: number;
  name: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  floorCount: number;
  elevatorCount: number;
  teamCount: number;
  gameDuration: number;
  faultInterval: [number, number];
  maxConcurrentFaults: number;
  passengerRange: [number, number];
  conflictPenalty: number;
  panicPenalty: number;
  rescueBonus: number;
  winCondition: 'all_rescued' | 'score_threshold';
  winScore?: number;
}

export interface ScoreBreakdown {
  totalRescues: number;
  totalRescuePoints: number;
  totalConflicts: number;
  totalConflictPenalty: number;
  totalPanics: number;
  totalPanicPenalty: number;
  totalTimeouts: number;
  totalTimeoutPenalty: number;
  finalScore: number;
}

export interface HistoryFrame {
  timestamp: number;
  elevators: Elevator[];
  teams: MaintenanceTeam[];
  score: number;
  gameTime: number;
}

export interface GameState {
  status: GameStatus;
  currentLevel: LevelConfig | null;
  elevators: Elevator[];
  teams: MaintenanceTeam[];
  events: GameEvent[];
  score: number;
  gameTime: number;
  result: GameResult;
  loseReason: LoseReason;
  selectedTeamId: string | null;
  selectedElevatorId: string | null;
  history: HistoryFrame[];
  replayIndex: number;
  replaySpeed: number;
  scoreBreakdown: ScoreBreakdown | null;
}

export interface GameActions {
  startGame: (level: LevelConfig) => void;
  pauseGame: () => void;
  resumeGame: () => void;
  restartGame: () => void;
  endGame: (result: GameResult, reason: LoseReason) => void;
  selectTeam: (teamId: string | null) => void;
  selectElevator: (elevatorId: string | null) => void;
  assignTeam: (teamId: string, elevatorId: string) => void;
  cancelTeamAssignment: (teamId: string) => void;
  tick: (deltaTime: number) => void;
  goToMenu: () => void;
  startReplay: () => void;
  stopReplay: () => void;
  setReplayIndex: (index: number) => void;
  setReplaySpeed: (speed: number) => void;
  exportReport: () => string;
  loadHistory: (history: HistoryFrame[]) => void;
}
