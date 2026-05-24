import { DateTime } from 'luxon';
export declare function convertToTimezone(date: Date | string, targetTimezone: string): DateTime;
export declare function formatDateInTimezone(date: Date | string, timezone: string, format?: string): string;
export declare function parseDeprecationDate(dateStr: string, timezone: string): DateTime;
export declare function isDatePast(dateStr: string, timezone: string, referenceDate?: Date): boolean;
export declare function getDaysUntilDeprecation(dateStr: string, timezone: string, referenceDate?: Date): number;
export declare function isValidTimezone(timezone: string): boolean;
export declare function getCurrentTimeInTimezone(timezone: string): string;
export declare function getInspectionTimestamp(timezone: string): string;
export interface DeprecationStatus {
    isExpired: boolean;
    daysUntil: number;
    formattedDate: string;
    timezone: string;
}
export declare function getDeprecationStatus(deprecationDate: string | undefined, timezone: string): DeprecationStatus;
