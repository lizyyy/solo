export type SlopeDifficulty = 'green' | 'blue' | 'black' | 'double_black';
export type InjurySeverity = 'minor' | 'moderate' | 'severe' | 'critical';
export type WeatherType = 'clear' | 'light_snow' | 'heavy_snow' | 'blizzard';
export type EquipmentType = 'skis' | 'snowmobile' | 'stretcher' | 'medkit' | 'aed' | 'oxygen';
export type GameStatus = 'menu' | 'playing' | 'paused' | 'victory' | 'defeat';
export type PatrollerStatus = 'idle' | 'dispatched' | 'returning';
export type EventType = 'dispatch' | 'rescue' | 'deterioration' | 'weather_change' | 'slope_close' | 'victory' | 'defeat' | 'warning';

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface Slope {
  id: string;
  name: string;
  difficulty: SlopeDifficulty;
  start: Position;
  end: Position;
  isOpen: boolean;
  baseTravelTime: number;
}

export interface Victim {
  id: string;
  name: string;
  position: Position;
  slopeId: string;
  injury: InjurySeverity;
  requiredEquipment: EquipmentType[];
  timeRemaining: number;
  maxTime: number;
  isRescued: boolean;
}

export interface Patroller {
  id: string;
  name: string;
  skillLevel: number;
  speed: number;
  specialties: SlopeDifficulty[];
  fatigue: number;
  status: PatrollerStatus;
  position: Position;
  currentVictimId?: string;
  targetPosition?: Position;
  dispatchStartTime?: number;
}

export interface Equipment {
  type: EquipmentType;
  name: string;
  icon: string;
  speedBonus: number;
  applicableInjuries: InjurySeverity[];
  requiredFor: InjurySeverity[];
  description: string;
}

export interface WeatherEvent {
  time: number;
  type: WeatherType;
  duration: number;
}

export interface LevelConfig {
  id: string;
  name: string;
  description: string;
  difficulty: number;
  timeLimit: number;
  slopes: Slope[];
  victims: Victim[];
  patrollers: Patroller[];
  initialWeather: WeatherType;
  weatherEvents: WeatherEvent[];
}

export interface DispatchRecord {
  id: string;
  timestamp: number;
  patrollerId: string;
  victimId: string;
  equipment: EquipmentType[];
  route: string[];
  estimatedTime: number;
  actualTime?: number;
  success: boolean;
}

export interface GameEvent {
  timestamp: number;
  type: EventType;
  data: Record<string, unknown>;
}

export interface GameState {
  status: GameStatus;
  currentLevelId: string;
  timeElapsed: number;
  timeLimit: number;
  score: number;
  weather: WeatherType;
  weatherEndTime: number;
  slopes: Slope[];
  victims: Victim[];
  patrollers: Patroller[];
  selectedPatrollerId?: string;
  selectedVictimId?: string;
  selectedEquipment: EquipmentType[];
  dispatchHistory: DispatchRecord[];
  keyEvents: GameEvent[];
  defeatReason?: string;
}

export interface ReplayData {
  id: string;
  levelId: string;
  startTime: number;
  endTime: number;
  finalScore: number;
  result: 'victory' | 'defeat';
  events: GameEvent[];
  stateSnapshots: { time: number; state: Partial<GameState> }[];
}

export interface ReportData {
  gameId: string;
  levelName: string;
  finalScore: number;
  result: 'victory' | 'defeat';
  totalTime: number;
  victimsRescued: number;
  totalVictims: number;
  averageResponseTime: number;
  dispatchCount: number;
  equipmentUsage: Record<EquipmentType, number>;
  scoreBreakdown: {
    baseRescue: number;
    speedBonus: number;
    equipmentBonus: number;
    deteriorationPenalty: number;
    failurePenalty: number;
  };
  events: GameEvent[];
  defeatReason?: string;
}

export const SLOPE_COLORS: Record<SlopeDifficulty, string> = {
  green: '#22c55e',
  blue: '#3b82f6',
  black: '#1f2937',
  double_black: '#000000',
};

export const INJURY_COLORS: Record<InjurySeverity, string> = {
  minor: '#22c55e',
  moderate: '#eab308',
  severe: '#f97316',
  critical: '#ef4444',
};

export const WEATHER_COLORS: Record<WeatherType, string> = {
  clear: '#87ceeb',
  light_snow: '#b0c4de',
  heavy_snow: '#778899',
  blizzard: '#4a5568',
};
