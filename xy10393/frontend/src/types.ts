export interface Rider {
  id: string;
  name: string;
  phone: string;
  bibNumber: number;
  team?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  status: RiderStatus;
  registeredAt: string;
}

export type RiderStatus = 
  | 'registered'      
  | 'equipment_passed'
  | 'equipment_failed'
  | 'in_progress'     
  | 'dropped_out'     
  | 'finished';

export const STATUS_LABELS: Record<RiderStatus, string> = {
  registered: '已报名',
  equipment_passed: '装备检查通过',
  equipment_failed: '装备检查未通过',
  in_progress: '比赛中',
  dropped_out: '已退赛',
  finished: '已完赛'
};

export interface Checkpoint {
  id: string;
  name: string;
  orderIndex: number;
  location: string;
  isStart: boolean;
  isFinish: boolean;
}

export interface EquipmentItem {
  name: string;
  status: 'ok' | 'missing' | 'damaged';
  notes?: string;
}

export interface EquipmentCheck {
  id: string;
  riderId: string;
  checkedAt: string;
  items: EquipmentItem[];
  overallResult: 'passed' | 'failed';
  checkerName: string;
  comments?: string;
}

export interface Checkin {
  id: string;
  riderId: string;
  checkpointId: string;
  checkedInAt: string;
  checkedBy: string;
}

export interface Dropout {
  id: string;
  riderId: string;
  checkpointId?: string;
  droppedAt: string;
  reason: string;
  comments?: string;
  recordedBy: string;
}

export interface Supply {
  id: string;
  riderId: string;
  supplyType: 'course' | 'finish';
  checkpointId?: string;
  collectedAt: string;
  collectedBy: string;
}

export interface FinishRecord {
  id: string;
  riderId: string;
  finishedAt: string;
  totalTime?: number;
  recordedBy: string;
}

export interface ApprovalComment {
  id: string;
  relatedType: ApprovalType;
  relatedId: string;
  action: string;
  decision: 'approved' | 'rejected';
  comments: string;
  madeBy: string;
  madeAt: string;
}

export type ApprovalType = 
  | 'equipment_check'
  | 'checkin'
  | 'dropout'
  | 'finish';

export interface CheckpointStats extends Checkpoint {
  totalChecked: number;
  checkedRiders: Rider[];
}

export interface DashboardStats {
  totalRiders: number;
  statusCounts: Record<string, number>;
  checkpointStats: CheckpointStats[];
  dropouts: Dropout[];
  finishCount: number;
  supplyStats: { course: number; finish: number };
  missingCheckins: Rider[];
  dropoutsCount: number;
}

export interface RiderDetails {
  rider: Rider;
  equipmentChecks: EquipmentCheck[];
  checkins: Checkin[];
  supplies: Supply[];
  dropouts: Dropout[];
  finishRecords: FinishRecord[];
}
