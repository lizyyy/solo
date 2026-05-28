export type DataStatus = 'confirmed' | 'tentative';

export type FieldType = 
  | 'route' 
  | 'aircraftType' 
  | 'loadFactor' 
  | 'fuelConsumption' 
  | 'carbonFactor' 
  | 'operationReport';

export interface Route {
  id: string;
  origin: string;
  destination: string;
  distance: number;
  status: DataStatus;
}

export interface Aircraft {
  id: string;
  model: string;
  registration: string;
  seatCount: number;
  status: DataStatus;
}

export interface FlightData {
  id: string;
  routeId: string;
  aircraftId: string;
  date: string;
  loadFactor: number | null;
  fuelConsumption: number;
  carbonFactor: number;
  carbonEmission: number;
  passengerCount: number;
  status: DataStatus;
  fieldStatuses: Record<FieldType, DataStatus>;
  anomalies: AnomalyType[];
  remarks?: string;
}

export type AnomalyType = 
  | 'missing_load_factor' 
  | 'aircraft_mapping_error' 
  | 'extreme_route_occlusion'
  | 'high_emission'
  | 'low_load_factor';

export interface CarbonHeightPoint {
  x: number;
  z: number;
  height: number;
  color: string;
  flightData: FlightData;
  route: Route;
  aircraft: Aircraft;
}

export interface FilterState {
  dateRange: { start: string; end: string };
  routes: string[];
  aircraftTypes: string[];
  loadFactorRange: { min: number; max: number };
  emissionRange: { min: number; max: number };
  statusFilter: DataStatus | 'all';
  anomalyFilter: AnomalyType[];
}

export interface UserPermission {
  canViewSensitive: boolean;
  canExport: boolean;
  canEdit: boolean;
  role: 'admin' | 'analyst' | 'viewer';
}

export interface AppState {
  flightData: FlightData[];
  routes: Route[];
  aircraft: Aircraft[];
  selectedFlightId: string | null;
  filters: FilterState;
  permission: UserPermission;
  currentTimeRange: string;
  isRotating: boolean;
}

export interface SensitiveFieldConfig {
  field: string;
  displayName: string;
  requiresPermission: boolean;
  maskPattern: string;
}

export interface ReportExportOptions {
  format: 'xlsx' | 'csv' | 'pdf';
  includeSensitive: boolean;
  includeCharts: boolean;
  timeRange: { start: string; end: string };
}

export interface AuditLogEntry {
  timestamp: string;
  action: string;
  userId: string;
  flightId?: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
}
