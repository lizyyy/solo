export interface WorkOrder {
  id: string;
  orderNo: string;
  pumpStationName: string;
  plannedStartTime: string;
  plannedEndTime: string;
  actualStartTime?: string;
  actualEndTime?: string;
  status: 'smooth' | 'supplement' | 'abnormal';
  spareParts: SparePart[];
  evidences: Evidence[];
  tempMaterials: TempMaterial[];
  versions: PlaybackVersion[];
}

export interface SparePart {
  id: string;
  modelNo: string;
  name: string;
  quantity: number;
  requiredByTime: string;
  actualArrivalTime: string;
  status: 'normal' | 'delayed' | 'replaced_blocked';
  replacement?: ReplacementRecord;
}

export interface ReplacementRecord {
  originalModel: string;
  proposedModel: string;
  blockReason: string;
  blockRule: string;
  applyTime: string;
}

export interface TempMaterial {
  id: string;
  name: string;
  spec: string;
  remark: string;
  remarkUpdatedAt?: string;
  remarkVersion: number;
}

export interface Evidence {
  id: string;
  name: string;
  type: 'arrival_proof' | 'inspection_record' | 'photo';
  status: 'confirmed' | 'pending';
  uploadTime?: string;
  remark?: string;
  uploader?: string;
}

export interface PlaybackVersion {
  version: string;
  runAt: string;
  changes: string[];
  operator: string;
  snapshot?: WorkOrder;
}

export interface CalculationRule {
  id: string;
  name: string;
  description: string;
  formula: string;
  sourceRef: string;
}

export interface AbnormalEvent {
  id: string;
  workOrderId: string;
  sparePartId: string;
  type: 'delayed_arrival' | 'replacement_blocked';
  startTime: string;
  endTime: string;
  description: string;
}
