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

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
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

export const RESOURCE_NAMES: Record<keyof Resources, string> = {
  food: '食物',
  water: '水',
  energy: '体力',
  spirit: '精神',
  toolDurability: '工具耐久',
  safety: '安全值',
};

export const RESOURCE_COLORS: Record<keyof Resources, string> = {
  food: 'bg-amber-500',
  water: 'bg-blue-500',
  energy: 'bg-green-500',
  spirit: 'bg-purple-500',
  toolDurability: 'bg-gray-500',
  safety: 'bg-red-500',
};

export const RESOURCE_ICONS: Record<keyof Resources, string> = {
  food: '🍖',
  water: '💧',
  energy: '⚡',
  spirit: '🧠',
  toolDurability: '🔧',
  safety: '🛡️',
};

export const EVENT_TYPE_LABELS: Record<GameEvent['type'], string> = {
  storm: '暴风雨',
  disease: '疾病',
  wreck: '沉船补给',
  footprints: '神秘脚印',
  friday: '星期五',
  rescue: '救援',
  random: '随机事件',
};

export const EVENT_TYPE_COLORS: Record<GameEvent['type'], string> = {
  storm: 'bg-blue-600',
  disease: 'bg-red-600',
  wreck: 'bg-amber-600',
  footprints: 'bg-green-600',
  friday: 'bg-purple-600',
  rescue: 'bg-emerald-600',
  random: 'bg-gray-600',
};
