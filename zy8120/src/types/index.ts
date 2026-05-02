export interface Waypoint {
  id: string;
  towerId: string;
  index: number;
  latitude: number;
  longitude: number;
  altitude: number;
  cameraAngle?: number;
  photoRequired: boolean;
  sequence: number;
}

export interface Route {
  missionId: string;
  missionName: string;
  flightDate: string;
  pilot: string;
  aircraft: string;
  waypoints: Waypoint[];
  totalWaypoints: number;
  expectedPhotos: number;
}

export interface ManifestEntry {
  filename: string;
  waypointId: string;
  towerId: string;
  flightSegment: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  altitude: number;
  imageWidth: number;
  imageHeight: number;
  fileSize: number;
  hash?: string;
  flightIndex?: number;
}

export interface DefectAnnotation {
  id: string;
  filename: string;
  towerId: string;
  defectType: string;
  severity: 'critical' | 'major' | 'minor';
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
  notes?: string;
}

export interface ImageExif {
  filename: string;
  timestamp?: string;
  timezone?: string;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  imageWidth?: number;
  imageHeight?: number;
  make?: string;
  model?: string;
}

export type IssueSeverity = 'critical' | 'major' | 'minor' | 'info';
export type IssueCategory = 
  | 'missing_waypoint'
  | 'duplicate_file'
  | 'missing_file'
  | 'time_anomaly'
  | 'coordinate_anomaly'
  | 'bbox_out_of_bounds'
  | 'hash_mismatch'
  | 'file_corruption'
  | 'coverage_gap';

export interface Issue {
  id: string;
  category: IssueCategory;
  severity: IssueSeverity;
  message: string;
  details?: Record<string, unknown>;
  relatedFiles?: string[];
  relatedWaypoints?: string[];
  timestamp?: string;
}

export interface FlightSegment {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  waypointsCovered: string[];
  photosCount: number;
  isRerun: boolean;
  parentSegment?: string;
}

export interface CoverageResult {
  towerId: string;
  status: 'fully_covered' | 'partially_covered' | 'not_covered';
  totalWaypoints: number;
  coveredWaypoints: number;
  missingWaypoints: string[];
  segments: FlightSegment[];
  rerunCount: number;
  finalPhotos: string[];
}

export interface PrecheckResult {
  success: boolean;
  timestamp: string;
  summary: {
    totalIssues: number;
    criticalIssues: number;
    majorIssues: number;
    minorIssues: number;
    infoIssues: number;
  };
  route: {
    missionId: string;
    totalWaypoints: number;
    waypointsWithPhotos: number;
    missingWaypoints: string[];
  };
  manifest: {
    totalEntries: number;
    validEntries: number;
    duplicateFiles: string[];
    missingFiles: string[];
  };
  defects: {
    totalAnnotations: number;
    validAnnotations: number;
    invalidBboxes: string[];
  };
  coverage: CoverageResult[];
  issues: Issue[];
  cleanManifest: ManifestEntry[];
}

export interface PrecheckOptions {
  inputDir: string;
  outputDir: string;
  timezone?: string;
  coordinateTolerance?: number;
  timeToleranceMinutes?: number;
  strict?: boolean;
}
