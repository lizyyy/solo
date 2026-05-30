export interface Position {
  x: number;
  y: number;
  z: number;
}

export type ContainerSize = '20ft' | '40ft';
export type ContainerType = 'dry' | 'reefer' | 'hazardous';
export type SlotStatus = 'empty' | 'occupied' | 'reserved';
export type CraneStatus = 'idle' | 'working' | 'maintenance';
export type TruckStatus = 'waiting' | 'moving' | 'loading' | 'unloading';
export type TaskType = 'load' | 'unload' | 'move';
export type ConflictType = 'slot_overlap' | 'crane_collision' | 'route_blockage' | 'port_congestion';
export type ConflictSeverity = 'warning' | 'critical';

export interface Container {
  id: string;
  number: string;
  type: ContainerType;
  weight: number;
  arrivalTime: Date;
  departureTime: Date;
}

export interface ContainerSlot {
  id: string;
  bay: number;
  row: number;
  tier: number;
  position: Position;
  size: ContainerSize;
  status: SlotStatus;
  container?: Container;
  lastUpdated: Date;
  dataSource: string;
}

export interface CraneTask {
  id: string;
  craneId: string;
  type: TaskType;
  sourceSlot?: string;
  targetSlot?: string;
  containerNumber?: string;
  startTime: Date;
  endTime: Date;
  priority: number;
  dataSource: string;
}

export interface Crane {
  id: string;
  name: string;
  position: Position;
  status: CraneStatus;
  currentTask?: CraneTask;
  workingRange: { minX: number; maxX: number; minZ: number; maxZ: number };
  lastUpdated: Date;
  dataSource: string;
}

export interface Waypoint {
  x: number;
  y: number;
  z: number;
  timestamp: Date;
}

export interface TruckRoute {
  id: string;
  truckId: string;
  waypoints: Waypoint[];
  startTime: Date;
  endTime: Date;
  dataSource: string;
}

export interface Truck {
  id: string;
  plateNumber: string;
  position: Position;
  status: TruckStatus;
  currentRoute?: TruckRoute;
  lastUpdated: Date;
  dataSource: string;
}

export interface Conflict {
  id: string;
  type: ConflictType;
  severity: ConflictSeverity;
  title: string;
  description: string;
  affectedObjects: string[];
  affectedObjectNames: string[];
  timestamp: Date;
  dataSource: string[];
  resolved: boolean;
}

export interface FilterState {
  containerTypes: ContainerType[];
  slotStatuses: SlotStatus[];
  craneStatuses: CraneStatus[];
  truckStatuses: TruckStatus[];
  timeRange: { start: Date; end: Date } | null;
  showConflictsOnly: boolean;
  conflictTypes: ConflictType[];
}

export interface SavedScenario {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  cameraPosition: Position;
  cameraTarget: Position;
  filters: FilterState;
  selectedObjects: string[];
  screenshot?: string;
}

export interface TimelineEvent {
  id: string;
  timestamp: Date;
  type: 'crane_start' | 'crane_end' | 'truck_arrival' | 'truck_departure' | 'conflict' | 'resolution';
  title: string;
  description: string;
  relatedObjectId: string;
}

export interface DataSourceInfo {
  name: string;
  lastImport: Date;
  recordCount: number;
}

export interface YardStatistics {
  totalSlots: number;
  occupiedSlots: number;
  utilizationRate: number;
  activeCranes: number;
  activeTrucks: number;
  conflicts: {
    total: number;
    critical: number;
    warning: number;
  };
  containerTypeBreakdown: {
    type: ContainerType;
    count: number;
  }[];
}
