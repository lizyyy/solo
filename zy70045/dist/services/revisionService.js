"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.revisionService = exports.RevisionService = void 0;
const inMemoryStore_1 = require("../storage/inMemoryStore");
class RevisionService {
    reviseProduction(id, params) {
        const record = inMemoryStore_1.store.getProductionById(id);
        if (!record) {
            throw new Error(`产量记录不存在: ${id}`);
        }
        const changes = {};
        if (params.changes.quantity !== undefined) {
            if (params.changes.quantity <= 0) {
                throw new Error('产量必须大于0');
            }
            changes.quantity = { from: record.quantity, to: params.changes.quantity };
        }
        if (params.changes.shiftId !== undefined) {
            const newShift = inMemoryStore_1.store.getShiftById(params.changes.shiftId);
            if (!newShift) {
                throw new Error(`目标班次不存在: ${params.changes.shiftId}`);
            }
            changes.shiftId = { from: record.shiftId, to: params.changes.shiftId };
        }
        const updatedRecord = {
            ...record,
            quantity: params.changes.quantity ?? record.quantity,
            shiftId: params.changes.shiftId ?? record.shiftId,
            status: 'revised',
            updatedAt: new Date(),
            version: record.version + 1,
        };
        inMemoryStore_1.store.saveProduction(updatedRecord);
        inMemoryStore_1.store.saveRevision({
            id: inMemoryStore_1.store.generateId(),
            targetId: id,
            targetType: 'production',
            previousVersion: record.version,
            newVersion: updatedRecord.version,
            changes,
            revisedBy: params.revisedBy,
            revisedAt: new Date(),
            reason: params.reason,
        });
        return updatedRecord;
    }
    reviseWaste(id, params) {
        const record = inMemoryStore_1.store.getWasteById(id);
        if (!record) {
            throw new Error(`废品记录不存在: ${id}`);
        }
        const changes = {};
        if (params.changes.quantity !== undefined) {
            if (params.changes.quantity <= 0) {
                throw new Error('废品数量必须大于0');
            }
            changes.quantity = { from: record.quantity, to: params.changes.quantity };
        }
        if (params.changes.reason !== undefined) {
            if (!params.changes.reason.trim()) {
                throw new Error('废品原因不能为空');
            }
            changes.reason = { from: record.reason, to: params.changes.reason };
        }
        if (params.changes.shiftId !== undefined) {
            const newShift = inMemoryStore_1.store.getShiftById(params.changes.shiftId);
            if (!newShift) {
                throw new Error(`目标班次不存在: ${params.changes.shiftId}`);
            }
            changes.shiftId = { from: record.shiftId, to: params.changes.shiftId };
        }
        const updatedRecord = {
            ...record,
            quantity: params.changes.quantity ?? record.quantity,
            reason: params.changes.reason ?? record.reason,
            shiftId: params.changes.shiftId ?? record.shiftId,
            status: 'revised',
            updatedAt: new Date(),
            version: record.version + 1,
        };
        inMemoryStore_1.store.saveWaste(updatedRecord);
        inMemoryStore_1.store.saveRevision({
            id: inMemoryStore_1.store.generateId(),
            targetId: id,
            targetType: 'waste',
            previousVersion: record.version,
            newVersion: updatedRecord.version,
            changes,
            revisedBy: params.revisedBy,
            revisedAt: new Date(),
            reason: params.reason,
        });
        return updatedRecord;
    }
    reviseDowntime(id, params) {
        const record = inMemoryStore_1.store.getDowntimeById(id);
        if (!record) {
            throw new Error(`停机记录不存在: ${id}`);
        }
        const changes = {};
        let newDuration = record.durationMinutes;
        if (params.changes.startTime !== undefined) {
            changes.startTime = { from: record.startTime, to: params.changes.startTime };
        }
        if (params.changes.endTime !== undefined) {
            changes.endTime = { from: record.endTime, to: params.changes.endTime };
        }
        if (params.changes.reason !== undefined) {
            if (!params.changes.reason.trim()) {
                throw new Error('停机原因不能为空');
            }
            changes.reason = { from: record.reason, to: params.changes.reason };
        }
        const newStartTime = params.changes.startTime ?? record.startTime;
        const newEndTime = params.changes.endTime ?? record.endTime;
        if (newEndTime) {
            newDuration = Math.round((newEndTime.getTime() - newStartTime.getTime()) / 60000);
            if (newDuration <= 0) {
                throw new Error('停机时长必须大于0分钟');
            }
        }
        const updatedRecord = {
            ...record,
            startTime: newStartTime,
            endTime: newEndTime,
            durationMinutes: newDuration,
            reason: params.changes.reason ?? record.reason,
            status: 'revised',
            updatedAt: new Date(),
            version: record.version + 1,
        };
        inMemoryStore_1.store.saveDowntime(updatedRecord);
        inMemoryStore_1.store.saveRevision({
            id: inMemoryStore_1.store.generateId(),
            targetId: id,
            targetType: 'downtime',
            previousVersion: record.version,
            newVersion: updatedRecord.version,
            changes,
            revisedBy: params.revisedBy,
            revisedAt: new Date(),
            reason: params.reason,
        });
        return updatedRecord;
    }
    getRevisionHistory(targetId, targetType) {
        return inMemoryStore_1.store.getRevisionsByTarget(targetId, targetType);
    }
    getCurrentVersion(targetId, targetType) {
        switch (targetType) {
            case 'shift': {
                const record = inMemoryStore_1.store.getShiftById(targetId);
                return record?.version ?? 0;
            }
            case 'production': {
                const record = inMemoryStore_1.store.getProductionById(targetId);
                return record?.version ?? 0;
            }
            case 'waste': {
                const record = inMemoryStore_1.store.getWasteById(targetId);
                return record?.version ?? 0;
            }
            case 'downtime': {
                const record = inMemoryStore_1.store.getDowntimeById(targetId);
                return record?.version ?? 0;
            }
            default:
                return 0;
        }
    }
    hasRevisions(targetId, targetType) {
        return this.getRevisionHistory(targetId, targetType).length > 0;
    }
}
exports.RevisionService = RevisionService;
exports.revisionService = new RevisionService();
//# sourceMappingURL=revisionService.js.map