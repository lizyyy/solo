import { ImportOptions, ImportResult } from '../types';
export declare class ImportService {
    importCSV(options: ImportOptions): Promise<ImportResult>;
    private validateRow;
    private createRecordFromRow;
}
export declare const importService: ImportService;
