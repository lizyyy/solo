
export type TrashCategory = 'recyclable' | 'wet' | 'dry' | 'hazardous' | 'bulky';

export type TargetType = TrashCategory | 'appointment';

export interface TrashItem {
  id: string;
  name: string;
  emoji: string;
  category: TrashCategory;
  isContaminated: boolean;
  requiresBagBreak: boolean;
  isBagBroken?: boolean;
  isCleaned?: boolean;
  description: string;
  correctAction: string;
}

export interface AppointmentSlot {
  id: string;
  startTime: number;
  endTime: number;
  isAvailable: boolean;
}

export interface LevelConfig {
  id: number;
  name: string;
  description: string;
  timeLimit: number;
  trashCount: number;
  difficulty: 'easy' | 'medium' | 'hard';
  availableCategories: TrashCategory[];
  hasBagBreakMechanic: boolean;
  hasContaminationMechanic: boolean;
  hasAppointmentMechanic: boolean;
  appointmentSlots?: AppointmentSlot[];
  targetScore: number;
  correctPoints: number;
  wrongPenalty: number;
  maxWrongCount: number;
}

export interface GameError {
  id: string;
  trashItem: TrashItem;
  wrongAction: string;
  correctAction: string;
  explanation: string;
  timestamp: number;
}

export type ReplayActionType = 'drop' | 'bagBreak' | 'clean' | 'appoint';

export interface ReplayAction {
  type: ReplayActionType;
  trashId: string;
  target: string;
  timestamp: number;
  isCorrect: boolean;
  scoreChange: number;
  trashItem?: TrashItem;
}

export interface GameRecord {
  id: string;
  levelId: number;
  score: number;
  accuracy: number;
  correctCount: number;
  wrongCount: number;
  duration: number;
  completedAt: string;
  replayActions: ReplayAction[];
  errors: GameError[];
}

export interface RuleResult {
  isCorrect: boolean;
  scoreChange: number;
  message: string;
  explanation?: string;
}

export type GameStatus = 'idle' | 'playing' | 'paused' | 'ended';

export interface GameState {
  status: GameStatus;
  currentLevel: number | null;
  score: number;
  timeRemaining: number;
  elapsedTime: number;
  currentTrashIndex: number;
  trashQueue: TrashItem[];
  correctCount: number;
  wrongCount: number;
  errors: GameError[];
  appointmentSlots: AppointmentSlot[];
  replayActions: ReplayAction[];
  highlightedBin: TargetType | null;
}

export interface TrashReportItem {
  trash: TrashItem;
  target: TargetType;
  isCorrect: boolean;
  timestamp: number;
}

export const CATEGORY_COLORS: Record<TrashCategory, string> = {
  recyclable: '#1976D2',
  wet: '#795548',
  dry: '#212121',
  hazardous: '#D32F2F',
  bulky: '#FF9800',
};

export const CATEGORY_NAMES: Record<TrashCategory, string> = {
  recyclable: '可回收物',
  wet: '湿垃圾',
  dry: '干垃圾',
  hazardous: '有害垃圾',
  bulky: '大件垃圾',
};

export const CATEGORY_EMOJIS: Record<TrashCategory, string> = {
  recyclable: '♻️',
  wet: '🥬',
  dry: '🗑️',
  hazardous: '☠️',
  bulky: '🛋️',
};
