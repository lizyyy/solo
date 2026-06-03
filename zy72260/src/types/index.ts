export interface Waypoint {
  x: number;
  y: number;
  timestamp?: string;
}

export interface ExhibitData {
  exhibitId: string;
  name: string;
  x: number;
  y: number;
  pointCloudRadius: number;
  safetyRadius?: number;
  radiusSource?: 'point_cloud' | 'safety_table';
}

export interface PointCloudLog {
  id: string;
  filename: string;
  importTime: string;
  fileHash: string;
  operator: string;
  exhibits: ExhibitData[];
  route: Waypoint[];
  rawContent: string;
}

export interface SafetyRadiusTable {
  id: string;
  filename: string;
  importTime: string;
  version: string;
  operator: string;
  exhibits: Array<{
    exhibitId: string;
    safetyRadius: number;
  }>;
  rawContent: string;
}

export interface Route {
  id: string;
  waypoints: Waypoint[];
  calculatedLength: number;
  reportedLength?: number;
  isSupplementary: boolean;
  lengthRecalculated: boolean;
  reviewStatus: 'pending' | 'approved' | 'rejected' | 'not_required';
  supplementaryTime?: string;
  recalcTime?: string;
  reviewRemark?: string;
  reviewer?: string;
  reviewTime?: string;
}

export interface ConflictRecord {
  id: string;
  exhibitId: string;
  exhibitName: string;
  pointCloudValue: number;
  safetyRadiusValue: number;
  diffValue: number;
  diffPercent: number;
  severity: 'high' | 'medium' | 'low';
  status: 'pending' | 'confirmed' | 'rejected';
  evidence: {
    pointCloudSource: string;
    safetyRadiusSource: string;
    pointCloudLogId: string;
    safetyRadiusTableId: string;
  };
  decision?: 'use_point_cloud' | 'use_safety_radius';
  decisionRemark?: string;
  decisionOperator?: string;
  decisionTime?: string;
}

export type SelfCheckType = 
  | 'duplicate_import' 
  | 'length_not_recalculated' 
  | 'supplementary_recalc' 
  | 'export_consistency';

export type SelfCheckStatus = 'pass' | 'fail' | 'warning' | 'pending_review' | 'not_run';

export interface SelfCheckItem {
  id: string;
  type: SelfCheckType;
  status: SelfCheckStatus;
  title: string;
  message: string;
  details: Record<string, any>;
  checkTime?: string;
  action?: () => void;
}

export interface ExportRecord {
  id: string;
  version: string;
  exportTime: string;
  operator: string;
  imageDataUrl: string;
  watermark: string;
  dataHash: string;
  routeLength: number;
  exhibitCount: number;
  conflictCount: number;
  pendingReviewCount: number;
  remark?: string;
}

export interface HistoryCompareResult {
  id: string;
  currentExportId: string;
  previousExportId?: string;
  isConsistent: boolean;
  differences: Array<{
    type: 'route' | 'exhibit' | 'radius' | 'length' | 'status' | 'data';
    field: string;
    oldValue: any;
    newValue: any;
    description: string;
  }>;
  compareTime: string;
}

export interface DecisionLog {
  id: string;
  conflictId: string;
  operator: string;
  decision: 'confirmed' | 'rejected';
  remark: string;
  operateTime: string;
}

export interface ImportHistoryItem {
  id: string;
  type: 'point_cloud' | 'safety_radius';
  filename: string;
  importTime: string;
  fileHash: string;
  operator: string;
}

export type WorkflowStep = 'import_point_cloud' | 'import_safety_radius' | 'export';

export interface WorkflowState {
  currentStep: WorkflowStep;
  stepCompleted: Record<WorkflowStep, boolean>;
  pointCloudLogId?: string;
  safetyRadiusTableId?: string;
  lastRouteCalcTime?: string;
  lastSupplementaryTime?: string;
}

export type TestCaseType = 'normal' | 'wrong_caliber' | 'supplementary';

export interface TestCase {
  id: string;
  type: TestCaseType;
  name: string;
  description: string;
  pointCloudData: Omit<PointCloudLog, 'id' | 'importTime' | 'fileHash'>;
  safetyRadiusData?: Omit<SafetyRadiusTable, 'id' | 'importTime'>;
  supplementaryRoute?: Partial<Route>;
  expectedConflicts: number;
  expectedPendingReviews: number;
}
