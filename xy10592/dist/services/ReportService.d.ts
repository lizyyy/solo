import { StoreReport, Anomaly } from '../types';
import { FileStorage } from '../storage/FileStorage';
export declare class ReportService {
    private storage;
    constructor(storage: FileStorage);
    generateReport(year?: number, month?: number): Promise<{
        reports: StoreReport[];
        summary: {
            totalStores: number;
            totalAssets: number;
            totalOriginalCost: number;
            totalAccumulatedDepreciation: number;
            totalNetBookValue: number;
            anomalies: Anomaly[];
        };
    }>;
}
