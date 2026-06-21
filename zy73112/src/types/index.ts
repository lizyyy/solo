export type TrackingStatus = 'pending' | 'confirmed' | 'supplement' | 'returned' | 'bad_data' | 'needs_review';

export interface CameraView {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  zoom: number;
}

export interface BimComponent {
  id: string;
  name: string;
  type: 'pipe' | 'duct' | 'beam' | 'wall' | 'column' | 'floor' | 'other';
  position: { x: number; y: number; z: number };
  size: { x: number; y: number; z: number };
  material?: string;
  color: string;
}

export interface DuplicateEvidence {
  componentIds: string[];
  spatialDistance: number;
  sameBimNote?: boolean;
  similarCameraAngle?: boolean;
  descriptionMatch?: number;
}

export interface BimNote {
  id: string;
  title: string;
  content: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  modelVersion: string;
  tags: string[];
  isDeleted: boolean;
  deletedReason?: string;
  componentIds?: string[];
  location?: { x: number; y: number; z: number };
}

export interface CollisionPoint {
  id: string;
  name: string;
  description: string;
  bimNoteId: string;
  screenshotUrl: string;
  cameraView: CameraView;
  isDuplicate: boolean;
  duplicateOf?: string;
  duplicateReason?: string;
  duplicateEvidence?: DuplicateEvidence;
  affectedItems?: string[];
  needsManualReview: boolean;
  status: TrackingStatus;
  createdAt: string;
  updatedAt: string;
  componentIds: string[];
  position: { x: number; y: number; z: number };
}

export interface MaterialItem {
  id: string;
  name: string;
  spec: string;
  quantity: number;
  unit: string;
  originalMaterial?: string;
  changeReason: string;
}

export interface MaterialChange {
  id: string;
  title: string;
  description: string;
  bimNoteId: string;
  collisionPointIds: string[];
  sceneAnnotation: string;
  sideNote: string;
  pageSummary: string;
  status: TrackingStatus;
  materials: MaterialItem[];
  changedJudgements: string[];
  author: string;
  reviewer?: string;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
  originalRecordId?: string;
  badDataReason?: string;
  isBadData: boolean;
  badDataClue?: string;
}

export interface AuditLog {
  id: string;
  entityType: 'bimNote' | 'collision' | 'materialChange';
  entityId: string;
  action: string;
  operator: string;
  timestamp: string;
  details: string;
}

export type ViewType = 'dashboard' | 'bimNotes' | 'collisions' | 'tracking' | 'review' | 'badData';

export interface ChangeImpactResult {
  newCollisions: CollisionPoint[];
  duplicateCollisions: string[];
  affectedMaterialChanges: string[];
  newJudgements: string[];
  updatedSceneAnnotation: string;
  updatedSideNote: string;
  updatedPageSummary: string;
}

export interface ExportConfig {
  includeFilter: boolean;
  includeCameraView: boolean;
  includeReviewStatus: boolean;
  includeExceptionNotes: boolean;
  includeOriginalBimNote: boolean;
  format: 'csv' | 'json' | 'txt';
}
