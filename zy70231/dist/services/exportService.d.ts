import { Storage } from '../store/storage';
export declare class ExportService {
    private storage;
    constructor(storage: Storage);
    private getWorkZoneName;
    private getBlockSectionName;
    private getResourceName;
    exportToExcel(outputPath: string): Promise<string>;
    private addOverviewSheet;
    private addScheduleSheet;
    private addResourceUsageSheet;
    private addConflictsSheet;
    private addDataSummarySheet;
    private buildDetailedSchedule;
    private calculateResourceUsage;
    private translateConflictType;
    exportStats(): {
        windows: number;
        tasks: number;
        scheduled: number;
        conflicts: number;
        workZones: number;
        resources: number;
        blockSections: number;
    };
}
