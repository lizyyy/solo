import { ImportResult, SourceType } from '../types';
export interface ImportOptions {
    sourceType: SourceType;
    filePath: string;
    userId: string;
    skipCheck?: boolean;
}
export declare function importData(options: ImportOptions): Promise<ImportResult>;
export declare function getImportBatches(sourceType?: SourceType): Promise<any[]>;
