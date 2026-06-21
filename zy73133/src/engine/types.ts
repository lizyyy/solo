export type TideUnit = 'm' | 'cm' | 'ft' | 'unknown';
export type CoordinateFormat = 'decimal' | 'dms' | 'ddm' | 'unknown';
export type AnnotationStatus = 'processed' | 'reprocessed' | 'exception' | 'pending_review';

export interface RawBuoyLog {
  logId: string;
  rawText: string;
  rawLatitude: string;
  rawLongitude: string;
  rawTideValue: string;
  rawTideUnit: string;
  timestamp: string;
  sourceFile: string;
  lineNumber: number;
  parseWarnings: string[];
}

export interface NormalizedCoordinates {
  latitude: number | null;
  longitude: number | null;
  originalFormat: CoordinateFormat;
  rawLatitude: string;
  rawLongitude: string;
  parseNotes: string[];
}

export interface NormalizedTide {
  valueMeters: number | null;
  originalValue: string;
  originalUnit: TideUnit;
  originalUnitRaw: string;
  normalizeNotes: string[];
}

export interface BuoyRecord {
  recordId: string;
  rawLog: RawBuoyLog;
  coordinates: NormalizedCoordinates | null;
  tide: NormalizedTide | null;
  parseErrors: string[];
  isValid: boolean;
}

export interface CsvRow {
  station_name: string;
  timestamp: string;
  latitude: string;
  longitude: string;
  latitude_raw: string;
  longitude_raw: string;
  coordinate_format: string;
  tide_meters: string;
  tide_original: string;
  tide_unit_raw: string;
  tide_level: string;
  remarks: string;
  issues: string;
  raw_text: string;
  source_ref: string;
  record_id: string;
  log_id: string;
}

export interface TideStationAnnotation {
  annotationId: string;
  batchId: string;
  stationName: string;
  buoyRecord: BuoyRecord;
  sceneAnnotation: string;
  sideNote: string;
  csvRow: CsvRow;
  status: AnnotationStatus;
  createdAt: string;
  updatedAt: string;
  remarks: string[];
  rawTrace: Record<string, unknown>;
}

export interface RemarkDelta {
  fieldChanged: string;
  oldValue: string;
  newValue: string;
  judgmentImpact: string;
}

export interface AnnotationVersion {
  versionId: string;
  batchId: string;
  annotationId: string;
  versionNumber: number;
  annotation: TideStationAnnotation;
  appliedRemark: string | null;
  deltas: RemarkDelta[];
  createdAt: string;
}

export interface RemarkCorrection {
  tideOffsetM: number;
  tideOverride: number | null;
  found: boolean;
  description: string;
}

export interface ConsistencyResult {
  consistent: boolean;
  mismatches: string[];
  countCheck: {
    annotations: number;
    sceneLines: number;
    csvRows: number;
  };
}

export interface BatchProcessResult {
  batchId: string;
  annotations: TideStationAnnotation[];
  versions: AnnotationVersion[];
  hasExceptions: boolean;
  currentVersion: number;
}

export const CSV_HEADERS: (keyof CsvRow)[] = [
  'station_name', 'timestamp',
  'latitude', 'longitude',
  'latitude_raw', 'longitude_raw', 'coordinate_format',
  'tide_meters', 'tide_original', 'tide_unit_raw', 'tide_level',
  'remarks', 'issues',
  'raw_text', 'source_ref', 'record_id', 'log_id',
];

let idCounter = 0;
export function generateId(prefix: string): string {
  idCounter += 1;
  const rand = Math.random().toString(16).slice(2, 10);
  const time = Date.now().toString(16).slice(-6);
  return `${prefix}_${time}${rand}${idCounter}`;
}
