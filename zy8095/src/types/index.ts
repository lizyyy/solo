export interface Bay {
  id: string;
  name: string;
  position: { x: number; y: number; z: number };
  dimensions: { width: number; height: number; depth: number };
  maxWeight: number;
  isDeck: boolean;
}

export interface CargoItem {
  id: string;
  containerNo: string;
  weight: number | null;
  category: string;
  isDangerous: boolean;
  dangerousClass?: string;
  length: number;
  width: number;
  height: number;
}

export interface StabilityRules {
  maxTotalWeight: number;
  maxDeckWeight: number;
  maxCargoHoldWeight: number;
  balanceLimits: {
    maxPortStarboardDifference: number;
    maxForeAftDifference: number;
  };
  dangerousGoods: {
    isolationDistance: number;
    incompatibleClasses: Record<string, string[]>;
  };
}

export interface CargoPlacement {
  cargoId: string;
  bayId: string;
  position: { x: number; y: number; z: number };
}

export interface StowageState {
  bays: Bay[];
  cargoItems: CargoItem[];
  placements: CargoPlacement[];
  rules: StabilityRules;
}

export interface CalculationResult {
  totalWeight: number;
  centerOfGravity: { x: number; y: number; z: number };
  portStarboardBalance: number;
  foreAftBalance: number;
  overloadWarnings: OverloadWarning[];
  dangerousGoodsConflicts: DangerousGoodsConflict[];
}

export interface OverloadWarning {
  bayId: string;
  bayName: string;
  currentWeight: number;
  maxWeight: number;
}

export interface DangerousGoodsConflict {
  cargo1Id: string;
  cargo2Id: string;
  distance: number;
  requiredDistance: number;
  classes: { class1: string; class2: string };
}

export interface ParsingError {
  field: string;
  message: string;
  rowIndex?: number;
}

export interface HistoryAction {
  type: 'PLACE' | 'REMOVE' | 'MOVE';
  payload: unknown;
  previousState: StowageState;
}