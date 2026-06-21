export type RowKind = 'processed' | 'skipped_duplicate' | 'skipped_remark_protected' | 'bad';

export interface RawLogRow {
  lineNumber: number;
  raw: Record<string, string>;
}

export interface ValidatedRow {
  lineNumber: number;
  buoyId: string;
  recordTime: string;
  latRaw: string;
  lonRaw: string;
  latitude: number;
  longitude: number;
  seaState: number;
  waveHeight: number;
  windSpeed: number;
  logPage: string;
  manualRemark?: string;
  isBoundaryNote?: boolean;
  isCloudOccludedNote?: boolean;
}

export interface BadRow {
  lineNumber: number;
  raw: Record<string, string>;
  errors: string[];
}

export interface LatLonSwapCandidate {
  lineNumber: number;
  buoyId: string;
  recordTime: string;
  originalLat: number;
  originalLon: number;
  originalLatRaw: string;
  originalLonRaw: string;
  swappedLat: number;
  swappedLon: number;
  reason: string;
}

export interface BuoyCliRecord {
  id: string;
  buoyId: string;
  recordTime: string;
  latitude: number;
  longitude: number;
  latRaw: string;
  lonRaw: string;
  logPage: string;
  logDate: string;
  seaState: number;
  waveHeight: number;
  windSpeed: number;
  status: 'pending' | 'reviewed' | 'anomaly' | 'boundary';
  isAnomaly: boolean;
  isBoundary: boolean;
  isCloudOccluded: boolean;
  manualRemark?: string;
  calculationCriteria: {
    formula: string;
    threshold: number;
    version: string;
    calculatedAt: string;
  };
  createdAt: string;
  updatedAt: string;
  sourceFile: string;
  sourceLine: number;
}

export interface RemarkImpact {
  buoyId: string;
  recordTime: string;
  oldRemark?: string;
  newRemark: string;
  changes: {
    field: string;
    before: string;
    after: string;
    reason: string;
  }[];
}

export interface ProcessStats {
  inputFile: string;
  totalRows: number;
  processed: number;
  skippedDuplicate: number;
  skippedRemarkProtected: number;
  bad: number;
}

export interface CliRunResult {
  stats: ProcessStats;
  badRows: BadRow[];
  swapCandidates: LatLonSwapCandidate[];
  remarkImpacts: RemarkImpact[];
  newRecords: BuoyCliRecord[];
  updatedRecords: BuoyCliRecord[];
  skippedRemarkProtectedRecords: BuoyCliRecord[];
  canRelease: boolean;
  blockingReasons: string[];
  runAt: string;
  cliVersion: string;
}

export interface StorageState {
  records: BuoyCliRecord[];
  lastRunAt?: string;
  lastInputFile?: string;
  schemaVersion: number;
}
