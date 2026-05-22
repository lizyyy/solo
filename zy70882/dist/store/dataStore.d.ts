import { MeterReading, TenantContract, TemperatureZone, MultiplierChange, BillingRecord, BillingSummary } from '../types';
declare class DataStore {
    private meterReadings;
    private tenantContracts;
    private temperatureZones;
    private multiplierChanges;
    private billingRecords;
    addMeterReading(reading: Omit<MeterReading, 'id'>): MeterReading;
    addMeterReadings(readings: Omit<MeterReading, 'id'>[]): MeterReading[];
    getMeterReadingsByPeriod(start: Date, end: Date): MeterReading[];
    getMeterReadingsByZone(zoneId: string, start?: Date, end?: Date): MeterReading[];
    addTenantContract(contract: Omit<TenantContract, 'id'>): TenantContract;
    getTenantContract(tenantId: string): TenantContract | undefined;
    getAllContracts(): TenantContract[];
    addTemperatureZone(zone: Omit<TemperatureZone, 'id'> & {
        id?: string;
    }): TemperatureZone;
    getTemperatureZone(zoneId: string): TemperatureZone | undefined;
    getAllZones(): TemperatureZone[];
    addMultiplierChange(change: Omit<MultiplierChange, 'id'>): MultiplierChange;
    getMultiplierChangesByZone(zoneId: string): MultiplierChange[];
    getMultiplierChangesByPeriod(start: Date, end: Date): MultiplierChange[];
    addBillingRecord(record: Omit<BillingRecord, 'id' | 'createdAt' | 'updatedAt'>): BillingRecord;
    updateBillingRecord(id: string, updates: Partial<BillingRecord>): BillingRecord | undefined;
    getBillingRecord(id: string): BillingRecord | undefined;
    getBillingRecordsByPeriod(start: Date, end: Date): BillingRecord[];
    getBillingRecordsByTenant(tenantId: string, start?: Date, end?: Date): BillingRecord[];
    getAllBillingRecords(): BillingRecord[];
    deleteBillingRecordsByPeriod(start: Date, end: Date): void;
    getBillingSummary(start: Date, end: Date): BillingSummary;
    clearAllData(): void;
}
export declare const dataStore: DataStore;
export {};
