export type UnitType = 'infantry' | 'cavalry' | 'archer' | 'siege';
export type TerrainType = 'plain' | 'mountain' | 'forest' | 'water' | 'fortress';
export type ChangeType = 'material_only' | 'conclusion_changed';
export type ErrorSource = 'unit_table' | 'terrain_rule' | 'battle_report' | 'system';

export interface Unit {
  id: string;
  name: string;
  type: UnitType;
  attack: number;
  defense: number;
  speed: number;
  hp: number;
  position: HexCoord;
  owner: string;
  initiative: number;
}

export interface HexCoord {
  q: number;
  r: number;
}

export interface TerrainRule {
  id: string;
  name: string;
  terrainType: TerrainType;
  movementCost: number;
  defenseBonus: number;
  attackPenalty: number;
  description: string;
}

export interface TerrainHex {
  coord: HexCoord;
  terrainType: TerrainType;
}

export interface BattlePhase {
  phaseNumber: number;
  actingUnitId: string;
  action: string;
  targetUnitId?: string;
  damage?: number;
  timestamp: number;
}

export interface BattleReport {
  id: string;
  title: string;
  date: string;
  winner?: string;
  phases: BattlePhase[];
  summary: string;
  isManuallyEdited: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ChangeRecord {
  id: string;
  timestamp: number;
  changeType: ChangeType;
  category: string;
  field: string;
  oldValue: string;
  newValue: string;
  description: string;
  source: ErrorSource;
  author: string;
  affectsConclusion: boolean;
}

export interface ValidationError {
  code: string;
  message: string;
  userMessage: string;
  source: ErrorSource;
  field?: string;
  expected?: string;
  actual?: string;
  suggestion: string;
  responsiblePerson: string;
}

export interface TurnOrderItem {
  unitId: string;
  unitName: string;
  initiative: number;
  phase: number;
  source: 'unit_table' | 'terrain_bonus';
}

export interface SimulationConfig {
  unitTableSource: string;
  terrainRuleSource: string;
  maxTurns: number;
  strictMode: boolean;
}

export interface HexSimulationState {
  units: Unit[];
  terrainRules: TerrainRule[];
  terrainMap: TerrainHex[];
  battleReports: BattleReport[];
  changeHistory: ChangeRecord[];
  turnOrder: TurnOrderItem[];
  currentTurn: number;
  config: SimulationConfig;
}
