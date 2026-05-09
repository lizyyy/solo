import { Shift, ShiftSnapshot, DailyReport } from '../models/types';
export declare class HandoverService {
    confirmHandover(shiftId: string, params: {
        handoverFrom: string;
        handoverTo: string;
    }): Shift;
    reviseShift(shiftId: string, params: {
        revisedBy: string;
        reason: string;
        changes: {
            teamId?: string;
            teamName?: string;
            startTime?: Date;
            endTime?: Date;
        };
    }): Shift;
    getHandoverSummary(shiftId: string): {
        shift: Shift;
        snapshot?: ShiftSnapshot;
        summary: {
            productionTotal: number;
            wasteTotal: number;
            netProduction: number;
            downtimeMinutes: number;
            effectiveTimeMinutes: number;
        };
        pendingItems: {
            productions: number;
            wastes: number;
            unallocatedDowntime: number;
        };
    };
    generateDailyReport(date: string, lineId: string): DailyReport;
    exportDailyReportAsJSON(date: string, lineId: string): string;
    exportDailyReportAsCSV(date: string, lineId: string): string;
}
export declare const handoverService: HandoverService;
//# sourceMappingURL=handoverService.d.ts.map