export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface Dimensions {
  width: number;
  height: number;
  depth: number;
}

export interface NameHistory {
  id: string;
  name: string;
  changedBy: string;
  changedAt: Date;
  reason: string;
}

export interface Obstacle {
  id: string;
  sketchId: string;
  currentName: string;
  position: Position;
  dimensions: Dimensions;
  source: 'sketch' | 'point-cloud' | 'manual';
  isConflicted: boolean;
  status: 'pending' | 'confirmed' | 'rejected' | 'merged';
  nameHistory: NameHistory[];
  createdAt: Date;
  updatedAt: Date;
  mergedInto?: string;
}

export interface ConflictEvidence {
  sketchData?: Obstacle;
  pointCloudData?: Obstacle;
  overlapPercentage: number;
  nameSimilarity: number;
  coordinateDiff: Position;
  nameHistory1?: NameHistory[];
  nameHistory2?: NameHistory[];
}

export interface Conflict {
  id: string;
  type: 'duplicate-name' | 'position-overlap' | 'data-inconsistency';
  obstacleIds: string[];
  evidence: ConflictEvidence;
  status: 'pending' | 'confirmed' | 'rejected';
  resolvedBy?: string;
  resolvedAt?: Date;
  resolution?: string;
  requiresReview: boolean;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewComment?: string;
  createdAt: Date;
}

export interface FloorSketch {
  id: string;
  name: string;
  floor: string;
  importedBy: string;
  importedAt: Date;
  fileHash: string;
  obstacles: Obstacle[];
}

export interface PointCloudLog {
  id: string;
  sketchId: string;
  name: string;
  processedBy: string;
  processedAt: Date;
  data: Record<string, unknown>;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  targetType: string;
  targetId: string;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  reason: string;
  createdAt: Date;
  affectedItems: string[];
}

export interface SelfCheckResult {
  id: string;
  type: 'duplicate-import' | 'multiple-names' | 'recalculate' | 'export-consistency';
  status: 'pass' | 'warning' | 'fail';
  message: string;
  details: Record<string, unknown>;
  checkedAt: Date;
}

export interface User {
  id: string;
  name: string;
  role: 'designer' | 'trainee' | 'admin';
}

export interface AppState {
  currentUser: User;
  currentSketch: FloorSketch | null;
  pointCloudLogs: PointCloudLog[];
  conflicts: Conflict[];
  auditLogs: AuditLog[];
  selfCheckResults: SelfCheckResult[];
}

export type ExportData = {
  sketch: FloorSketch;
  pointCloudLogs: PointCloudLog[];
  conflicts: Conflict[];
  obstacles: Obstacle[];
  exportTime: Date;
  exportedBy: string;
};
