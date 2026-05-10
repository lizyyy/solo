import { TimeWindowType } from '../types/enums';
export declare function getTimeWindowRange(windowType: TimeWindowType, referenceTime?: Date): {
    start: Date;
    end: Date;
};
export declare function calculateTimeWindowDurationMs(windowType: TimeWindowType): number;
export declare function isRollingWindow(windowType: string): boolean;
