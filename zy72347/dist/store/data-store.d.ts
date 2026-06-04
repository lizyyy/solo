import { DataRecord, ProcessingResult } from '../types';
export declare function saveRecord(record: DataRecord): ProcessingResult<DataRecord>;
export declare function getRecord(id: string): ProcessingResult<DataRecord>;
export declare function getAllRecords(): DataRecord[];
export declare function getRecordsByStatus(status: string): DataRecord[];
export declare function getRecordsWithMixedFormat(): DataRecord[];
export declare function clearAllRecords(): ProcessingResult<void>;
export declare function createNewRecord(originalRowNumber: number, sourceFile: string, importedBy: string): DataRecord;
