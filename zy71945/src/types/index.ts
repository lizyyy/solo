export interface OrbitalElement {
  id: string;
  epochTime: number;
  semiMajorAxis: number;
  eccentricity: number;
  inclination: number;
  raan: number;
  argPerigee: number;
  trueAnomaly: number;
  source: string;
  importedAt: number;
}

export interface TelemetrySegment {
  id: string;
  startTime: number;
  endTime: number;
  starSensorId: string;
  status: "normal" | "missing" | "occluded";
  frameCount: number;
  expectedFrameCount: number;
  source: string;
  importedAt: number;
}

export interface WindowTable {
  id: string;
  windowName: string;
  startTime: number;
  endTime: number;
  windowType: string;
  importedAt: number;
}

export interface OcclusionEvent {
  id: string;
  startTime: number;
  endTime: number;
  reason: string;
  dataSource: "orbital" | "telemetry" | "combined";
  confidence: "high" | "medium" | "low";
  status: "confirmed" | "pending" | "modified";
  handlingGuideline: string;
  analyzedAt: number;
}

export interface MissingFrameAlert {
  id: string;
  occlusionEventId: string;
  source: "orbital_elements" | "telemetry_segment";
  description: string;
  nextStep: string;
  responsible: string;
  createdAt: number;
}

export interface ReviewRecord {
  id: string;
  occlusionEventId: string;
  status: "confirmed" | "pending" | "modified";
  originalValue: string;
  correctedValue: string;
  reviewer: string;
  reviewedAt: number;
}

export interface ReviewHistory {
  id: string;
  reviewRecordId: string;
  field: string;
  oldValue: string;
  newValue: string;
  operator: string;
  modifiedAt: number;
}

export type OcclusionStatus = "confirmed" | "pending" | "modified";

export type DataSource = "orbital" | "telemetry" | "combined";

export type Confidence = "high" | "medium" | "low";

export interface ImportResult<T> {
  success: boolean;
  data: T[];
  errors: string[];
  warnings: string[];
}

export interface TimeRange {
  start: number;
  end: number;
}
