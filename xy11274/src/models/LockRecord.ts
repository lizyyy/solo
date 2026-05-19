import { BaseEntity, LockStatus, ShiftType } from './types';

export interface LockRecord extends BaseEntity {
  idempotentKey: string;
  chargingPileId: string;
  chargingPileCode: string;
  forkliftId: string;
  forkliftCode: string;
  shiftId: string;
  date: string;
  shiftType: ShiftType;
  status: LockStatus;
  lockTime: string;
  expectedReleaseTime?: string;
  actualReleaseTime?: string;
  releaseReason?: string;
  batteryLevelAtLock: number;
}

export interface LockAcquireInput {
  chargingPileId: string;
  forkliftId: string;
  shiftId: string;
  date: string;
  shiftType: ShiftType;
  expectedDurationMinutes?: number;
  operator: string;
  role: string;
  idempotentKey: string;
}

export interface LockReleaseInput {
  lockId: string;
  releaseReason: string;
  operator: string;
  role: string;
  idempotentKey?: string;
}

export interface LockExceptionInput {
  lockId: string;
  exceptionReason: string;
  operator: string;
  role: string;
  idempotentKey?: string;
}
