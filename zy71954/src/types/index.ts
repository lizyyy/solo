export type AnomalyTag = "battery_cycle_error" | "nofly_zone_edge" | "rth_point_lost" | "other";

export type SortieStatus = "normal" | "pending" | "abnormal";

export type ConfirmationStatus = "confirmed" | "rejected" | "pending";

export type AuditAction = "import" | "confirm" | "revert" | "export" | "status_change";

export type ImportBatchStatus = "active" | "reverted";

export type EvidenceType = "photo" | "kml_segment";

export interface Sortie {
  id: string;
  sortieNo: string;
  batteryId: string;
  timestamp: number;
  status: SortieStatus;
  anomalyTags: AnomalyTag[];
  importBatchId: string;
}

export interface InspectionPhoto {
  id: string;
  sortieId: string;
  fileName: string;
  fileHash: string;
  thumbnailUrl: string;
  fullImageUrl: string;
  exifTimestamp: number | null;
  exifGps: { lat: number; lng: number } | null;
  annotations: PhotoAnnotation[];
}

export interface PhotoAnnotation {
  id: string;
  photoId: string;
  x: number;
  y: number;
  text: string;
  createdAt: number;
}

export interface KmlRoute {
  id: string;
  sortieId: string;
  fileName: string;
  fileHash: string;
  coordinates: [number, number][];
  swapPoints: SwapPoint[];
  noflyZones: NoflyZone[];
  rthPoint: { lat: number; lng: number } | null;
}

export interface SwapPoint {
  id: string;
  kmlRouteId: string;
  lat: number;
  lng: number;
  altitude: number;
  timestamp: number;
}

export interface NoflyZone {
  id: string;
  kmlRouteId: string;
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  minDistance: number;
}

export interface Confirmation {
  id: string;
  sortieId: string;
  status: ConfirmationStatus;
  evidenceType: EvidenceType;
  evidenceId: string;
  operator: string;
  timestamp: number;
  note: string;
}

export interface FlightReview {
  id: string;
  sortieId: string;
  dataPoints: ReviewDataPoint[];
  anomalyRanges: AnomalyRange[];
}

export interface ReviewDataPoint {
  timestamp: number;
  voltage: number;
  altitude: number;
  speed: number;
}

export interface AnomalyRange {
  id: string;
  startTimestamp: number;
  endTimestamp: number;
  type: AnomalyTag;
  linkedPhotoId: string | null;
  linkedKmlSegmentId: string | null;
}

export interface ImportBatch {
  id: string;
  timestamp: number;
  fileCount: number;
  fileHashes: string[];
  status: ImportBatchStatus;
}

export interface AuditLog {
  id: string;
  action: AuditAction;
  operator: string;
  timestamp: number;
  detail: string;
  sortieId?: string;
  batchId?: string;
}

export interface FilterState {
  status: SortieStatus[];
  anomalyTags: AnomalyTag[];
  dateRange: { start: number | null; end: number | null };
  batteryId: string;
  sortieNo: string;
}
