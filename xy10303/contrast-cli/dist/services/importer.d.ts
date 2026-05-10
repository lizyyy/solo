import { ImportDataType, ImportError } from '../models';
export declare class Importer {
    static importFile(filePath: string, dataType: ImportDataType): {
        data: any[];
        errors: ImportError[];
    };
    private static importJSON;
    private static importCSV;
    private static transformData;
    private static transformAppointment;
    private static transformBatch;
    private static transformUsage;
    private static cleanString;
    private static parseNumber;
    private static parseBoolean;
}
