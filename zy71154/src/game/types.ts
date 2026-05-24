export type NodeType = 'substation' | 'powerline' | 'user';

export type UserPriority = 'critical' | 'important' | 'normal';

export type NodeStatus = 'operational' | 'damaged' | 'repairing' | 'destroyed';

export type WeatherType = 'clear' | 'rain' | 'storm' | 'heavy_storm';

export type TeamStatus = 'idle' | 'moving' | 'repairing' | 'cooling';

export type GameStatus = 'idle' | 'playing' | 'paused' | 'victory' | 'defeat';

export type Difficulty = 'easy' | 'normal' | 'hard';

export type EventType = 'repair_start' | 'repair_complete' | 'damage' | 'outage' | 'weather_change' | 'victory' | 'defeat' | 'info';

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface PowerNode {
  id: string;
  type: NodeType;
  name: string;
  position: Position;
  status: NodeStatus;
  health: number;
  maxHealth: number;
  connectedTo: string[];
  repairTime: number;
  repairProgress: number;
  powered: boolean;
}

export interface UserNode extends PowerNode {
  type: 'user';
  priority: UserPriority;
  maxOutageTime: number;
  outageTime: number;
  population: number;
}

export interface RepairTeam {
  id: string;
  name: string;
  status: TeamStatus;
  efficiency: number;
  currentTarget: string | null;
  cooldown: number;
  maxCooldown: number;
  position: Position;
}

export interface Weather {
  type: WeatherType;
  duration: number;
  damageMultiplier: number;
  repairPenalty: number;
  description: string;
  icon: string;
}

export interface GameEvent {
  id: string;
  turn: number;
  type: EventType;
  message: string;
  timestamp: number;
}

export interface PlayerAction {
  type: 'assign_team' | 'end_turn' | 'pause' | 'resume';
  teamId?: string;
  nodeId?: string;
  timestamp: number;
}

export interface GameHistoryTurn {
  turn: number;
  nodes: PowerNode[];
  teams: RepairTeam[];
  weather: Weather;
  score: number;
  actions: PlayerAction[];
}

export interface ScoreBreakdown {
  criticalUsers: number;
  importantUsers: number;
  normalUsers: number;
  speedBonus: number;
  difficultyBonus: number;
  penalties: number;
  total: number;
}

export interface GameState {
  status: GameStatus;
  turn: number;
  maxTurns: number;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  weather: Weather;
  nextWeather: Weather;
  weatherDuration: number;
  nodes: PowerNode[];
  teams: RepairTeam[];
  selectedNode: string | null;
  selectedTeam: string | null;
  events: GameEvent[];
  history: GameHistoryTurn[];
  currentTurnActions: PlayerAction[];
  defeatReason: string | null;
  difficulty: Difficulty;
  highOutageTurns: number;
}

export interface LevelConfig {
  id: string;
  name: string;
  description: string;
  maxTurns: number;
  difficulty: Difficulty;
  initialWeather: WeatherType;
  weatherSequence: WeatherType[];
  nodes: Partial<PowerNode | UserNode>[];
  teams: Partial<RepairTeam>[];
}
