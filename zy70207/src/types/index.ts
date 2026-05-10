export type StallStatus = 'normal' | 'has_issue' | 'pending_rectification' | 'rectified';

export type IssueType = 'oil' | 'fire';

export type RectificationStatus = 'pending' | 'in_progress' | 'completed' | 'verified';

export interface Stall {
  id: string;
  name: string;
  row: number;
  col: number;
  owner: string;
  category: string;
  status: StallStatus;
}

export interface Issue {
  id: string;
  stallId: string;
  type: IssueType;
  description: string;
  severity: 'low' | 'medium' | 'high';
  discoveredAt: string;
  discoveredBy: string;
}

export interface Rectification {
  id: string;
  issueId: string;
  stallId: string;
  status: RectificationStatus;
  deadline: string;
  completedAt?: string;
  verifiedAt?: string;
  rectificationMethod?: string;
  notes?: string;
}

export interface InspectionRecord {
  id: string;
  stallId: string;
  issues: Issue[];
  rectifications: Rectification[];
  inspectedAt: string;
  inspectedBy: string;
}

export interface AppState {
  stalls: Stall[];
  issues: Issue[];
  rectifications: Rectification[];
  inspectionRecords: InspectionRecord[];
}
