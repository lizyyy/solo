import { QualityControlDB } from '../database/db';
import { Threshold, PaperBatch, PrintBatch, BatchResult } from '../types';
export declare class ImportService {
    private db;
    private qualityService;
    constructor(db: QualityControlDB);
    importThresholdsFromCsv(filePath: string): BatchResult<Threshold>;
    importPaperBatchesFromCsv(filePath: string): BatchResult<PaperBatch>;
    importPrintBatchFromCsv(filePath: string): {
        batchResult: BatchResult<PrintBatch>;
        measurementResult?: BatchResult<any>;
    };
    importMeasurementsFromCsv(filePath: string, printBatchNo: string): BatchResult<any>;
}
