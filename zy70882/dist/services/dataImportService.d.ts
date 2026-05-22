import { MeterReading, TenantContract, TemperatureZone, MultiplierChange } from '../types';
export declare class DataImportService {
    parseMeterCSV(fileBuffer: Buffer, sourceFileName: string): Promise<{
        readings: Omit<MeterReading, 'id'>[];
        errors: string[];
    }>;
    private parseMeterRow;
    private isPeakHour;
    importMeterData(fileBuffer: Buffer, sourceFileName: string): Promise<{
        imported: number;
        errors: string[];
    }>;
    parseContractJSON(fileBuffer: Buffer): Promise<TenantContract>;
    private validateContractData;
    importContract(fileBuffer: Buffer): Promise<TenantContract>;
    importZones(zonesData: any[]): Promise<TemperatureZone[]>;
    private validateZoneData;
    importMultiplierChanges(changesData: any[]): Promise<MultiplierChange[]>;
    private validateMultiplierChange;
    getImportSummary(periodStart: Date, periodEnd: Date): Promise<{
        meterReadings: {
            count: number;
            totalConsumption: number;
            byZone: {
                [k: string]: number;
            };
        };
        contracts: {
            count: number;
            activeCount: number;
        };
        zones: {
            count: number;
            vacantCount: number;
        };
    }>;
}
export declare const dataImportService: DataImportService;
