import { ScheduleRecord, ImportResult, MaterialSource } from '../types';
export interface ScheduleImportInput {
    sessionDate: Date;
    performerId: string;
    performerName: string;
    locationId: string;
    locationName: string;
    trackName: string;
    isConsumed: boolean;
    isLeave: boolean;
    consumedHours: number;
    source: MaterialSource;
}
export declare class ScheduleImportService {
    importSchedule(inputs: ScheduleImportInput[]): ImportResult<ScheduleRecord>;
    recalculateConsumedHours(batchId: string): {
        updated: ScheduleRecord[];
        messages: string[];
    };
}
export declare const scheduleImportService: ScheduleImportService;
