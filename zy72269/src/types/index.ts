export type MaterialType = 'normal' | 'wrong_diameter' | 'supplementary';
export type ConflictStatus = 'pending' | 'confirmed' | 'rejected';
export type ReviewStatus = 'pending' | 'approved' | 'corrected';
export type CheckResult = 'pass' | 'fail' | 'warning';
export type TaskStatus = 'draft' | 'imported' | 'conflict_detected' | 'reviewing' | 'completed';
export type NoteType = 'handwritten' | 'photo' | 'typed' | 'ambiguous';
export type ConflictType = 'obstacle_mismatch' | 'position_mismatch' | 'diameter_mismatch';
export type CheckType = 'duplicate_import' | 'z_axis_check' | 'recalculation' | 'export_consistency';

export interface ReferencePoint {
  x: number;
  y: number;
  z: number;
  label: string;
}

export interface RawMaterial {
  id: string;
  fileType: 'csv' | 'xlsx' | 'json';
  fileName: string;
  materialType: MaterialType;
  uploadedAt: string;
  rawContent: string;
}

export interface OriginalNote {
  id: string;
  markId: string;
  content: string;
  noteType: NoteType;
  sourceFile: string;
  lineNumber?: number;
  isAmbiguous: boolean;
  createdAt: string;
}

export interface InspectionMark {
  id: string;
  taskId: string;
  x: number;
  y: number;
  z: number;
  pipelineType: string;
  diameter: string;
  obstacleType?: string;
  isObstacle: boolean;
  sequenceNo: number;
  materialType: MaterialType;
  originalNotes: OriginalNote[];
  createdAt: string;
}

export interface FloorSketch {
  id: string;
  taskId: string;
  floorLevel: string;
  sketchData: string;
  referencePoints: ReferencePoint[];
  uploadedAt: string;
}

export interface Decision {
  id: string;
  conflictId: string;
  decisionType: 'confirm' | 'reject';
  reason: string;
  engineerName: string;
  decidedAt: string;
}

export interface ConflictRecord {
  id: string;
  markId: string;
  sketchId: string;
  conflictType: ConflictType;
  evidenceFromMark: string;
  evidenceFromSketch: string;
  status: ConflictStatus;
  decision?: Decision;
  detectedAt: string;
}

export interface ReviewRecord {
  id: string;
  abnormalId: string;
  reviewerName: string;
  reviewResult: string;
  sitePhoto?: string;
  signature: string;
  reviewedAt: string;
}

export interface ZAxisAbnormal {
  id: string;
  markId: string;
  detectedZ: number;
  expectedZ: number;
  suspicionReason: string;
  reviewStatus: ReviewStatus;
  reviewRecord?: ReviewRecord;
  detectedAt: string;
}

export interface SelfCheckReport {
  id: string;
  taskId: string;
  checkType: CheckType;
  result: CheckResult;
  details: string;
  rawDataSnapshot: unknown;
  executedAt: string;
}

export interface InspectionTask {
  id: string;
  taskNo: string;
  projectName: string;
  inspectionDate: string;
  inspector: string;
  status: TaskStatus;
  rawMaterials: RawMaterial[];
  marks: InspectionMark[];
  sketches: FloorSketch[];
  conflicts: ConflictRecord[];
  abnormalities: ZAxisAbnormal[];
  selfCheckReports: SelfCheckReport[];
  createdAt: string;
  updatedAt: string;
}

export interface PathPoint {
  x: number;
  y: number;
  z: number;
  sequenceNo: number;
  markId: string;
  isObstacle: boolean;
  timestamp: string;
}

export interface ImportPreviewResult {
  marks: InspectionMark[];
  rawNotes: OriginalNote[];
  rawContent: string;
  warnings: string[];
}

export interface SelfCheckOptions {
  checkDuplicateImport?: boolean;
  checkZAxis?: boolean;
  runRecalculation?: boolean;
  checkExportConsistency?: boolean;
}

export interface SampleWalkthroughStep {
  id: number;
  title: string;
  description: string;
  route: string;
  action?: string;
  expectedResult: string;
}

export interface ReportData {
  task: InspectionTask;
  marks: InspectionMark[];
  conflicts: ConflictRecord[];
  abnormalities: ZAxisAbnormal[];
  selfCheckReports: SelfCheckReport[];
  includeRawData: boolean;
  generatedAt: string;
}
