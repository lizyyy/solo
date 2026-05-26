export type TileType = 'empty' | 'canal' | 'valve' | 'plot' | 'source';

export type CropType = 'rice' | 'wheat' | 'corn' | 'vegetable';

export type WeatherType = 'sunny' | 'cloudy' | 'rainy' | 'drought';

export type ValveState = 'open' | 'closed';

export type Direction = 'top' | 'bottom' | 'left' | 'right';

export type GameStatus = 'playing' | 'paused' | 'won' | 'lost' | 'replaying';

export interface SourceTile {
  id: string;
  type: 'source';
  hasWater: boolean;
}

export interface CanalTile {
  id: string;
  type: 'canal';
  hasWater: boolean;
  connections: Direction[];
}

export interface ValveTile {
  id: string;
  type: 'valve';
  state: ValveState;
  direction: 'horizontal' | 'vertical';
  connections: Direction[];
}

export interface PlotTile {
  id: string;
  type: 'plot';
  crop: CropType;
  waterNeeded: number;
  currentWater: number;
  isWatered: boolean;
  overwatered: boolean;
}

export interface EmptyTile {
  id: string;
  type: 'empty';
}

export type Tile = SourceTile | CanalTile | ValveTile | PlotTile | EmptyTile;

export interface ValveAction {
  valveId: string;
  from: ValveState;
  to: ValveState;
  round: number;
}

export interface GameSnapshot {
  round: number;
  board: Tile[][];
  score: number;
  waterUsed: number;
  totalWater: number;
  weather: WeatherType;
  valveActions: ValveAction[];
}

export interface Level {
  id: number;
  name: string;
  description: string;
  boardSize: { rows: number; cols: number };
  initialWater: number;
  maxRounds: number;
  targetScore: number;
  boardLayout: (string | null)[][];
  weatherPool: WeatherType[];
}

export interface PlotResult {
  plotId: string;
  crop: CropType;
  waterNeeded: number;
  waterReceived: number;
  status: 'success' | 'underwatered' | 'overwatered';
}

export interface IrrigationReport {
  levelName: string;
  totalRounds: number;
  finalScore: number;
  isWin: boolean;
  waterUsage: {
    total: number;
    perRound: number[];
  };
  plotResults: PlotResult[];
  failureReasons: string[];
  keyActions: {
    round: number;
    action: string;
    impact: string;
  }[];
}

export interface GameState {
  level: number;
  round: number;
  maxRounds: number;
  status: GameStatus;
  statusBeforeReplay: GameStatus | null;
  score: number;
  totalWater: number;
  waterUsed: number;
  waterUsedPerRound: number[];
  currentWeather: WeatherType;
  weatherDeck: WeatherType[];
  board: Tile[][];
  history: GameSnapshot[];
  failureReasons: string[];
  valveActionsThisRound: ValveAction[];
  replayIndex: number;
}

export type GameAction =
  | { type: 'TOGGLE_VALVE'; payload: { row: number; col: number } }
  | { type: 'NEXT_ROUND' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'RESTART' }
  | { type: 'LOAD_LEVEL'; payload: { levelId: number } }
  | { type: 'START_REPLAY' }
  | { type: 'REPLAY_STEP'; payload: { direction: 'forward' | 'backward' } }
  | { type: 'EXIT_REPLAY' };

export const CROP_INFO: Record<CropType, { name: string; emoji: string; baseWater: number }> = {
  rice: { name: '水稻', emoji: '🌾', baseWater: 3 },
  wheat: { name: '小麦', emoji: '🌿', baseWater: 2 },
  corn: { name: '玉米', emoji: '🌽', baseWater: 2 },
  vegetable: { name: '蔬菜', emoji: '🥬', baseWater: 1 },
};

export const WEATHER_INFO: Record<WeatherType, { name: string; emoji: string; evaporation: number; bonus: number }> = {
  sunny: { name: '晴天', emoji: '☀️', evaporation: 1, bonus: 0 },
  cloudy: { name: '多云', emoji: '⛅', evaporation: 0, bonus: 0 },
  rainy: { name: '雨天', emoji: '🌧️', evaporation: -2, bonus: 2 },
  drought: { name: '干旱', emoji: '🏜️', evaporation: 2, bonus: 0 },
};
