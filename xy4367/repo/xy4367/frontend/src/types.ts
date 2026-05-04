export interface ObservingSite {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  elevation: number;
}

export interface Device {
  id: string;
  name: string;
  type: 'telescope' | 'camera' | 'mount' | 'filter';
  model?: string;
  batteryLevel: number;
  isAvailable: boolean;
  description?: string;
}

export interface ObservingTarget {
  id: string;
  name: string;
  type: string;
  rightAscension: string;
  declination: string;
  priority: number;
}

export interface TargetWindow {
  id: string;
  targetId: string;
  startTime: string;
  endTime: string;
  duration: number;
  deviceIds: string[];
  notes?: string;
}

export interface Risk {
  id: string;
  windowId: string;
  targetName: string;
  type: RiskType;
  severity: RiskSeverity;
  message: string;
  isOverridden: boolean;
  overrideReason?: string;
  overrideBy?: string;
  overrideAt?: string;
}

export type RiskType =
  | 'altitude_too_low'
  | 'moon_interference'
  | 'battery_low'
  | 'device_conflict'
  | 'window_conflict';

export type RiskSeverity = 'critical' | 'warning' | 'info';

export interface ObservationActivity {
  id: string;
  name: string;
  date: string;
  siteId: string;
  status: 'planned' | 'active' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export interface ReviewRecord {
  id: string;
  activityId: string;
  windowId: string;
  targetName: string;
  reviewer: string;
  reviewedAt: string;
  status: 'approved' | 'rejected' | 'pending';
  notes?: string;
  risks: Risk[];
}

export interface RiskSummary {
  critical: { total: number; overridden: number };
  warning: { total: number; overridden: number };
  info: { total: number; overridden: number };
  byType: Record<string, { total: number; overridden: number }>;
  byTarget: Record<string, { total: number; critical: number; warning: number }>;
}

export interface AppState {
  sites: ObservingSite[];
  devices: Device[];
  targets: ObservingTarget[];
  windows: TargetWindow[];
  risks: Risk[];
  activities: ObservationActivity[];
  riskSummary: RiskSummary | null;
  currentActivity: ObservationActivity | null;
  loading: boolean;
  error: string | null;
}

export interface ImportResult {
  message: string;
  [key: string]: any;
}
