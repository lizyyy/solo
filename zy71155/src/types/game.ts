export type WeightLevel = 'light' | 'medium' | 'heavy' | 'super_heavy';
export type FragileLevel = 'normal' | 'fragile' | 'very_fragile';
export type TimeLevel = 'normal' | 'next_day' | 'same_day' | 'express';
export type GameStatus = 'idle' | 'playing' | 'paused' | 'submitted' | 'failed';
export type Grade = 'S' | 'A' | 'B' | 'C' | 'F';

export interface BoxType {
  id: string;
  name: string;
  maxWeight: number;
  width: number;
  height: number;
  gridSize: number;
  color: string;
}

export interface Commodity {
  id: string;
  name: string;
  weight: number;
  weightLevel: WeightLevel;
  fragileLevel: FragileLevel;
  timeLevel: TimeLevel;
  width: number;
  height: number;
  color: string;
  icon: string;
}

export interface CommodityInstance extends Commodity {
  instanceId: string;
}

export interface PlacedItem {
  instanceId: string;
  commodityId: string;
  x: number;
  y: number;
  layer: number;
  rotation: number;
}

export interface Violation {
  id: string;
  type: 'heavy_on_fragile' | 'fragile_under' | 'time_position' | 'space_waste' | 'unstable' | 'overweight';
  description: string;
  penalty: number;
  commodityId: string;
  instanceId?: string;
  relatedCommodityId?: string;
  relatedInstanceId?: string;
  isFatal: boolean;
}

export interface Operation {
  type: 'place' | 'remove' | 'rotate';
  item: PlacedItem;
  timestamp: number;
}

export interface Level {
  id: string;
  name: string;
  difficulty: number;
  timeLimit: number;
  boxTypeId: string;
  commodityIds: string[];
  passScore: number;
  description: string;
  specialRule?: string;
}

export interface SettlementResult {
  score: number;
  grade: Grade;
  violations: Violation[];
  spaceUtilization: number;
  centerOfGravity: { x: number; y: number };
  totalWeight: number;
  isPassed: boolean;
  fatalViolation: Violation | null;
}

export interface HistoryRecord {
  id: string;
  levelId: string;
  levelName: string;
  score: number;
  grade: Grade;
  timeUsed: number;
  createdAt: string;
  placements: PlacedItem[];
  violations: Violation[];
  settlementResult: SettlementResult;
  operationStack: Operation[];
  totalCommodities: number;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration: number;
}
