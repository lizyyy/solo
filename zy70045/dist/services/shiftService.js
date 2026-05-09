"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shiftService = exports.ShiftService = void 0;
const inMemoryStore_1 = require("../storage/inMemoryStore");
class ShiftService {
    startShift(params) {
        const existingActive = inMemoryStore_1.store.getActiveShift(params.lineId);
        if (existingActive) {
            throw new Error(`产线 ${params.lineId} 已有进行中的班次: ${existingActive.teamName}`);
        }
        const now = new Date();
        const shift = {
            id: inMemoryStore_1.store.generateId(),
            lineId: params.lineId,
            teamId: params.teamId,
            teamName: params.teamName,
            startTime: params.startTime || now,
            status: 'active',
            createdAt: now,
            updatedAt: now,
            version: 1,
        };
        return inMemoryStore_1.store.saveShift(shift);
    }
    endShift(shiftId, endTime) {
        const shift = inMemoryStore_1.store.getShiftById(shiftId);
        if (!shift) {
            throw new Error(`班次不存在: ${shiftId}`);
        }
        if (shift.status !== 'active') {
            throw new Error(`班次状态不是进行中，无法结束: ${shift.status}`);
        }
        const updatedShift = {
            ...shift,
            endTime: endTime || new Date(),
            status: 'handover',
            updatedAt: new Date(),
            version: shift.version + 1,
        };
        return inMemoryStore_1.store.saveShift(updatedShift);
    }
    getShift(shiftId) {
        return inMemoryStore_1.store.getShiftById(shiftId);
    }
    getShiftHistory(shiftId) {
        return {
            current: inMemoryStore_1.store.getShiftById(shiftId),
            snapshots: inMemoryStore_1.store.getSnapshotsByShift(shiftId),
        };
    }
    getShiftStatus(shiftId) {
        const shift = inMemoryStore_1.store.getShiftById(shiftId);
        if (!shift) {
            throw new Error(`班次不存在: ${shiftId}`);
        }
        const revisions = inMemoryStore_1.store.getRevisionsByTarget(shiftId, 'shift');
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
exports.ShiftService = ShiftService;
exports.shiftService = new ShiftService();
//# sourceMappingURL=shiftService.js.map