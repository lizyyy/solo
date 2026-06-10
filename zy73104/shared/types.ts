export type ChecklistStatus = "confirmed" | "pending" | "returned" | "suspended";

export type Role = "architect" | "operations";

export const STATUS_LABEL: Record<ChecklistStatus, string> = {
  confirmed: "已确认",
  pending: "待补件",
  returned: "退回",
  suspended: "挂起",
};

export const ROLE_LABEL: Record<Role, string> = {
  architect: "建筑师",
  operations: "运营主管",
};

export interface DrainPoint {
  id: string;
  label: string;
  apiField: string;
  x: number;
  y: number;
  description: string;
}

export interface BimNote {
  id: string;
  content: string;
  createdAt: string;
  createdBy: Role;
  isWithdrawn: boolean;
  withdrawnAt?: string;
  withdrawnBy?: Role;
  isSupplementary: boolean;
  versionTag?: string;
}

export interface RevisionDiff {
  id: string;
  changedAt: string;
  changedBy: Role;
  fromStatus: ChecklistStatus;
  toStatus: ChecklistStatus;
  reason: string;
  fieldChanges: Array<{
    field: string;
    oldValue: string;
    newValue: string;
  }>;
}

export interface DrawingVersion {
  version: string;
  isLatest: boolean;
  isValid: boolean;
  releasedAt: string;
  remark?: string;
}

export interface Checklist {
  id: string;
  code: string;
  projectName: string;
  layerName: string;
  isLayerNameValid: boolean;
  status: ChecklistStatus;
  versions: DrawingVersion[];
  drainPoints: DrainPoint[];
  bimNotes: BimNote[];
  revisions: RevisionDiff[];
  createdAt: string;
  updatedAt: string;
  handledBy: Role;
  assignee: string;
}

export interface ReviewStats {
  month: string;
  total: number;
  confirmed: number;
  pending: number;
  returned: number;
  suspended: number;
  reviewedCount: number;
  anomalyCount: number;
}

export interface LayerNameValidation {
  valid: boolean;
  suggestions?: string[];
  shouldSuspend: boolean;
}

export interface ChangeStatusReq {
  toStatus: ChecklistStatus;
  reason?: string;
  changedBy: Role;
}

export interface CreateNoteReq {
  content: string;
  createdBy: Role;
  isSupplementary?: boolean;
  versionTag?: string;
}
