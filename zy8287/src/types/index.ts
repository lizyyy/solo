export interface Event {
  id: string;
  timestamp: string;
  timeSlot: string;
  hallId: string;
  boothId: string;
  visitorId: string;
  entryType: 'scan' | 'manual' | 'camera';
  duration: number;
}

export interface Order {
  orderId: string;
  timestamp: string;
  timeSlot: string;
  hallId: string;
  boothId: string;
  visitorId: string;
  amount: number;
  productCategory: string;
  paymentMethod: string;
  status: 'completed' | 'refunded' | 'pending';
}

export interface Booth {
  boothId: string;
  hallId: string;
  hallName: string;
  boothName: string;
  exhibitor: string;
  industry: string;
  boothSize: string;
  position: {
    row: number;
    col: number;
  };
}

export interface Target {
  timeSlot: string;
  hallId: string;
  targetVisitors: number;
  targetOrders: number;
  targetRevenue: number;
}

export interface Filters {
  hallIds: string[];
  boothIds: string[];
  timeSlots: string[];
  industries: string[];
}

export interface AggregatedData {
  timeSlot: string;
  hallId: string;
  hallName: string;
  boothId: string;
  boothName: string;
  exhibitor: string;
  industry: string;
  visitors: number;
  orders: number;
  revenue: number;
  conversionRate: number;
  avgOrderValue: number;
  targetVisitors: number;
  targetOrders: number;
  targetRevenue: number;
  visitorGap: number;
  visitorGapPercent: number;
  orderGap: number;
  orderGapPercent: number;
  revenueGap: number;
  revenueGapPercent: number;
}

export interface TimeSlotTrend {
  timeSlot: string;
  visitors: number;
  orders: number;
  revenue: number;
  conversionRate: number;
  avgOrderValue: number;
}

export interface HallHeatmapData {
  hallId: string;
  hallName: string;
  visitors: number;
  orders: number;
  revenue: number;
  conversionRate: number;
  avgOrderValue: number;
}

export interface BoothRankingData {
  boothId: string;
  boothName: string;
  exhibitor: string;
  hallName: string;
  visitors: number;
  orders: number;
  revenue: number;
  conversionRate: number;
  avgOrderValue: number;
}

export interface SavedFilter {
  id: string;
  name: string;
  filters: Filters;
  createdAt: string;
}

export interface DataValidationWarning {
  type: 'duplicate_order' | 'missing_booth' | 'missing_target';
  message: string;
  details: string[];
}

export interface DashboardState {
  events: Event[];
  orders: Order[];
  booths: Booth[];
  targets: Target[];
  filters: Filters;
  aggregatedData: AggregatedData[];
  filteredData: AggregatedData[];
  savedFilters: SavedFilter[];
  warnings: DataValidationWarning[];
  isDataLoaded: boolean;
  selectedBoothId: string | null;
  selectedHallId: string | null;
  selectedTimeSlot: string | null;
}

export type DashboardAction =
  | { type: 'SET_EVENTS'; payload: Event[] }
  | { type: 'SET_ORDERS'; payload: Order[] }
  | { type: 'SET_BOOTHS'; payload: Booth[] }
  | { type: 'SET_TARGETS'; payload: Target[] }
  | { type: 'SET_FILTERS'; payload: Partial<Filters> }
  | { type: 'RESET_FILTERS' }
  | { type: 'ADD_SAVED_FILTER'; payload: SavedFilter }
  | { type: 'REMOVE_SAVED_FILTER'; payload: string }
  | { type: 'LOAD_SAVED_FILTER'; payload: SavedFilter }
  | { type: 'SET_WARNINGS'; payload: DataValidationWarning[] }
  | { type: 'SET_DATA_LOADED'; payload: boolean }
  | { type: 'SET_SELECTED_BOOTH'; payload: string | null }
  | { type: 'SET_SELECTED_HALL'; payload: string | null }
  | { type: 'SET_SELECTED_TIME_SLOT'; payload: string | null }
  | { type: 'CLEAR_SELECTIONS' };
