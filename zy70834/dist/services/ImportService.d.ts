import { HealthCheckRecord, Student, MedicationAuthorization } from '../types';
export declare class DataImportService {
    importHealthCheckCSV(filePath: string): Promise<HealthCheckRecord[]>;
    private parseHealthCheckRow;
    importMedicationJSON(filePath: string): Promise<MedicationAuthorization[]>;
    importClassListCSV(filePath: string): Promise<Student[]>;
    private parseStudentRow;
    validateHealthCheckRecords(records: HealthCheckRecord[]): {
        valid: HealthCheckRecord[];
        invalid: any[];
    };
    validateMedicationAuthorizations(auths: MedicationAuthorization[]): {
        valid: MedicationAuthorization[];
        invalid: any[];
    };
}
