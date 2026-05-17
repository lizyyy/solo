"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.store = exports.InMemoryStore = void 0;
const uuid_1 = require("uuid");
class InMemoryStore {
    constructor() {
        this.leases = new Map();
        this.history = new Map();
    }
    createLease(data) {
        const now = new Date().toISOString();
        const lease = {
            id: data.id || (0, uuid_1.v4)(),
            leaseNo: data.leaseNo || `L${Date.now()}`,
            customer: data.customer || { id: '', name: '', phone: '', email: '' },
            asset: data.asset || { id: '', name: '', assetNo: '', type: '' },
            startDate: data.startDate || now,
            endDate: data.endDate || now,
            price: data.price || 0,
            status: data.status || 'leasing',
            paymentStatus: data.paymentStatus || 'paid',
            renewalRule: data.renewalRule || {
                id: (0, uuid_1.v4)(),
                name: '默认续租规则',
                autoRenewalDays: 30,
                newLeaseTerm: 12,
                priceAdjustment: 0,
                isActive: true
            },
            conflicts: data.conflicts || [],
            renewalRecords: data.renewalRecords || [],
            remarks: data.remarks || [],
            createdAt: now,
            updatedAt: now,
            createdBy: data.createdBy || 'system',
            importBadRows: data.importBadRows || []
        };
        this.leases.set(lease.id, lease);
        this.history.set(lease.id, []);
        return lease;
    }
    getLease(id) {
        return this.leases.get(id);
    }
    listLeases() {
        return Array.from(this.leases.values());
    }
    updateLease(id, updates) {
        const lease = this.leases.get(id);
        if (!lease)
            return undefined;
        const updated = { ...lease, ...updates, updatedAt: new Date().toISOString() };
        this.leases.set(id, updated);
        return updated;
    }
    deleteLease(id) {
        return this.leases.delete(id);
    }
    addConflict(leaseId, conflict) {
        const lease = this.leases.get(leaseId);
        if (!lease)
            return undefined;
        const newConflict = {
            id: (0, uuid_1.v4)(),
            ...conflict
        };
        const updatedConflicts = [...lease.conflicts, newConflict];
        this.leases.set(leaseId, { ...lease, conflicts: updatedConflicts, updatedAt: new Date().toISOString() });
        return newConflict;
    }
    updateConflict(leaseId, conflictId, updates) {
        const lease = this.leases.get(leaseId);
        if (!lease)
            return undefined;
        const updatedConflicts = lease.conflicts.map(c => c.id === conflictId ? { ...c, ...updates } : c);
        const updatedConflict = updatedConflicts.find(c => c.id === conflictId);
        this.leases.set(leaseId, { ...lease, conflicts: updatedConflicts, updatedAt: new Date().toISOString() });
        return updatedConflict;
    }
    addRemark(leaseId, remark) {
        const lease = this.leases.get(leaseId);
        if (!lease)
            return undefined;
        const newRemark = {
            id: (0, uuid_1.v4)(),
            createdAt: new Date().toISOString(),
            ...remark
        };
        const updatedRemarks = [...lease.remarks, newRemark];
        this.leases.set(leaseId, { ...lease, remarks: updatedRemarks, updatedAt: new Date().toISOString() });
        return newRemark;
    }
    addHistory(leaseId, record) {
        const historyRecord = {
            id: (0, uuid_1.v4)(),
            leaseId,
            timestamp: new Date().toISOString(),
            ...record
        };
        const records = this.history.get(leaseId) || [];
        records.push(historyRecord);
        this.history.set(leaseId, records);
        return historyRecord;
    }
    getHistory(leaseId) {
        return this.history.get(leaseId) || [];
    }
    setImportBadRows(leaseId, badRows) {
        const lease = this.leases.get(leaseId);
        if (!lease)
            return undefined;
        const updated = { ...lease, importBadRows: badRows, updatedAt: new Date().toISOString() };
        this.leases.set(leaseId, updated);
        return updated;
    }
    clearAll() {
        this.leases.clear();
        this.history.clear();
    }
}
exports.InMemoryStore = InMemoryStore;
exports.store = new InMemoryStore();
