import { ImportResult } from '../models/types';
declare class ImportService {
    private uploadDir;
    constructor();
    private ensureUploadDirectory;
    importBoothApplications(filePath: string): Promise<ImportResult>;
    importLicenseAttachments(filePath: string): Promise<ImportResult>;
    importVenueCalendar(filePath: string): Promise<ImportResult>;
    private parseCSV;
    private normalizeDate;
}
export declare const importService: ImportService;
export {};
