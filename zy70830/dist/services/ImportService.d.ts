import { Bed, Patient, CleaningWorkOrder, ImportResult } from '../types';
export declare class ImportService {
    importBedCSV(filePath: string): Promise<ImportResult<Bed>>;
    private parseBedRow;
    importPatientJSON(filePath: string): Promise<ImportResult<Patient>>;
    private parsePatientData;
    importCleaningWorkOrdersJSON(filePath: string): Promise<ImportResult<CleaningWorkOrder>>;
    private parseCleaningWorkOrderData;
    validateBedPatientConsistency(): {
        valid: boolean;
        issues: string[];
    };
}
export declare const importService: ImportService;
