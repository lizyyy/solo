import { Shift, ShiftType, ExceptionType } from '../types';
export interface ScheduleParams {
    date: string;
    shiftType: ShiftType;
    startTime: string;
    endTime: string;
    operatorIds: string[];
}
export declare function createShiftSchedule(params: ScheduleParams): Promise<Shift>;
export declare function lockVehicle(vehicleId: string, taskId: string): Promise<void>;
export declare function releaseVehicle(vehicleId: string, batteryDrained?: number): Promise<void>;
export declare function lockCharger(chargerId: string, vehicleId: string): Promise<void>;
export declare function releaseCharger(chargerId: string): Promise<void>;
export declare function reportException(params: {
    shiftId: string;
    type: ExceptionType;
    vehicleId?: string;
    chargerId?: string;
    taskId?: string;
    description: string;
}): Promise<void>;
export declare function startShift(shiftId: string): Promise<void>;
export declare function completeShift(shiftId: string): Promise<void>;
