import { RegistrationRecord, WaitlistRecord, CheckInRecord, BlacklistRecord, ImportResult } from '../types';
export declare class ImportService {
    private parseDate;
    private parseActivityType;
    private parseRegistrationStatus;
    private parseCheckInStatus;
    parseRegistrationCSV(filePath: string): Promise<ImportResult<RegistrationRecord>>;
    parseWaitlistJSON(filePath: string): Promise<ImportResult<WaitlistRecord>>;
    parseCheckInCSV(filePath: string): Promise<ImportResult<CheckInRecord>>;
    parseBlacklistJSON(filePath: string): Promise<ImportResult<BlacklistRecord>>;
}
