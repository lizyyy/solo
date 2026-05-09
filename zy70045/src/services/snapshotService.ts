import { store } from '../storage/inMemoryStore';
import {
  ShiftSnapshot,
  Shift,
  ShiftStatus,
} from '../models/types';
import { productionService } from './productionService';
import { downtimeService } from './downtimeService';

export class SnapshotService {
  createSnapshot(
    shiftId: string,
    params?: {
      handoverFrom?: string;
      handoverTo?: string;
      isConfirmed?: boolean;
    }
  ): ShiftSnapshot {
    const shift = store.getShiftById(shiftId);
    if (!shift) {
      throw new Error(`班次不存在: ${shiftId}`);
    }

    const productions = productionService.getShiftProductions(shiftId);
    const wastes = productionService.getShiftWastes(shiftId);
    const downtime = downtimeService.getShiftDowntime(shiftId);
    const shiftDuration = downtimeService.getShiftDurationMinutes(shiftId);

    const effectiveTimeMinutes = shiftDuration - downtime.totalMinutes;

    const snapshot: ShiftSnapshot = {
      id: store.generateId(),
      shiftId,
      shiftVersion: shift.version,
      snapshotTime: new Date(),
      productionTotal: productions.total,
      wasteTotal: wastes.total,
      effectiveTimeMinutes,
      downtimeAllocations: downtime.allocations.map((a) => ({
        downtimeId: a.downtimeId,
        durationMinutes: a.durationMinutes,
      })),
      productionRecords: productions.records.map((r) => ({
        id: r.id,
        productId: r.productId,
        quantity: r.quantity,
      })),
      wasteRecords: wastes.records.map((r) => ({
        id: r.id,
        productId: r.productId,
        quantity: r.quantity,
        reason: r.reason,
      })),
      handoverFrom: params?.handoverFrom,
      handoverTo: params?.handoverTo,
      isConfirmed: params?.isConfirmed ?? false,
    };

    return store.saveSnapshot(snapshot);
  }

  getSnapshot(shiftId: string, version?: number): ShiftSnapshot | undefined {
    const snapshots = store.getSnapshotsByShift(shiftId);
    if (snapshots.length === 0) {
      return undefined;
    }

    if (version !== undefined) {
      if (version >= 1 && version <= snapshots.length) {
        return snapshots[version - 1];
      }
      return undefined;
    }
    return snapshots[snapshots.length - 1];
  }

  getSnapshotHistory(shiftId: string): ShiftSnapshot[] {
    return store.getSnapshotsByShift(shiftId);
  }

  getLatestSnapshot(shiftId: string): ShiftSnapshot | undefined {
    return store.getLatestSnapshot(shiftId);
  }

  getShiftSummaryFromSnapshot(
    shiftId: string,
    version?: number
  ): {
    shift: Shift;
    snapshot: ShiftSnapshot;
    summary: {
      productionTotal: number;
      wasteTotal: number;
      netProduction: number;
      effectiveTimeMinutes: number;
      downtimeMinutes: number;
    };
  } {
    const shift = store.getShiftById(shiftId);
    if (!shift) {
      throw new Error(`班次不存在: ${shiftId}`);
    }

    const snapshot = version !== undefined
      ? store.getSnapshotByShiftVersion(shiftId, version)
      : store.getLatestSnapshot(shiftId);

    if (!snapshot) {
      throw new Error(`班次 ${shiftId} 在版本 ${version ?? '最新'} 没有快照`);
    }

    return {
      shift,
      snapshot,
      summary: {
        productionTotal: snapshot.productionTotal,
        wasteTotal: snapshot.wasteTotal,
        netProduction: snapshot.productionTotal - snapshot.wasteTotal,
        effectiveTimeMinutes: snapshot.effectiveTimeMinutes,
        downtimeMinutes: snapshot.downtimeAllocations.reduce(
          (sum, d) => sum + d.durationMinutes,
          0
        ),
      },
    };
  }

  getAllSnapshotsForDay(date: string, lineId?: string): Array<{
      shiftId: string;
      teamName: string;
      startTime: Date;
      endTime: Date;
      productionTotal: number;
      wasteTotal: number;
      netProduction: number;
      status: ShiftStatus;
    }> {
    const [year, month, day] = date.split('-').map(Number);
    const targetDate = new Date(year, month - 1, day);
    const nextDate = new Date(year, month - 1, day + 1);

    if (!lineId) {
      return [];
    }

    const shifts = store.getShiftsByLine(lineId);
    const dayShifts = shifts.filter((s) => {
      const startTime = s.startTime;
      const endTime = s.endTime || new Date();
      return startTime < nextDate && endTime > targetDate;
    });

    return dayShifts.map((shift) => {
      const snapshot = store.getLatestSnapshot(shift.id);
      if (!snapshot) {
        return {
          shiftId: shift.id,
          teamName: shift.teamName,
          startTime: shift.startTime,
          endTime: shift.endTime || new Date(),
          productionTotal: 0,
          wasteTotal: 0,
          netProduction: 0,
          status: shift.status,
        };
      }

      return {
        shiftId: shift.id,
        teamName: shift.teamName,
        startTime: shift.startTime,
        endTime: shift.endTime || new Date(),
        productionTotal: snapshot.productionTotal,
        wasteTotal: snapshot.wasteTotal,
        netProduction: snapshot.productionTotal - snapshot.wasteTotal,
        status: shift.status,
      };
    });
  }
}

export const snapshotService = new SnapshotService();
