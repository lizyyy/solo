import { MaintenanceRecord, SensorData, ApprovalRecord, BatchImportResult } from '../types';
export declare class ImportService {
    parseMaintenanceCsv(filePath: string): Promise<MaintenanceRecord[]>;
    parseMaintenanceCsvBuffer(buffer: Buffer): Promise<MaintenanceRecord[]>;
    parseSensorJson(filePath: string): Promise<SensorData[]>;
    parseSensorJsonBuffer(buffer: Buffer): Promise<SensorData[]>;
    parseApprovalCsv(filePath: string): Promise<ApprovalRecord[]>;
    parseApprovalCsvBuffer(buffer: Buffer): Promise<ApprovalRecord[]>;
    batchImport(maintenanceBuffer?: Buffer, sensorBuffer?: Buffer, approvalBuffer?: Buffer): Promise<BatchImportResult>;
}
export declare const importService: ImportService;
