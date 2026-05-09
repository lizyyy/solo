import { store } from '../storage/inMemoryStore';
import {
  Shift,
  ShiftSnapshot,
  ShiftStatus,
} from '../models/types';

export class ShiftService {
  startShift(params: {
    lineId: string;
    teamId: string;
    teamName: string;
    startTime?: Date;
  }): Shift {
    const existingActive = store.getActiveShift(params.lineId);
    if (existingActive) {
      throw new Error(
        `产线 ${params.lineId} 已有进行中的班次: ${existingActive.teamName}`
      );
    }

    const now = new Date();
    const shift: Shift = {
      id: store.generateId(),
      lineId: params.lineId,
      teamId: params.teamId,
      teamName: params.teamName,
      startTime: params.startTime || now,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    return store.saveShift(shift);
  }

  endShift(shiftId: string, endTime?: Date): Shift {
    const shift = store.getShiftById(shiftId);
    if (!shift) {
      throw new Error(`班次不存在: ${shiftId}`);
    }

    if (shift.status !== 'active') {
      throw new Error(`班次状态不是进行中，无法结束: ${shift.status}`);
    }

    const updatedShift: Shift = {
      ...shift,
      endTime: endTime || new Date(),
      status: 'handover',
      updatedAt: new Date(),
      version: shift.version + 1,
    };

    return store.saveShift(updatedShift);
  }

  getShift(shiftId: string): Shift | undefined {
    return store.getShiftById(shiftId);
  }

  getShiftHistory(shiftId: string): {
    current: Shift | undefined;
    snapshots: ShiftSnapshot[];
  } {
    return {
      current: store.getShiftById(shiftId),
      snapshots: store.getSnapshotsByShift(shiftId),
    };
  }

  getShiftStatus(shiftId: string): {
    status: ShiftStatus;
    version: number;
    isRevised: boolean;
    lastRevisedAt?: Date;
  } {
    const shift = store.getShiftById(shiftId);
    if (!shift) {
      throw new Error(`班次不存在: ${shiftId}`);
    }

    const revisions = store.getRevisionsByTarget(shiftId, 'shift');
    const isRevised = revisions.length > 0;
    const lastRevisedAt = revisions.length > 0
      ? revisions[revisions.length - 1].revisedAt
      : undefined;

    return {
      status: shift.status,
      version: shift.version,
      isRevised,
      lastRevisedAt,
    };
  }
}

export const shiftService = new ShiftService();
