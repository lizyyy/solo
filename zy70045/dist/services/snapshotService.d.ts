import { ShiftSnapshot, Shift, ShiftStatus } from '../models/types';
export declare class SnapshotService {
    createSnapshot(shiftId: string, params?: {
        handoverFrom?: string;
        handoverTo?: string;
        isConfirmed?: boolean;
    }): ShiftSnapshot;
    getSnapshot(shiftId: string, version?: number): ShiftSnapshot | undefined;
    getSnapshotHistory(shiftId: string): ShiftSnapshot[];
    getLatestSnapshot(shiftId: string): ShiftSnapshot | undefined;
    getShiftSummaryFromSnapshot(shiftId: string, version?: number): {
        shift: Shift;
        snapshot: ShiftSnapshot;
        summary: {
            productionTotal: number;
            wasteTotal: number;
            netProduction: number;
            effectiveTimeMinutes: number;
            downtimeMinutes: number;
        };
    };
    getAllSnapshotsForDay(date: string, lineId?: string): Array<{
        shiftId: string;
        teamName: string;
        startTime: Date;
        endTime: Date;
        productionTotal: number;
        wasteTotal: number;
        netProduction: number;
        status: ShiftStatus;
    }>;
}
export declare const snapshotService: SnapshotService;
//# sourceMappingURL=snapshotService.d.ts.map