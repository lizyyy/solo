import Database from 'better-sqlite3';
import { Threshold, PaperBatch, PrintBatch, Measurement, ReworkRecord, ReviewRecord, InspectionReport, BatchResult } from '../types';
export declare class QualityControlDB {
    private db;
    constructor(dbPath?: string);
    getDatabase(): Database.Database;
    transaction<T>(fn: () => T): T;
    insertThreshold(threshold: Omit<Threshold, 'id' | 'createdAt'>): number;
    getThresholdByName(name: string): Threshold | null;
    getThresholdById(id: number): Threshold | null;
    listThresholds(): Threshold[];
    insertPaperBatch(batch: Omit<PaperBatch, 'id' | 'createdAt'>): number;
    getPaperBatchByBatchNo(batchNo: string): PaperBatch | null;
    listPaperBatches(): PaperBatch[];
    insertPrintBatch(batch: Omit<PrintBatch, 'id' | 'createdAt'>): number;
    getPrintBatchByBatchNo(batchNo: string): (PrintBatch & {
        paperBatchNo: string;
        thresholdName: string;
    }) | null;
    updatePrintBatchStatus(batchNo: string, status: PrintBatch['status']): void;
    listPrintBatches(): (PrintBatch & {
        paperBatchNo: string;
        thresholdName: string;
    })[];
    insertMeasurement(measurement: Omit<Measurement, 'id' | 'createdAt'>): number;
    getMeasurementsByPrintBatchId(printBatchId: number): (Measurement & {
        printBatchNo: string;
    })[];
    insertReworkRecord(record: Omit<ReworkRecord, 'id' | 'createdAt'>): number;
    getReworkRecordsByPrintBatchId(printBatchId: number): (ReworkRecord & {
        printBatchNo: string;
    })[];
    insertReviewRecord(record: Omit<ReviewRecord, 'id' | 'createdAt'>): number;
    getReviewRecordsByPrintBatchId(printBatchId: number): (ReviewRecord & {
        printBatchNo: string;
    })[];
    insertInspectionReport(report: Omit<InspectionReport, 'id' | 'createdAt'>): number;
    getInspectionReportByReportNo(reportNo: string): (InspectionReport & {
        printBatchNo: string;
    }) | null;
    batchInsert<T>(items: T[], insertFn: (item: T) => number): BatchResult<T>;
    close(): void;
}
