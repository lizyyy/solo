import { DateTime, IANAZone } from 'luxon';

export function convertToTimezone(date: Date | string, targetTimezone: string): DateTime {
  const dt = typeof date === 'string' 
    ? DateTime.fromISO(date, { zone: 'utc' })
    : DateTime.fromJSDate(date, { zone: 'utc' });
  
  return dt.setZone(targetTimezone);
}

export function formatDateInTimezone(
  date: Date | string,
  timezone: string,
  format: string = 'yyyy-MM-dd HH:mm:ss'
): string {
  return convertToTimezone(date, timezone).toFormat(format);
}

export function parseDeprecationDate(
  dateStr: string,
  timezone: string
): DateTime {
  return DateTime.fromFormat(dateStr, 'yyyy-MM-dd', { zone: timezone });
}

export function isDatePast(
  dateStr: string,
  timezone: string,
  referenceDate?: Date
): boolean {
  const deprecationDate = parseDeprecationDate(dateStr, timezone);
  const now = referenceDate ? DateTime.fromJSDate(referenceDate) : DateTime.now();
  return now > deprecationDate;
}

export function getDaysUntilDeprecation(
  dateStr: string,
  timezone: string,
  referenceDate?: Date
): number {
  const deprecationDate = parseDeprecationDate(dateStr, timezone);
  const now = referenceDate ? DateTime.fromJSDate(referenceDate) : DateTime.now();
  return Math.ceil(deprecationDate.diff(now, 'days').days);
}

export function isValidTimezone(timezone: string): boolean {
  return IANAZone.isValidZone(timezone);
}

export function getCurrentTimeInTimezone(timezone: string): string {
  return DateTime.now().setZone(timezone).toFormat('yyyy-MM-dd HH:mm:ss ZZZZ');
}

export function getInspectionTimestamp(timezone: string): string {
  return DateTime.now().setZone(timezone).toISO() || new Date().toISOString();
}

export interface DeprecationStatus {
  isExpired: boolean;
  daysUntil: number;
  formattedDate: string;
  timezone: string;
}

export function getDeprecationStatus(
  deprecationDate: string | undefined,
  timezone: string
): DeprecationStatus {
  if (!deprecationDate) {
    return {
      isExpired: false,
      daysUntil: Infinity,
      formattedDate: '未指定',
      timezone,
    };
  }

  const daysUntil = getDaysUntilDeprecation(deprecationDate, timezone);
  
  return {
    isExpired: daysUntil <= 0,
    daysUntil,
    formattedDate: parseDeprecationDate(deprecationDate, timezone).toFormat('yyyy-MM-dd'),
    timezone,
  };
}
