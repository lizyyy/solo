export interface Warehouse {
  id: string;
  name: string;
  dimensions: { width: number; depth: number; height: number };
}

export interface Shelf {
  id: string;
  code: string;
  position: { x: number; z: number };
  levels: number;
  positionsPerLevel: number;
}

export interface Artwork {
  id: string;
  name: string;
  artist: string;
  type: 'oil' | 'chinese' | 'sculpture' | 'photography' | 'mixed';
  year: number;
  size: string;
  condition: 'excellent' | 'good' | 'fair' | 'needs_repair';
  value: number;
  accessionNumber: string;
}

export interface ArtBox {
  id: string;
  code: string;
  locationId: string;
  artworks: Artwork[];
  inDate: string;
  expectedOutDate?: string;
  actualOutDate?: string;
  handler: string;
  notes?: string;
  status: 'in_stock' | 'outbound' | 'pending' | 'returned';
  material: 'wood' | 'metal' | 'custom';
  weight: number;
}

export interface SensorData {
  locationId: string;
  temperature: number;
  humidity: number;
  lastUpdate: string;
  history: { time: string; temp: number; humidity: number }[];
  alerts: { type: 'temp_high' | 'temp_low' | 'humid_high' | 'humid_low'; level: 'warning' | 'critical' }[];
}

export interface Location {
  id: string;
  shelfId: string;
  level: number;
  position: number;
  code: string;
  status: 'empty' | 'occupied' | 'reserved' | 'maintenance';
  zone: 'normal' | 'constant_temp' | 'valuables';
  box?: ArtBox;
  sensor?: SensorData;
  worldPosition: { x: number; y: number; z: number };
}

export interface ForbiddenZone {
  id: string;
  name: string;
  points: { x: number; z: number }[];
  reason: string;
  color: string;
}

export interface RoutePoint {
  x: number;
  y: number;
  z: number;
}

export interface Task {
  id: string;
  type: 'inbound' | 'outbound' | 'transfer';
  boxId: string;
  fromLocation: string;
  toLocation: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  route: RoutePoint[];
  hasForbiddenCrossing: boolean;
  createTime: string;
  operator: string;
  operationLog: { action: string; time: string; operator: string; remark?: string }[];
  priority: 'normal' | 'urgent' | 'emergency';
}

export interface FilterState {
  searchKeyword: string;
  zones: string[];
  statuses: string[];
  artworkTypes: string[];
  tempRange: [number, number];
  humidityRange: [number, number];
  showAlertsOnly: boolean;
}

export type ViewMode = 'overview' | 'heatmap' | 'route';

export interface AppState {
  warehouse: Warehouse | null;
  shelves: Shelf[];
  locations: Location[];
  forbiddenZones: ForbiddenZone[];
  tasks: Task[];
  selectedLocation: Location | null;
  selectedTask: Task | null;
  filters: FilterState;
  viewMode: ViewMode;
  showHeatmap: boolean;
  showRoutes: boolean;
  operationLogs: { action: string; time: string; operator: string; remark?: string }[];
}

export interface AppActions {
  setSelectedLocation: (location: Location | null) => void;
  setSelectedTask: (task: Task | null) => void;
  setFilters: (filters: Partial<FilterState>) => void;
  setViewMode: (mode: ViewMode) => void;
  toggleHeatmap: () => void;
  toggleRoutes: () => void;
  createTask: (task: Omit<Task, 'id' | 'createTime' | 'operationLog'>) => void;
  updateTaskStatus: (taskId: string, status: Task['status'], operator: string, remark?: string) => void;
  cancelTask: (taskId: string, operator: string, remark?: string) => void;
  addOperationLog: (action: string, operator: string, remark?: string) => void;
  getFilteredLocations: () => Location[];
  planRoute: (fromId: string, toId: string) => RoutePoint[];
  checkForbiddenCrossing: (route: RoutePoint[]) => boolean;
  detectDuplicateLocations: () => string[];
  detectTemperatureAlerts: () => Location[];
  detectHumidityAlerts: () => Location[];
}
