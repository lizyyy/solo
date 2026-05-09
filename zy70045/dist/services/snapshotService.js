"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.snapshotService = exports.SnapshotService = void 0;
const inMemoryStore_1 = require("../storage/inMemoryStore");
const productionService_1 = require("./productionService");
const downtimeService_1 = require("./downtimeService");
class SnapshotService {
    createSnapshot(shiftId, params) {
        const shift = inMemoryStore_1.store.getShiftById(shiftId);
        if (!shift) {
            throw new Error(`班次不存在: ${shiftId}`);
        }
        const productions = productionService_1.productionService.getShiftProductions(shiftId);
        const wastes = productionService_1.productionService.getShiftWastes(shiftId);
        const downtime = downtimeService_1.downtimeService.getShiftDowntime(shiftId);
        const shiftDuration = downtimeService_1.downtimeService.getShiftDurationMinutes(shiftId);
        const effectiveTimeMinutes = shiftDuration - downtime.totalMinutes;
        const snapshot = {
            id: inMemoryStore_1.store.generateId(),
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
        return inMemoryStore_1.store.saveSnapshot(snapshot);
    }
    getSnapshot(shiftId, version) {
        const snapshots = inMemoryStore_1.store.getSnapshotsByShift(shiftId);
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
    getSnapshotHistory(shiftId) {
        return inMemoryStore_1.store.getSnapshotsByShift(shiftId);
    }
    getLatestSnapshot(shiftId) {
        return inMemoryStore_1.store.getLatestSnapshot(shiftId);
    }
    getShiftSummaryFromSnapshot(shiftId, version) {
        const shift = inMemoryStore_1.store.getShiftById(shiftId);
        if (!shift) {
            throw new Error(`班次不存在: ${shiftId}`);
        }
        const snapshot = version !== undefined
            ? inMemoryStore_1.store.getSnapshotByShiftVersion(shiftId, version)
            : inMemoryStore_1.store.getLatestSnapshot(shiftId);
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
                downtimeMinutes: snapshot.downtimeAllocations.reduce((sum, d) => sum + d.durationMinutes, 0),
            },
        };
    }
    getAllSnapshotsForDay(date, lineId) {
        const [year, month, day] = date.split('-').map(Number);
        const targetDate = new Date(year, month - 1, day);
        const nextDate = new Date(year, month - 1, day + 1);
        if (!lineId) {
            return [];
        }
        const shifts = inMemoryStore_1.store.getShiftsByLine(lineId);
        const dayShifts = shifts.filter((s) => {
            const startTime = s.startTime;
            const endTime = s.endTime || new Date();
            return startTime < nextDate && endTime > targetDate;
        });
        return dayShifts.map((shift) => {
            const snapshot = inMemoryStore_1.store.getLatestSnapshot(shift.id);
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
exports.SnapshotService = SnapshotService;
exports.snapshotService = new SnapshotService();
//# sourceMappingURL=snapshotService.js.map