import { ShuttleRegistration, InvalidRecord, ImportOptions, ColumnMapping } from '../models/ShuttleRegistration';
export declare class FileImportError extends Error {
    readonly fileName: string;
    readonly cause?: Error | undefined;
    constructor(message: string, fileName: string, cause?: Error | undefined);
}
export declare class ColumnMappingError extends Error {
    readonly missingColumns: string[];
    readonly availableColumns: string[];
    constructor(message: string, missingColumns: string[], availableColumns: string[]);
}
export declare class FileImporter {
    private columnMapping;
    constructor(customMapping?: Partial<ColumnMapping>);
    importFile(filePath: string, options?: ImportOptions): {
        records: ShuttleRegistration[];
        invalidRecords: InvalidRecord[];
        headers: string[];
    };
    importFiles(filePaths: string[], options?: ImportOptions): {
        records: ShuttleRegistration[];
        invalidRecords: InvalidRecord[];
        fileResults: Array<{
            fileName: string;
            success: boolean;
            recordCount: number;
            error?: string;
        }>;
    };
    private detectEncoding;
    private readFileWithEncoding;
    private parseCsv;
    private resolveColumnMapping;
    private parseRow;
    private parseStatus;
}
