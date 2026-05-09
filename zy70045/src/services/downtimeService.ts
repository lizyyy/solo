import { store } from '../storage/inMemoryStore';
import {
  DowntimeRecord,
  DowntimeAllocation,
  DowntimeStatus,
} from '../models/types';

export class DowntimeService {
  recordDowntime(params: {
    lineId: string;
    startTime: Date;
    endTime: Date;
    reason: string;
    createdBy: string;
  }): DowntimeRecord {
    const duration = Math.round(
      (params.endTime.getTime() - params.startTime.getTime()) / 60000
    );

    if (duration <= 0) {
      throw new Error('停机时长必须大于0分钟');
    }

    if (!params.reason || params.reason.trim().length === 0) {
      throw new Error('停机原因不能为空');
    }

    const now = new Date();
    const record: DowntimeRecord = {
      id: store.generateId(),
      lineId: params.lineId,
      startTime: params.startTime,
      endTime: params.endTime,
      durationMinutes: duration,
      reason: params.reason,
      status: 'pending',
      createdBy: params.createdBy,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    return store.saveDowntime(record);
  }

  getShiftDurationMinutes(shiftId: string): number {
    const shift = store.getShiftById(shiftId);
    if (!shift) {
      throw new Error(`班次不存在: ${shiftId}`);
    }

    if (!shift.endTime) {
      return Math.round((Date.now() - shift.startTime.getTime()) / 60000);
    }

    return Math.round(
      (shift.endTime.getTime() - shift.startTime.getTime()) / 60000
    );
  }

  calculateOverlapMinutes(
    downtimeStart: Date,
    downtimeEnd: Date,
    shiftStart: Date,
    shiftEnd: Date
  ): number {
    const overlapStart = Math.max(
      downtimeStart.getTime(),
      shiftStart.getTime()
    );
    const overlapEnd = Math.min(downtimeEnd.getTime(), shiftEnd.getTime());

    if (overlapStart >= overlapEnd) {
      return 0;
    }

    return Math.round((overlapEnd - overlapStart) / 60000);
  }

  allocateDowntime(downtimeId: string, shiftId: string): DowntimeAllocation {
    const downtime = store.getDowntimeById(downtimeId);
    if (!downtime) {
      throw new Error(`停机记录不存在: ${downtimeId}`);
    }

    if (!downtime.endTime) {
      throw new Error('停机未结束，无法分摊');
    }

    const shift = store.getShiftById(shiftId);
    if (!shift) {
      throw new Error(`班次不存在: ${shiftId}`);
    }

    if (!shift.endTime) {
      throw new Error('班次未结束，无法分摊停机');
    }

    const overlapMinutes = this.calculateOverlapMinutes(
      downtime.startTime,
      downtime.endTime,
      shift.startTime,
      shift.endTime
    );

    if (overlapMinutes <= 0) {
      throw new Error('停机时间与班次时间无重叠');
    }

    const percentage = (overlapMinutes / downtime.durationMinutes) * 100;

    const existingAllocations = store.getAllocationsByDowntime(downtimeId);
    const existingAllocation = existingAllocations.find(
      (a) => a.shiftId === shiftId
    );

    if (existingAllocation) {
      throw new Error('该班次已分摊过此停机');
    }

    const allocation: DowntimeAllocation = {
      id: store.generateId(),
      downtimeId,
      shiftId,
      durationMinutes: overlapMinutes,
      percentage,
      allocatedAt: new Date(),
    };

    const savedAllocation = store.saveAllocation(allocation);

    const updatedDowntime: DowntimeRecord = {
      ...downtime,
      status: 'allocated',
      updatedAt: new Date(),
      version: downtime.version + 1,
    };
    store.saveDowntime(updatedDowntime);

    return savedAllocation;
  }

  autoAllocateDowntimeForLine(
    lineId: string
  ): Array<{
    downtimeId: string;
    allocations: DowntimeAllocation[];
  }> {
    const shifts = store.getShiftsByLine(lineId);
    const closedShifts = shifts.filter((s) => s.status !== 'active');

    if (closedShifts.length === 0) {
      return [];
    }

    const pendingDowntimes = store
      .getDowntimesByLine(lineId)
      .filter((d) => d.status === 'pending' && d.endTime);

    const results: Array<{
      downtimeId: string;
      allocations: DowntimeAllocation[];
    }> = [];

    for (const downtime of pendingDowntimes) {
      const allocations: DowntimeAllocation[] = [];

      for (const shift of closedShifts) {
        if (!shift.endTime) continue;

        const overlapMinutes = this.calculateOverlapMinutes(
          downtime.startTime,
          downtime.endTime!,
          shift.startTime,
          shift.endTime
        );

        if (overlapMinutes > 0) {
          const percentage = (overlapMinutes / downtime.durationMinutes) * 100;

          const allocation: DowntimeAllocation = {
            id: store.generateId(),
            downtimeId: downtime.id,
            shiftId: shift.id,
            durationMinutes: overlapMinutes,
            percentage,
            allocatedAt: new Date(),
          };

          allocations.push(store.saveAllocation(allocation));
        }
      }

      if (allocations.length > 0) {
        const updatedDowntime: DowntimeRecord = {
          ...downtime,
          status: 'allocated',
          updatedAt: new Date(),
          version: downtime.version + 1,
        };
        store.saveDowntime(updatedDowntime);
      }

      results.push({
        downtimeId: downtime.id,
        allocations,
      });
    }

    return results;
  }

  getShiftDowntime(shiftId: string): {
    totalMinutes: number;
    allocations: DowntimeAllocation[];
    downtimeDetails: DowntimeRecord[];
  } {
    const allocations = store.getAllocationsByShift(shiftId);
    const totalMinutes = allocations.reduce(
      (sum, a) => sum + a.durationMinutes,
      0
    );

    const downtimeDetails = allocations
      .map((a) => store.getDowntimeById(a.downtimeId))
      .filter((d): d is DowntimeRecord => d !== undefined);

    return {
      totalMinutes,
      allocations,
      downtimeDetails,
    };
  }

  getDowntimeAllocations(downtimeId: string): {
    downtime: DowntimeRecord;
    allocations: DowntimeAllocation[];
    totalAllocatedMinutes: number;
    unallocatedMinutes: number;
  } {
    const downtime = store.getDowntimeById(downtimeId);
    if (!downtime) {
      throw new Error(`停机记录不存在: ${downtimeId}`);
    }

    const allocations = store.getAllocationsByDowntime(downtimeId);
    const totalAllocatedMinutes = allocations.reduce(
      (sum, a) => sum + a.durationMinutes,
      0
    );

    return {
      downtime,
      allocations,
      totalAllocatedMinutes,
      unallocatedMinutes: downtime.durationMinutes - totalAllocatedMinutes,
    };
  }

  getDowntimeStatus(downtimeId: string): {
    status: DowntimeStatus;
    version: number;
    isRevised: boolean;
  } {
    const downtime = store.getDowntimeById(downtimeId);
    if (!downtime) {
      throw new Error(`停机记录不存在: ${downtimeId}`);
    }

    const revisions = store.getRevisionsByTarget(downtimeId, 'downtime');
    return {
      status: downtime.status,
      version: downtime.version,
      isRevised: revisions.length > 0,
    };
  }
}

export const downtimeService = new DowntimeService();
