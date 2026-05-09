"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.store = exports.InMemoryStore = void 0;
const uuid_1 = require("uuid");
class InMemoryStore {
    constructor() {
        this.shifts = new Map();
        this.productions = new Map();
        this.wastes = new Map();
        this.downtimes = new Map();
        this.allocations = new Map();
        this.revisions = new Map();
        this.snapshots = new Map();
    }
    reset() {
        this.shifts.clear();
        this.productions.clear();
        this.wastes.clear();
        this.downtimes.clear();
        this.allocations.clear();
        this.revisions.clear();
        this.snapshots.clear();
    }
    generateId() {
        return (0, uuid_1.v4)();
    }
    saveShift(shift) {
        this.shifts.set(shift.id, shift);
        return shift;
    }
    getShiftById(id) {
        return this.shifts.get(id);
    }
    getShiftsByLine(lineId) {
        return Array.from(this.shifts.values())
            .filter((s) => s.lineId === lineId)
            .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    }
    getActiveShift(lineId) {
        return Array.from(this.shifts.values()).find((s) => s.lineId === lineId && s.status === 'active');
    }
    saveProduction(production) {
        this.productions.set(production.id, production);
        return production;
    }
    getProductionById(id) {
        return this.productions.get(id);
    }
    getProductionsByShift(shiftId) {
        return Array.from(this.productions.values()).filter((p) => p.shiftId === shiftId);
    }
    saveWaste(waste) {
        this.wastes.set(waste.id, waste);
        return waste;
    }
    getWasteById(id) {
        return this.wastes.get(id);
    }
    getWastesByShift(shiftId) {
        return Array.from(this.wastes.values()).filter((w) => w.shiftId === shiftId);
    }
    saveDowntime(downtime) {
        this.downtimes.set(downtime.id, downtime);
        return downtime;
    }
    getDowntimeById(id) {
        return this.downtimes.get(id);
    }
    getDowntimesByLine(lineId) {
        return Array.from(this.downtimes.values())
            .filter((d) => d.lineId === lineId)
            .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    }
    getDowntimesInTimeRange(lineId, startTime, endTime) {
        return Array.from(this.downtimes.values()).filter((d) => {
            if (d.lineId !== lineId)
                return false;
            if (!d.endTime)
                return false;
            return d.endTime > startTime && d.startTime < endTime;
        });
    }
    saveAllocation(allocation) {
        this.allocations.set(allocation.id, allocation);
        return allocation;
    }
    getAllocationsByDowntime(downtimeId) {
        return Array.from(this.allocations.values()).filter((a) => a.downtimeId === downtimeId);
    }
    getAllocationsByShift(shiftId) {
        return Array.from(this.allocations.values()).filter((a) => a.shiftId === shiftId);
    }
    saveRevision(revision) {
        this.revisions.set(revision.id, revision);
        return revision;
    }
    getRevisionsByTarget(targetId, targetType) {
        return Array.from(this.revisions.values())
            .filter((r) => r.targetId === targetId && r.targetType === targetType)
            .sort((a, b) => a.revisedAt.getTime() - b.revisedAt.getTime());
    }
    saveSnapshot(snapshot) {
        this.snapshots.set(snapshot.id, snapshot);
        return snapshot;
    }
    getSnapshotByShiftVersion(shiftId, shiftVersion) {
        return Array.from(this.snapshots.values()).find((s) => s.shiftId === shiftId && s.shiftVersion === shiftVersion);
    }
    getSnapshotsByShift(shiftId) {
        return Array.from(this.snapshots.values())
            .filter((s) => s.shiftId === shiftId)
            .sort((a, b) => a.shiftVersion - b.shiftVersion);
    }
    getLatestSnapshot(shiftId) {
        const snapshots = this.getSnapshotsByShift(shiftId);
        return snapshots.length > 0 ? snapshots[snapshots.length - 1] : undefined;
    }
}
exports.InMemoryStore = InMemoryStore;
exports.store = new InMemoryStore();
//# sourceMappingURL=inMemoryStore.js.map