export type Severity = 'normal' | 'warning' | 'critical';
export type RecordStatus = 'active' | 'resolved' | 'conflict';
export type SourceType = 'point_table' | 'photo' | 'meeting_screenshot' | 'plan_note' | 'manual_coordinate';
export type ConflictType = 'coordinate_mismatch' | 'value_mismatch' | 'coordinate_system_mismatch';
export type ConflictSeverity = 'low' | 'medium' | 'high';

export interface Scheme {
  id: string;
  name: string;
  description: string;
  warningThreshold: number;
  criticalThreshold: number;
  coordinateSystem: string;
  temperatureUnit: 'celsius' | 'fahrenheit';
  createdAt: string;
  updatedAt: string;
}

export interface HotSpotRecord {
  id: string;
  schemeId: string;
  name: string;
  coordinateX: number;
  coordinateY: number;
  coordinateSystem: string;
  temperature: number;
  severity: Severity;
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SourceAttachment {
  id: string;
  recordId: string;
  sourceType: SourceType;
  sourceRef: string;
  sourceName: string;
  description: string;
  importedAt: string;
  rawData?: string;
}

export interface ParameterChange {
  id: string;
  schemeId: string;
  parameterName: string;
  oldValue: string;
  newValue: string;
  changedBy: string;
  changedAt: string;
  reason?: string;
}

export interface SourceConflict {
  id: string;
  recordId: string;
  sourceAId: string;
  sourceBId: string;
  conflictType: ConflictType;
  severity: ConflictSeverity;
  suggestion: string;
  resolvedAt?: string;
  resolution?: string;
  resolvedBy?: string;
  sourceA?: SourceAttachment;
  sourceB?: SourceAttachment;
}

export interface DashboardData {
  totalRecords: number;
  criticalCount: number;
  warningCount: number;
  normalCount: number;
  unresolvedConflicts: number;
  recentChanges: number;
  lastUpdatedAt: string;
}

export interface ExportOptions {
  format: 'json';
  includeChangelog: boolean;
  includeConflicts: boolean;
  includeSourceChain: boolean;
}
