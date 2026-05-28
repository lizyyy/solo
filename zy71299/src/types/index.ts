export interface Passenger {
  id: string;
  name: string;
  currentSeat: string;
  cabinClass: string;
}

export interface Seat {
  seatId: string;
  row: number;
  col: string;
  status: 'available' | 'occupied' | 'blocked';
  cabinClass: string;
}

export interface SeatMap {
  id: string;
  rows: number;
  cols: string[];
  seats: Seat[];
}

export interface PaidSeat {
  seatId: string;
  fee: number;
  passengerId: string;
}

export interface CompanionGroup {
  groupId: string;
  passengerIds: string[];
  priority: 'high' | 'medium' | 'low';
}

export interface RebookingRecord {
  id: string;
  passengerId: string;
  originalSeat: string;
  targetFlight: string;
}

export interface SwapAction {
  actionId: string;
  passengerId: string;
  fromSeat: string;
  toSeat: string;
}

export type ConflictType = 'paid_displaced' | 'companion_split' | 'overbooked_duplicate';

export interface ConflictEntry {
  entryId: string;
  conflictType: ConflictType;
  affectedPassengerId: string;
  affectedGroupId?: string;
  description: string;
  reason: string;
}

export interface SwapScheme {
  schemeId: string;
  actions: SwapAction[];
  conflicts: ConflictEntry[];
  totalScore: number;
  isRecommended: boolean;
}

export interface WeightConfig {
  paidSeatWeight: number;
  companionWeight: number;
  cabinDiffWeight: number;
  distanceWeight: number;
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface AppState {
  passengers: Passenger[];
  seatMap: SeatMap | null;
  paidSeats: PaidSeat[];
  companionGroups: CompanionGroup[];
  rebookingRecords: RebookingRecord[];
  weightConfig: WeightConfig;
  swapSchemes: SwapScheme[];
  selectedSchemeId: string | null;
  validationErrors: ValidationError[];
}
