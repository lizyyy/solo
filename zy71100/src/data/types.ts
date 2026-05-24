export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Warehouse {
  id: string;
  name: string;
  width: number;
  depth: number;
  height: number;
}

export interface Aisle {
  id: string;
  name: string;
  width: number;
  orientation: 'x' | 'z';
  isNarrow: boolean;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
}

export interface Shelf {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  levels: number;
  aisleId: string;
}

export interface PathPoint {
  x: number;
  y: number;
  z: number;
  timestamp: number;
  speed: number;
}

export interface PickingOrder {
  id: string;
  operator: string;
  vehicleType: 'forklift' | 'picker' | 'manual';
  startTime: number;
  endTime: number;
  path: PathPoint[];
  color: string;
}

export interface HeatmapCell {
  x: number;
  z: number;
  value: number;
  count: number;
}

export interface CongestionRecord {
  aisleId: string;
  timestamp: number;
  duration: number;
  vehicleCount: number;
}

export interface ViewMode {
  type: 'perspective' | 'top' | 'front' | 'side';
  position: Vector3;
  target: Vector3;
}

export interface TimeRange {
  start: number;
  end: number;
}

export interface ReportData {
  generatedAt: number;
  timeRange: TimeRange;
  totalOrders: number;
  totalDistance: number;
  avgSpeed: number;
  topCongestedAisles: {
    aisleId: string;
    aisleName: string;
    congestionTime: number;
    vehicleCount: number;
  }[];
  heatmapData: HeatmapCell[];
}

export type Vector3Tuple = [number, number, number];
