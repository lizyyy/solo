export enum BottleStatus {
  CREATED = 'CREATED',
  BINDED = 'BINDED',
  SAMPLED = 'SAMPLED',
  COLD_STORED = 'COLD_STORED',
  TRANSFERRED = 'TRANSFERRED',
  RECEIVED = 'RECEIVED',
  TESTED = 'TESTED',
  RETURNED = 'RETURNED',
  REJECTED = 'REJECTED'
}

export interface SamplingTask {
  id: string;
  taskNo: string;
  samplingPoint: string;
  plannedDate: string;
  deadlineHours: number;
  createdAt: string;
}

export interface SampleBottle {
  id: string;
  bottleNo: string;
  taskId: string | null;
  status: BottleStatus;
  currentHandler: string | null;
  sampledAt: string | null;
  coldStoredAt: string | null;
  receivedAt: string | null;
  rejectedAt: string | null;
  rejectReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FlowRecord {
  id: string;
  bottleId: string;
  bottleNo: string;
  fromStatus: BottleStatus | null;
  toStatus: BottleStatus;
  handler: string | null;
  remark: string | null;
  operationTime: string;
  isColdStored: boolean;
}

export interface ColdStorageRecord {
  id: string;
  bottleId: string;
  startTime: string;
  endTime: string | null;
  temperature: number;
  handler: string;
}
