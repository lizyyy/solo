export type ChannelType = 'vocal' | 'guitar' | 'bass' | 'drum' | 'keys' | 'other';
export type GameStatus = 'idle' | 'playing' | 'paused' | 'ended';
export type EventType = 'feedback' | 'monitor_request' | 'imbalance' | 'clipping';
export type Severity = 'warning' | 'critical';
export type Conclusion = 'resolved' | 'missed' | 'partial';
export type ActionType = 'fader_move' | 'mute' | 'solo' | 'master_adjust';
export type MonitorLevel = 'too_low' | 'too_high' | 'good';

export interface Channel {
  id: number;
  name: string;
  type: ChannelType;
  level: number;
  pan: number;
  mute: boolean;
  solo: boolean;
  monitorLevel: MonitorLevel;
}

export interface GameEvent {
  id: string;
  type: EventType;
  severity: Severity;
  timestamp: number;
  channelId?: number;
  description: string;
  resolved: boolean;
  resolvedAt?: number;
  evidenceId?: string;
}

export interface ActionLog {
  id: string;
  type: ActionType;
  channelId?: number;
  fromValue: number;
  toValue: number;
  timestamp: number;
}

export interface EvidenceChain {
  id: string;
  eventType: EventType;
  startTime: number;
  endTime?: number;
  actions: ActionLog[];
  events: GameEvent[];
  conclusion: Conclusion;
  notes: string;
}

export interface ClueGroup {
  id: string;
  title: string;
  events: GameEvent[];
  actions: ActionLog[];
  timeWindow: { start: number; end: number };
  relatedChannels: number[];
}

export interface GameStats {
  totalEvents: number;
  resolvedEvents: number;
  missedEvents: number;
  avgResponseTime: number;
  feedbackCount: number;
  monitorMissCount: number;
  clippingCount: number;
  imbalanceCount: number;
}

export interface GameState {
  status: GameStatus;
  score: number;
  timeElapsed: number;
  totalDuration: number;
  channels: Channel[];
  masterLevel: number;
  events: GameEvent[];
  actionLogs: ActionLog[];
  evidenceChains: EvidenceChain[];
  selectedEvidenceId: string | null;
  showReview: boolean;
  showClueOrganizer: boolean;
}

export interface GameActions {
  startGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  restartGame: () => void;
  endGame: () => void;
  setChannelLevel: (channelId: number, level: number) => void;
  setMasterLevel: (level: number) => void;
  toggleMute: (channelId: number) => void;
  toggleSolo: (channelId: number) => void;
  setMonitorLevel: (channelId: number, level: MonitorLevel) => void;
  addEvent: (event: Omit<GameEvent, 'id' | 'timestamp' | 'resolved'>) => void;
  resolveEvent: (eventId: string) => void;
  selectEvidence: (id: string | null) => void;
  toggleReview: () => void;
  toggleClueOrganizer: () => void;
  resetGame: () => void;
  setTimeElapsed: (time: number) => void;
  setScore: (score: number) => void;
  setEvents: (events: GameEvent[]) => void;
  setActionLogs: (logs: ActionLog[]) => void;
  setEvidenceChains: (chains: EvidenceChain[]) => void;
  loadSampleData: () => void;
}
