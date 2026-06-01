export type PointStatus = 'normal' | 'warning' | 'danger';
export type DataSource = 'gis' | 'tablet' | 'excel';
export type CoordinateSystem = 'utm' | 'local' | 'wgs84';

export interface Coordinates {
  x: number;
  y: number;
  z: number;
}

export interface MonitoringPoint {
  id: string;
  name: string;
  coordinates: Coordinates;
  status: PointStatus;
  displacement: number;
  source: DataSource;
  sourceFile: string;
  importedAt: string;
  processedAt?: string;
  handler?: string;
  suggestion?: string;
  photos?: string[];
  isReworked?: boolean;
  reworkReason?: string;
  hasConflict?: boolean;
  isCorrupted?: boolean;
  corruptionNote?: string;
}

export interface SolutionFilters {
  status: PointStatus[];
  source: DataSource[];
  dateRange: [string, string];
}

export interface Solution {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  pointIds: string[];
  filters: SolutionFilters;
  coordinateSystem: CoordinateSystem;
  isRework: boolean;
  parentSolutionId?: string;
  notes: string;
}

export interface DataConflict {
  id: string;
  pointId: string;
  meetingScreenshot: {
    claim: string;
    date: string;
  };
  importedData: {
    value: number;
    source: string;
    date: string;
  };
  suggestedActions: string[];
}

export interface ExportMetadata {
  solutionName: string;
  filters: SolutionFilters;
  coordinateSystem: CoordinateSystem;
  exportedAt: string;
  handler: string;
  pointCount: number;
  warningCount: number;
  dangerCount: number;
}
