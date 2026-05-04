export interface Resources {
  food: number;
  water: number;
  energy: number;
  spirit: number;
  toolDurability: number;
  safety: number;
}

export interface ResourcesDelta {
  food?: number;
  water?: number;
  energy?: number;
  spirit?: number;
  toolDurability?: number;
  safety?: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  quantity: number;
  type: 'material' | 'tool' | 'food' | 'medicine' | 'special';
}

export interface Facility {
  id: string;
  name: string;
  description: string;
  level: number;
  maxLevel: number;
  built: boolean;
  effects: {
    resources: ResourcesDelta;
    description: string;
  };
}

export interface Location {
  id: string;
  name: string;
  description: string;
  explored: boolean;
  explorationProgress: number;
  maxProgress: number;
  availableActions: string[];
  discovered: boolean;
}

export interface Action {
  id: string;
  name: string;
  description: string;
  actionPoints: number;
  energyCost: number;
  location?: string;
  requirements?: {
    resources?: Partial<Resources>;
    inventory?: { itemId: string; quantity: number }[];
    facility?: { facilityId: string; minLevel: number };
    toolDurability?: number;
  };
  effects: {
    resources: ResourcesDelta;
    inventory?: { itemId: string; quantity: number }[];
    facilityProgress?: { facilityId: string; progress: number };
    locationProgress?: { locationId: string; progress: number };
    description: string;
  };
}

export interface GameEvent {
  id: string;
  name: string;
  type: 'storm' | 'disease' | 'wreck' | 'footprints' | 'friday' | 'rescue' | 'random';
  triggerCondition: {
    type: 'day' | 'random' | 'resource' | 'facility' | 'location';
    value: number;
    comparator?: 'gte' | 'lte' | 'eq';
  };
  choices: EventChoice[];
  description: string;
  triggered: boolean;
  dayTriggered?: number;
}

export interface EventChoice {
  id: string;
  text: string;
  requirements?: {
    resources?: Partial<Resources>;
    inventory?: { itemId: string; quantity: number }[];
    facility?: { facilityId: string; minLevel: number };
  };
  effects: {
    resources: ResourcesDelta;
    inventory?: { itemId: string; quantity: number }[];
    outcome: string;
    riskReduction?: number;
    unlocks?: string[];
  };
}

export interface LogEntry {
  id: string;
  day: number;
  timestamp: string;
  type: 'action' | 'event' | 'resource_change' | 'settlement' | 'end';
  title: string;
  content: string;
  resourceChanges?: ResourcesDelta;
  actionTaken?: string;
  eventId?: string;
}

export interface GameState {
  id: string;
  name: string;
  currentDay: number;
  actionPoints: number;
  maxActionPoints: number;
  resources: Resources;
  maxResources: Resources;
  inventory: InventoryItem[];
  facilities: Facility[];
  locations: Location[];
  events: GameEvent[];
  logs: LogEntry[];
  hasFriday: boolean;
  hasFire: boolean;
  hasShelter: boolean;
  rescueAttempts: number;
  rescueSuccess: boolean;
  gameOver: boolean;
  gameOverReason?: string;
  created: string;
  lastUpdated: string;
}

export interface CreateGameRequest {
  name: string;
}

export interface PerformActionRequest {
  actionId: string;
  locationId?: string;
}

export interface EventChoiceRequest {
  eventId: string;
  choiceId: string;
}

export interface ExportFormat {
  format: 'markdown' | 'html' | 'json';
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
}

export const ERROR_CODES = {
  INSUFFICIENT_ACTION_POINTS: 'INSUFFICIENT_ACTION_POINTS',
  INSUFFICIENT_RESOURCES: 'INSUFFICIENT_RESOURCES',
  INSUFFICIENT_INVENTORY: 'INSUFFICIENT_INVENTORY',
  INSUFFICIENT_TOOL_DURABILITY: 'INSUFFICIENT_TOOL_DURABILITY',
  FACILITY_REQUIREMENT_NOT_MET: 'FACILITY_REQUIREMENT_NOT_MET',
  LOCATION_NOT_DISCOVERED: 'LOCATION_NOT_DISCOVERED',
  ACTION_NOT_AVAILABLE: 'ACTION_NOT_AVAILABLE',
  ALREADY_SETTLED: 'ALREADY_SETTLED',
  GAME_ALREADY_OVER: 'GAME_ALREADY_OVER',
  SAVE_NOT_FOUND: 'SAVE_NOT_FOUND',
  INVALID_REQUEST: 'INVALID_REQUEST',
  EVENT_NOT_FOUND: 'EVENT_NOT_FOUND',
  CHOICE_NOT_FOUND: 'CHOICE_NOT_FOUND',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

export class GameError extends Error {
  code: ErrorCode;
  details?: Record<string, unknown>;

  constructor(message: string, code: ErrorCode, details?: Record<string, unknown>) {
    super(message);
    this.name = 'GameError';
    this.code = code;
    this.details = details;
  }
}
