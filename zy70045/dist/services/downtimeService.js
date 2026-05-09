"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.downtimeService = exports.DowntimeService = void 0;
const inMemoryStore_1 = require("../storage/inMemoryStore");
class DowntimeService {
    recordDowntime(params) {
        const duration = Math.round((params.endTime.getTime() - params.startTime.getTime()) / 60000);
        if (duration <= 0) {
            throw new Error('停机时长必须大于0分钟');
        }
        if (!params.reason || params.reason.trim().length === 0) {
            throw new Error('停机原因不能为空');
        }
        const now = new Date();
        const record = {
            id: inMemoryStore_1.store.generateId(),
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
        return inMemoryStore_1.store.saveDowntime(record);
    }
    getShiftDurationMinutes(shiftId) {
        const shift = inMemoryStore_1.store.getShiftById(shiftId);
        if (!shift) {
            throw new Error(`班次不存在: ${shiftId}`);
        }
        if (!shift.endTime) {
            return Math.round((Date.now() - shift.startTime.getTime()) / 60000);
        }
        return Math.round((shift.endTime.getTime() - shift.startTime.getTime()) / 60000);
    }
    calculateOverlapMinutes(downtimeStart, downtimeEnd, shiftStart, shiftEnd) {
        const overlapStart = Math.max(downtimeStart.getTime(), shiftStart.getTime());
        const overlapEnd = Math.min(downtimeEnd.getTime(), shiftEnd.getTime());
        if (overlapStart >= overlapEnd) {
            return 0;
        }
        return Math.round((overlapEnd - overlapStart) / 60000);
    }
    allocateDowntime(downtimeId, shiftId) {
        const downtime = inMemoryStore_1.store.getDowntimeById(downtimeId);
        if (!downtime) {
            throw new Error(`停机记录不存在: ${downtimeId}`);
        }
        if (!downtime.endTime) {
            throw new Error('停机未结束，无法分摊');
        }
        const shift = inMemoryStore_1.store.getShiftById(shiftId);
        if (!shift) {
            throw new Error(`班次不存在: ${shiftId}`);
        }
        if (!shift.endTime) {
            throw new Error('班次未结束，无法分摊停机');
        }
        const overlapMinutes = this.calculateOverlapMinutes(downtime.startTime, downtime.endTime, shift.startTime, shift.endTime);
        if (overlapMinutes <= 0) {
            throw new Error('停机时间与班次时间无重叠');
        }
        const percentage = (overlapMinutes / downtime.durationMinutes) * 100;
        const existingAllocations = inMemoryStore_1.store.getAllocationsByDowntime(downtimeId);
        const existingAllocation = existingAllocations.find((a) => a.shiftId === shiftId);
        if (existingAllocation) {
            throw new Error('该班次已分摊过此停机');
        }
        const allocation = {
            id: inMemoryStore_1.store.generateId(),
            downtimeId,
            shiftId,
            durationMinutes: overlapMinutes,
            percentage,
            allocatedAt: new Date(),
        };
        const savedAllocation = inMemoryStore_1.store.saveAllocation(allocation);
        const updatedDowntime = {
            ...downtime,
            status: 'allocated',
            updatedAt: new Date(),
            version: downtime.version + 1,
        };
        inMemoryStore_1.store.saveDowntime(updatedDowntime);
        return savedAllocation;
    }
    autoAllocateDowntimeForLine(lineId) {
        const shifts = inMemoryStore_1.store.getShiftsByLine(lineId);
        const closedShifts = shifts.filter((s) => s.status !== 'active');
        if (closedShifts.length === 0) {
            return [];
        }
        const pendingDowntimes = inMemoryStore_1.store
            .getDowntimesByLine(lineId)
            .filter((d) => d.status === 'pending' && d.endTime);
        const results = [];
        for (const downtime of pendingDowntimes) {
            const allocations = [];
            for (const shift of closedShifts) {
                if (!shift.endTime)
                    continue;
                const overlapMinutes = this.calculateOverlapMinutes(downtime.startTime, downtime.endTime, shift.startTime, shift.endTime);
                if (overlapMinutes > 0) {
                    const percentage = (overlapMinutes / downtime.durationMinutes) * 100;
                    const allocation = {
                        id: inMemoryStore_1.store.generateId(),
                        downtimeId: downtime.id,
                        shiftId: shift.id,
                        durationMinutes: overlapMinutes,
                        percentage,
                        allocatedAt: new Date(),
                    };
                    allocations.push(inMemoryStore_1.store.saveAllocation(allocation));
                }
            }
            if (allocations.length > 0) {
                const updatedDowntime = {
                    ...downtime,
                    status: 'allocated',
                    updatedAt: new Date(),
                    version: downtime.version + 1,
                };
                inMemoryStore_1.store.saveDowntime(updatedDowntime);
            }
            results.push({
                downtimeId: downtime.id,
                allocations,
            });
        }
        return results;
    }
    getShiftDowntime(shiftId) {
        const allocations = inMemoryStore_1.store.getAllocationsByShift(shiftId);
        const totalMinutes = allocations.reduce((sum, a) => sum + a.durationMinutes, 0);
        const downtimeDetails = allocations
            .map((a) => inMemoryStore_1.store.getDowntimeById(a.downtimeId))
            .filter((d) => d !== undefined);
        return {
            totalMinutes,
            allocations,
            downtimeDetails,
        };
    }
    getDowntimeAllocations(downtimeId) {
        const downtime = inMemoryStore_1.store.getDowntimeById(downtimeId);
        if (!downtime) {
            throw new Error(`停机记录不存在: ${downtimeId}`);
        }
        const allocations = inMemoryStore_1.store.getAllocationsByDowntime(downtimeId);
        const totalAllocatedMinutes = allocations.reduce((sum, a) => sum + a.durationMinutes, 0);
        return {
            downtime,
            allocations,
            totalAllocatedMinutes,
            unallocatedMinutes: downtime.durationMinutes - totalAllocatedMinutes,
        };
    }
    getDowntimeStatus(downtimeId) {
        const downtime = inMemoryStore_1.store.getDowntimeById(downtimeId);
        if (!downtime) {
            throw new Error(`停机记录不存在: ${downtimeId}`);
        }
        const revisions = inMemoryStore_1.store.getRevisionsByTarget(downtimeId, 'downtime');
        return {
            status: downtime.status,
            version: downtime.version,
            isRevised: revisions.length > 0,
        };
    }
}
exports.DowntimeService = DowntimeService;
exports.downtimeService = new DowntimeService();
//# sourceMappingURL=downtimeService.js.map