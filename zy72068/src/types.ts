export type SourceType = 'GIS' | '巡检' | 'Excel';
export type AnomalyType = '正常' | '空值' | '重复' | '边界';

export interface ShipRecord {
  id: string;
  name: string;
  source: SourceType;
  sourceId: string;
  longitude: number;
  latitude: number;
  heading: number;
  speed: number;
  timestamp: string;
  anomalyType: AnomalyType;
  emptyFields: string[];
  remark: string;
}

export interface FilterState {
  sources: SourceType[];
  timeRange: [string, string];
  anomalyTypes: AnomalyType[];
}

export interface Scheme {
  id: string;
  name: string;
  createdAt: string;
  filterSnapshot: FilterState;
  cameraPosition: [number, number, number];
  cameraTarget: [number, number, number];
  note: string;
  recordCount: number;
}

export interface DiffResult {
  addedCount: number;
  changedCount: number;
  anomalyDistributionBefore: Record<string, number>;
  anomalyDistributionAfter: Record<string, number>;
}
