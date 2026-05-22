"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataStore = void 0;
const types_1 = require("../types");
const uuid_1 = require("uuid");
class DataStore {
    constructor() {
        this.meterReadings = new Map();
        this.tenantContracts = new Map();
        this.temperatureZones = new Map();
        this.multiplierChanges = new Map();
        this.billingRecords = new Map();
    }
    addMeterReading(reading) {
        const id = (0, uuid_1.v4)();
        const newReading = { ...reading, id };
        this.meterReadings.set(id, newReading);
        return newReading;
    }
    addMeterReadings(readings) {
        return readings.map(r => this.addMeterReading(r));
    }
    getMeterReadingsByPeriod(start, end) {
        return Array.from(this.meterReadings.values()).filter(r => r.timestamp >= start && r.timestamp <= end);
    }
    getMeterReadingsByZone(zoneId, start, end) {
        let readings = Array.from(this.meterReadings.values()).filter(r => r.zoneId === zoneId);
        if (start && end) {
            readings = readings.filter(r => r.timestamp >= start && r.timestamp <= end);
        }
        return readings;
    }
    addTenantContract(contract) {
        const id = (0, uuid_1.v4)();
        const newContract = { ...contract, id };
        this.tenantContracts.set(id, newContract);
        return newContract;
    }
    getTenantContract(tenantId) {
        return Array.from(this.tenantContracts.values()).find(c => c.tenantId === tenantId && c.status === 'active');
    }
    getAllContracts() {
        return Array.from(this.tenantContracts.values());
    }
    addTemperatureZone(zone) {
        const id = zone.id || (0, uuid_1.v4)();
        const newZone = { ...zone, id };
        this.temperatureZones.set(id, newZone);
        return newZone;
    }
    getTemperatureZone(zoneId) {
        return this.temperatureZones.get(zoneId);
    }
    getAllZones() {
        return Array.from(this.temperatureZones.values());
    }
    addMultiplierChange(change) {
        const id = (0, uuid_1.v4)();
        const newChange = { ...change, id };
        this.multiplierChanges.set(id, newChange);
        return newChange;
    }
    getMultiplierChangesByZone(zoneId) {
        return Array.from(this.multiplierChanges.values()).filter(c => c.zoneId === zoneId);
    }
    getMultiplierChangesByPeriod(start, end) {
        return Array.from(this.multiplierChanges.values()).filter(c => c.effectiveDate >= start && c.effectiveDate <= end);
    }
    addBillingRecord(record) {
        const id = (0, uuid_1.v4)();
        const now = new Date();
        const newRecord = { ...record, id, createdAt: now, updatedAt: now };
        this.billingRecords.set(id, newRecord);
        return newRecord;
    }
    updateBillingRecord(id, updates) {
        const record = this.billingRecords.get(id);
        if (!record)
            return undefined;
        const updated = { ...record, ...updates, updatedAt: new Date() };
        this.billingRecords.set(id, updated);
        return updated;
    }
    getBillingRecord(id) {
        return this.billingRecords.get(id);
    }
    getBillingRecordsByPeriod(start, end) {
        return Array.from(this.billingRecords.values()).filter(r => r.periodStart >= start && r.periodEnd <= end);
    }
    getBillingRecordsByTenant(tenantId, start, end) {
        let records = Array.from(this.billingRecords.values()).filter(r => r.tenantId === tenantId);
        if (start && end) {
            records = records.filter(r => r.periodStart >= start && r.periodEnd <= end);
        }
        return records;
    }
    getAllBillingRecords() {
        return Array.from(this.billingRecords.values());
    }
    deleteBillingRecordsByPeriod(start, end) {
        const toDelete = this.getBillingRecordsByPeriod(start, end);
        toDelete.forEach(r => this.billingRecords.delete(r.id));
    }
    getBillingSummary(start, end) {
        const records = this.getBillingRecordsByPeriod(start, end);
        const summary = {
            periodStart: start,
            periodEnd: end,
            totalTenants: new Set(records.map(r => r.tenantId)).size,
            totalConsumption: records.reduce((sum, r) => sum + r.totalConsumption, 0),
            totalElectricityCost: records.reduce((sum, r) => sum + r.electricityCost, 0),
            totalBaseRent: records.reduce((sum, r) => sum + r.baseRent, 0),
            totalOvertimeSurcharge: records.reduce((sum, r) => sum + r.overtimeSurcharge, 0),
            grandTotal: records.reduce((sum, r) => sum + r.totalAmount, 0),
            recordsByStatus: {
                [types_1.ReviewStatus.PENDING]: records.filter(r => r.reviewStatus === types_1.ReviewStatus.PENDING).length,
                [types_1.ReviewStatus.APPROVED]: records.filter(r => r.reviewStatus === types_1.ReviewStatus.APPROVED).length,
                [types_1.ReviewStatus.REJECTED]: records.filter(r => r.reviewStatus === types_1.ReviewStatus.REJECTED).length,
                [types_1.ReviewStatus.NEEDS_MORE_INFO]: records.filter(r => r.reviewStatus === types_1.ReviewStatus.NEEDS_MORE_INFO).length,
            },
            anomalyCount: records.reduce((sum, r) => sum + r.anomalies.filter(a => !a.resolved).length, 0),
        };
        return summary;
    }
    clearAllData() {
        this.meterReadings.clear();
        this.tenantContracts.clear();
        this.temperatureZones.clear();
        this.multiplierChanges.clear();
        this.billingRecords.clear();
    }
}
exports.dataStore = new DataStore();
//# sourceMappingURL=dataStore.js.map