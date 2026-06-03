export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  status: 'normal' | 'warning' | 'pending_review';
  stage: 'import' | 'detection' | 'review' | 'completed';
  description?: string;
}

export interface HoistingPoint {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  load: number;
  status: 'normal' | 'warning';
}

export interface Route {
  id: string;
  name: string;
  fromPoint: string;
  toPoint: string;
  length: number;
  calculatedLength?: number;
  isSupplementary: boolean;
  recalculated: boolean;
  hasWarning: boolean;
  color?: string;
}

export interface ObstacleNote {
  id: string;
  routeId: string;
  content: string;
  imageUrl?: string;
  createdAt: string;
  createdBy: 'designer' | 'customer';
}

export interface FloorSketch {
  id: string;
  projectId: string;
  floor: number;
  imageUrl: string;
  description: string;
  uploadedAt: string;
  uploadedBy: string;
  relatedRouteIds: string[];
}

export type DetectionIssueType = 'route_not_recalculated';
export type IssueStatus = 'open' | 'supplemented' | 'resolved';
export type NextAction = 'contact_customer' | 'contact_designer';

export interface DetectionIssue {
  id: string;
  type: DetectionIssueType;
  routeId: string;
  severity: 'warning' | 'error';
  description: string;
  status: IssueStatus;
  nextAction: NextAction;
  missingMaterials: string[];
  createdAt: string;
  supplementedAt?: string;
  resolvedAt?: string;
  reviewNotes?: string;
}

export interface ExportReport {
  projectId: string;
  projectName: string;
  issues: DetectionIssue[];
  summary: string;
  nextSteps: string[];
  generatedAt: string;
  generatedBy: string;
}

export interface ReviewLog {
  id: string;
  issueId: string;
  action: string;
  performedBy: string;
  timestamp: string;
  note?: string;
}
