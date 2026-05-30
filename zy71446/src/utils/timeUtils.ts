import { parse, format, addMinutes, differenceInMinutes } from 'date-fns';

export const TIME_FORMAT = 'HH:mm';
export const FULL_TIME_FORMAT = 'yyyy-MM-dd HH:mm:ss';

export function parseTime(timeStr: string): Date {
  return parse(timeStr, TIME_FORMAT, new Date());
}

export function formatTime(date: Date): string {
  return format(date, TIME_FORMAT);
}

export function formatFullTime(date: Date): string {
  return format(date, FULL_TIME_FORMAT);
}

export function addMinutesToTime(timeStr: string, minutes: number): string {
  const date = parseTime(timeStr);
  return formatTime(addMinutes(date, minutes));
}

export function getMinutesBetween(startTime: string, endTime: string): number {
  return differenceInMinutes(parseTime(endTime), parseTime(startTime));
}

export function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function isTimeInRange(time: string, start: string, end: string): boolean {
  const t = timeToMinutes(time);
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  return t >= s && t <= e;
}

export function generateTimeRange(startTime: string, endTime: string, stepMinutes: number = 1): string[] {
  const result: string[] = [];
  let current = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  
  while (current <= end) {
    result.push(minutesToTime(current));
    current += stepMinutes;
  }
  
  return result;
}

export function generateTimestamp(): string {
  return formatFullTime(new Date());
}
