export type GamePhase = 'menu' | 'playing' | 'paused' | 'ended';
export type TaskType = 'utilities' | 'structure' | 'fire_safety';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';
export type CrewStatus = 'idle' | 'working' | 'moving';
export type EventType = 'info' | 'warning' | 'success' | 'error';
export type InspectionType = 'utilities' | 'structure' | 'fire';
export type MaterialType = 'utilities' | 'structure' | 'fire';

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  w: number;
  h: number;
}

export interface Booth {
  id: string;
  name: string;
  position: Position;
  size: Size;
  utilitiesDone: boolean;
  structureDone: boolean;
  fireSafetyDone: boolean;
  utilitiesProgress: number;
  structureProgress: number;
  fireSafetyProgress: number;
}

export interface Crew {
  id: string;
  name: string;
  status: CrewStatus;
  currentTask: string | null;
  assignedBooth: string | null;
  efficiency: number;
}

export interface Task {
  id: string;
  type: TaskType;
  boothId: string;
  assignedCrew: string;
  turnsRequired: number;
  turnsSpent: number;
  status: TaskStatus;
}

export interface Material {
  id: string;
  name: string;
  type: MaterialType;
  requiredFor: string[];
  deliveryTurn: number;
  actualDeliveryTurn: number | null;
  delivered: boolean;
  quantity: number;
  used: boolean;
}

export interface Inspection {
  type: InspectionType;
  unlocked: boolean;
  requested: boolean;
  completed: boolean;
  passed: boolean;
  attempts: number;
}

export interface GameEvent {
  id: string;
  turn: number;
  type: EventType;
  message: string;
  boothId?: string;
  crewId?: string;
}

export interface PlayerAction {
  type: 'assign_task' | 'request_inspection' | 'emergency_material' | 'end_turn';
  crewId?: string;
  boothId?: string;
  taskType?: TaskType;
  timestamp: number;
}

export interface TurnRecord {
  turn: number;
  actions: PlayerAction[];
  stateSnapshot: GameState;
}

export interface ScoreBreakdown {
  onTimeBonus: number;
  earlyCompletion: number;
  firstTryPass: number;
  noDelayBonus: number;
  noConflictBonus: number;
  inspectionPenalty: number;
  emergencyPenalty: number;
  overtimePenalty: number;
  total: number;
}

export interface LevelConfig {
  id: number;
  name: string;
  description: string;
  boothCount: number;
  crewCount: number;
  maxTurns: number;
  materialDelayChance: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface GameState {
  phase: GamePhase;
  currentLevel: number | null;
  currentTurn: number;
  maxTurns: number;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  booths: Booth[];
  crews: Crew[];
  tasks: Task[];
  materials: Material[];
  inspections: Inspection[];
  events: GameEvent[];
  history: TurnRecord[];
  pendingActions: PlayerAction[];
  conflictDetected: boolean;
  emergencyUsed: number;
  allMaterialsOnTime: boolean;
}

export const INITIAL_SCORE_BREAKDOWN: ScoreBreakdown = {
  onTimeBonus: 0,
  earlyCompletion: 0,
  firstTryPass: 0,
  noDelayBonus: 0,
  noConflictBonus: 0,
  inspectionPenalty: 0,
  emergencyPenalty: 0,
  overtimePenalty: 0,
  total: 0,
};

export const TASK_CONFIG: Record<TaskType, { turns: number; label: string; color: string }> = {
  utilities: { turns: 3, label: '水电布置', color: '#4299e1' },
  structure: { turns: 4, label: '展架搭建', color: '#805ad5' },
  fire_safety: { turns: 2, label: '消防布设', color: '#e53e3e' },
};

export const INSPECTION_LABELS: Record<InspectionType, string> = {
  utilities: '水电验收',
  structure: '展架验收',
  fire: '消防验收',
};

export const MATERIAL_LABELS: Record<MaterialType, string> = {
  utilities: '水电材料',
  structure: '展架材料',
  fire: '消防材料',
};

export const CREW_STATUS_LABELS: Record<CrewStatus, string> = {
  idle: '空闲',
  working: '施工中',
  moving: '移动中',
};
