export type ConflictType = "window_overlap" | "telemetry_frame_drop" | "time_system_mixed";

export type ConflictStatus = "pending" | "confirmed" | "ignored";

export type TimeSystem = "UTC" | "BJT" | "UNKNOWN";

export interface TimeWindow {
  id: string;
  stationName: string;
  startTime: string;
  endTime: string;
  timeSystem: TimeSystem;
  description?: string;
}

export interface TelemetrySegment {
  id: string;
  stationName: string;
  startTime: string;
  endTime: string;
  expectedFrames: number;
  actualFrames: number;
  timeSystem: TimeSystem;
}

export interface PayloadPlan {
  id: string;
  name: string;
  version: string;
  importedAt: string;
  operator: string;
  windows: TimeWindow[];
  telemetrySegments: TelemetrySegment[];
}

export interface GroundStationSchedule {
  id: string;
  name: string;
  importedAt: string;
  operator: string;
  windows: TimeWindow[];
}

export interface ConflictItem {
  id: string;
  type: ConflictType;
  status: ConflictStatus;
  stationName: string;
  description: string;
  humanMessage: string;
  relatedWindowIds: string[];
  payloadPlanId: string;
  payloadPlanVersion: string;
  detectedAt: string;
  retractedFrom?: string;
  versionChanged?: boolean;
  versionChangeNote?: string;
}

export interface VersionDiff {
  id: string;
  planId: string;
  oldVersion: string;
  newVersion: string;
  added: TimeWindow[];
  removed: TimeWindow[];
  modified: TimeWindow[];
  affectedConflictIds: string[];
  summary: string;
}

export interface ImportHistoryEntry {
  id: string;
  type: "payload_plan" | "ground_station_schedule";
  filename: string;
  operator: string;
  importedAt: string;
  name: string;
  retracted: boolean;
  snapshot: string;
}

export interface FilterState {
  conflictTypes: ConflictType[];
  statuses: ConflictStatus[];
  stationName: string;
  timeRangeStart: string;
  timeRangeEnd: string;
}
