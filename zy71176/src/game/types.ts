export type RoomStatus = 'empty' | 'dirty' | 'occupied' | 'maintenance' | 'extend';

export type GuestStatus = 'waiting' | 'checked-in' | 'checked-out' | 'complained' | 'left';

export type CleanerStatus = 'idle' | 'cleaning' | 'break';

export type GameStatus = 'menu' | 'playing' | 'paused' | 'settlement' | 'replay';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Room {
  id: number;
  number: string;
  floor: number;
  status: RoomStatus;
  guestId?: string;
  cleanProgress?: number;
  maintenanceProgress?: number;
}

export interface Guest {
  id: string;
  name: string;
  avatar: string;
  arrivalTime: number;
  departureTime: number;
  actualArrivalTime?: number;
  status: GuestStatus;
  satisfaction: number;
  willExtend: boolean;
  hasExtendRequest: boolean;
  extendNights?: number;
  specialRequest?: string;
  roomId?: number;
  hasComplained?: boolean;
}

export interface Cleaner {
  id: string;
  name: string;
  status: CleanerStatus;
  currentRoomId?: number;
  progress: number;
}

export type EventType = 'guest_arrive' | 'guest_depart' | 'clean_complete' | 'extend_request' | 'complaint' | 'maintenance_complete' | 'guest_left';

export interface GameEvent {
  id: string;
  type: EventType;
  time: number;
  data: Record<string, unknown>;
  message: string;
}

export type ActionType = 'assign_room' | 'dispatch_cleaner' | 'approve_extend' | 'reject_extend' | 'mark_maintenance' | 'resolve_maintenance';

export interface PlayerAction {
  type: ActionType;
  time: number;
  data: Record<string, unknown>;
}

export interface HistoryRecord {
  time: number;
  snapshot: GameStateSnapshot;
  action?: PlayerAction;
}

export interface GameStateSnapshot {
  currentTime: number;
  rooms: Room[];
  guests: Guest[];
  cleaners: Cleaner[];
  score: number;
  complaints: number;
  satisfaction: number;
  events: GameEvent[];
}

export interface GameState {
  status: GameStatus;
  currentLevel: number;
  currentTime: number;
  rooms: Room[];
  guests: Guest[];
  cleaners: Cleaner[];
  score: number;
  complaints: number;
  satisfaction: number;
  events: GameEvent[];
  history: HistoryRecord[];
  replayIndex: number;
  selectedGuestId: string | null;
  selectedRoomId: number | null;
  failReason?: string;
}

export interface LevelConfig {
  id: number;
  name: string;
  description: string;
  difficulty: Difficulty;
  roomCount: number;
  cleanerCount: number;
  duration: number;
  guestArrivalRate: number;
  presetGuests: PresetGuest[];
  presetEvents: PresetEvent[];
  winConditions: {
    minSatisfaction: number;
    maxComplaints: number;
    minScore: number;
  };
}

export interface PresetGuest {
  name: string;
  avatar: string;
  arrivalTime: number;
  stayDuration: number;
  earlyArrival?: number;
  specialRequest?: string;
  willExtend?: boolean;
  extendNights?: number;
}

export interface PresetEvent {
  time: number;
  type: EventType;
  data: Record<string, unknown>;
  message: string;
}

export interface SettlementReport {
  levelId: number;
  levelName: string;
  finalScore: number;
  totalComplaints: number;
  finalSatisfaction: number;
  guestsServed: number;
  roomsCleaned: number;
  won: boolean;
  failReason?: string;
  keyEvents: GameEvent[];
  playTime: number;
}
