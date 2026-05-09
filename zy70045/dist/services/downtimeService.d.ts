import { DowntimeRecord, DowntimeAllocation, DowntimeStatus } from '../models/types';
export declare class DowntimeService {
    recordDowntime(params: {
        lineId: string;
        startTime: Date;
        endTime: Date;
        reason: string;
        createdBy: string;
    }): DowntimeRecord;
    getShiftDurationMinutes(shiftId: string): number;
    calculateOverlapMinutes(downtimeStart: Date, downtimeEnd: Date, shiftStart: Date, shiftEnd: Date): number;
    allocateDowntime(downtimeId: string, shiftId: string): DowntimeAllocation;
    autoAllocateDowntimeForLine(lineId: string): Array<{
        downtimeId: string;
        allocations: DowntimeAllocation[];
    }>;
    getShiftDowntime(shiftId: string): {
        totalMinutes: number;
        allocations: DowntimeAllocation[];
        downtimeDetails: DowntimeRecord[];
    };
    getDowntimeAllocations(downtimeId: string): {
        downtime: DowntimeRecord;
        allocations: DowntimeAllocation[];
        totalAllocatedMinutes: number;
        unallocatedMinutes: number;
    };
    getDowntimeStatus(downtimeId: string): {
        status: DowntimeStatus;
        version: number;
        isRevised: boolean;
    };
}
export declare const downtimeService: DowntimeService;
//# sourceMappingURL=downtimeService.d.ts.map