import { Shift, ShiftSnapshot, ShiftStatus } from '../models/types';
export declare class ShiftService {
    startShift(params: {
        lineId: string;
        teamId: string;
        teamName: string;
        startTime?: Date;
    }): Shift;
    endShift(shiftId: string, endTime?: Date): Shift;
    getShift(shiftId: string): Shift | undefined;
    getShiftHistory(shiftId: string): {
        current: Shift | undefined;
        snapshots: ShiftSnapshot[];
    };
    getShiftStatus(shiftId: string): {
        status: ShiftStatus;
        version: number;
        isRevised: boolean;
        lastRevisedAt?: Date;
    };
}
export declare const shiftService: ShiftService;
//# sourceMappingURL=shiftService.d.ts.map