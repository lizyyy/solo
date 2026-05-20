import {
  MeterReading,
  TenantContract,
  TemperatureZone,
  MultiplierChange,
  BillingRecord,
  ReviewStatus,
  BillingSummary
} from '../types';
import { v4 as uuidv4 } from 'uuid';

class DataStore {
  private meterReadings: Map<string, MeterReading> = new Map();
  private tenantContracts: Map<string, TenantContract> = new Map();
  private temperatureZones: Map<string, TemperatureZone> = new Map();
  private multiplierChanges: Map<string, MultiplierChange> = new Map();
  private billingRecords: Map<string, BillingRecord> = new Map();

  addMeterReading(reading: Omit<MeterReading, 'id'>): MeterReading {
    const id = uuidv4();
    const newReading = { ...reading, id };
    this.meterReadings.set(id, newReading);
    return newReading;
  }

  addMeterReadings(readings: Omit<MeterReading, 'id'>[]): MeterReading[] {
    return readings.map(r => this.addMeterReading(r));
  }

  getMeterReadingsByPeriod(start: Date, end: Date): MeterReading[] {
    return Array.from(this.meterReadings.values()).filter(
      r => r.timestamp >= start && r.timestamp <= end
    );
  }

  getMeterReadingsByZone(zoneId: string, start?: Date, end?: Date): MeterReading[] {
    let readings = Array.from(this.meterReadings.values()).filter(r => r.zoneId === zoneId);
    if (start && end) {
      readings = readings.filter(r => r.timestamp >= start && r.timestamp <= end);
    }
    return readings;
  }

  addTenantContract(contract: Omit<TenantContract, 'id'>): TenantContract {
    const id = uuidv4();
    const newContract = { ...contract, id };
    this.tenantContracts.set(id, newContract);
    return newContract;
  }

  getTenantContract(tenantId: string): TenantContract | undefined {
    return Array.from(this.tenantContracts.values()).find(c => c.tenantId === tenantId && c.status === 'active');
  }

  getAllContracts(): TenantContract[] {
    return Array.from(this.tenantContracts.values());
  }

  addTemperatureZone(zone: Omit<TemperatureZone, 'id'>): TemperatureZone {
    const id = uuidv4();
    const newZone = { ...zone, id };
    this.temperatureZones.set(id, newZone);
    return newZone;
  }

  getTemperatureZone(zoneId: string): TemperatureZone | undefined {
    return this.temperatureZones.get(zoneId);
  }

  getAllZones(): TemperatureZone[] {
    return Array.from(this.temperatureZones.values());
  }

  addMultiplierChange(change: Omit<MultiplierChange, 'id'>): MultiplierChange {
    const id = uuidv4();
    const newChange = { ...change, id };
    this.multiplierChanges.set(id, newChange);
    return newChange;
  }

  getMultiplierChangesByZone(zoneId: string): MultiplierChange[] {
    return Array.from(this.multiplierChanges.values()).filter(c => c.zoneId === zoneId);
  }

  getMultiplierChangesByPeriod(start: Date, end: Date): MultiplierChange[] {
    return Array.from(this.multiplierChanges.values()).filter(
      c => c.effectiveDate >= start && c.effectiveDate <= end
    );
  }

  addBillingRecord(record: Omit<BillingRecord, 'id' | 'createdAt' | 'updatedAt'>): BillingRecord {
    const id = uuidv4();
    const now = new Date();
    const newRecord = { ...record, id, createdAt: now, updatedAt: now };
    this.billingRecords.set(id, newRecord);
    return newRecord;
  }

  updateBillingRecord(id: string, updates: Partial<BillingRecord>): BillingRecord | undefined {
    const record = this.billingRecords.get(id);
    if (!record) return undefined;
    const updated = { ...record, ...updates, updatedAt: new Date() };
    this.billingRecords.set(id, updated);
    return updated;
  }

  getBillingRecord(id: string): BillingRecord | undefined {
    return this.billingRecords.get(id);
  }

  getBillingRecordsByPeriod(start: Date, end: Date): BillingRecord[] {
    return Array.from(this.billingRecords.values()).filter(
      r => r.periodStart >= start && r.periodEnd <= end
    );
  }

  getBillingRecordsByTenant(tenantId: string, start?: Date, end?: Date): BillingRecord[] {
    let records = Array.from(this.billingRecords.values()).filter(r => r.tenantId === tenantId);
    if (start && end) {
      records = records.filter(r => r.periodStart >= start && r.periodEnd <= end);
    }
    return records;
  }

  getAllBillingRecords(): BillingRecord[] {
    return Array.from(this.billingRecords.values());
  }

  deleteBillingRecordsByPeriod(start: Date, end: Date): void {
    const toDelete = this.getBillingRecordsByPeriod(start, end);
    toDelete.forEach(r => this.billingRecords.delete(r.id));
  }

  getBillingSummary(start: Date, end: Date): BillingSummary {
    const records = this.getBillingRecordsByPeriod(start, end);
    const summary: BillingSummary = {
      periodStart: start,
      periodEnd: end,
      totalTenants: new Set(records.map(r => r.tenantId)).size,
      totalConsumption: records.reduce((sum, r) => sum + r.totalConsumption, 0),
      totalElectricityCost: records.reduce((sum, r) => sum + r.electricityCost, 0),
      totalBaseRent: records.reduce((sum, r) => sum + r.baseRent, 0),
      totalOvertimeSurcharge: records.reduce((sum, r) => sum + r.overtimeSurcharge, 0),
      grandTotal: records.reduce((sum, r) => sum + r.totalAmount, 0),
      recordsByStatus: {
        [ReviewStatus.PENDING]: records.filter(r => r.reviewStatus === ReviewStatus.PENDING).length,
        [ReviewStatus.APPROVED]: records.filter(r => r.reviewStatus === ReviewStatus.APPROVED).length,
        [ReviewStatus.REJECTED]: records.filter(r => r.reviewStatus === ReviewStatus.REJECTED).length,
        [ReviewStatus.NEEDS_MORE_INFO]: records.filter(r => r.reviewStatus === ReviewStatus.NEEDS_MORE_INFO).length,
      },
      anomalyCount: records.reduce((sum, r) => sum + r.anomalies.filter(a => !a.resolved).length, 0),
    };
    return summary;
  }

  clearAllData(): void {
    this.meterReadings.clear();
    this.tenantContracts.clear();
    this.temperatureZones.clear();
    this.multiplierChanges.clear();
    this.billingRecords.clear();
  }
}

export const dataStore = new DataStore();
