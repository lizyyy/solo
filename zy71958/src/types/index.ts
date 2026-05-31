export type RecordStatus = 'pending_review' | 'reviewed' | 'pending_processing' | 'resolved';

export type NoFlyZoneSourceType = 'pilot_note' | 'inspection_photo';

export type IssueStatus = 'open' | 'in_progress' | 'resolved';

export type ActionType = 'create' | 'status_change' | 'route_modify' | 'issue_create' | 'issue_resolve' | 'note_add';

export interface Coordinate {
  lat: number;
  lng: number;
  alt: number;
}

export interface RouteData {
  coordinates: Coordinate[];
  name: string;
  description?: string;
}

export interface AirspaceRecord {
  id: string;
  source: string;
  status: RecordStatus;
  batteryCycle: number;
  pilot: string;
  createdAt: string;
  updatedAt: string;
  currentRouteVersionId: string;
  pendingReason?: string;
}

export interface HistoryEntry {
  id: string;
  recordId: string;
  action: ActionType;
  operator: string;
  timestamp: string;
  reason?: string;
  previousState?: string;
  newState?: string;
  metadata?: Record<string, any>;
}

export interface NoFlyZoneIssue {
  id: string;
  recordId: string;
  sourceType: NoFlyZoneSourceType;
  location: Coordinate;
  description: string;
  assignee: string;
  status: IssueStatus;
  photoUrl?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface RouteVersion {
  id: string;
  recordId: string;
  kmlData: string;
  routeData: RouteData;
  createdAt: string;
  createdBy: string;
  changeDescription?: string;
  version: number;
}

export interface Attachment {
  id: string;
  recordId: string;
  type: 'kml' | 'csv' | 'image' | 'json';
  name: string;
  data: string;
  createdAt: string;
}

export interface NoFlyZone {
  id: string;
  name: string;
  center: Coordinate;
  radius: number;
  minAlt: number;
  maxAlt: number;
}

export interface Stats {
  pendingReview: number;
  reviewed: number;
  pendingProcessing: number;
  issues: number;
  totalBatteryCycles: number;
}
