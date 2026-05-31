import { TimeSystem } from '../types';

const TAI_UTC_OFFSET = 37;
const BEIJING_UTC_OFFSET = 8 * 60 * 60;

export function parseTimeWithSystem(timeStr: string, sourceSystem: TimeSystem): Date {
  const date = new Date(timeStr);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid time string: ${timeStr}`);
  }
  
  const utcMs = date.getTime();
  
  switch (sourceSystem) {
    case 'UTC':
      return new Date(utcMs);
    case 'TAI':
      return new Date(utcMs - TAI_UTC_OFFSET * 1000);
    case 'BEIJING':
      return new Date(utcMs - BEIJING_UTC_OFFSET * 1000);
    default:
      return new Date(utcMs);
  }
}

export function formatTimeWithSystem(utcDate: Date, targetSystem: TimeSystem): string {
  const utcMs = utcDate.getTime();
  let targetMs = utcMs;
  
  switch (targetSystem) {
    case 'UTC':
      targetMs = utcMs;
      break;
    case 'TAI':
      targetMs = utcMs + TAI_UTC_OFFSET * 1000;
      break;
    case 'BEIJING':
      targetMs = utcMs + BEIJING_UTC_OFFSET * 1000;
      break;
  }
  
  const date = new Date(targetMs);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function convertTime(timeStr: string, fromSystem: TimeSystem, toSystem: TimeSystem): string {
  const utcDate = parseTimeWithSystem(timeStr, fromSystem);
  return formatTimeWithSystem(utcDate, toSystem);
}

export function getTimeSystemLabel(system: TimeSystem): string {
  switch (system) {
    case 'UTC': return '协调世界时';
    case 'TAI': return '国际原子时';
    case 'BEIJING': return '北京时间';
    default: return system;
  }
}

export function getTimeSystemShortLabel(system: TimeSystem): string {
  switch (system) {
    case 'UTC': return 'UTC';
    case 'TAI': return 'TAI';
    case 'BEIJING': return 'BT';
    default: return system;
  }
}

export function getDateOnly(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setUTCDate(date.getUTCDate() + days);
  return getDateOnly(date);
}

export function isSameDay(utcDate1: Date, utcDate2: Date): boolean {
  return (
    utcDate1.getUTCFullYear() === utcDate2.getUTCFullYear() &&
    utcDate1.getUTCMonth() === utcDate2.getUTCMonth() &&
    utcDate1.getUTCDate() === utcDate2.getUTCDate()
  );
}

export function formatDateTimeLocal(utcDate: Date): string {
  const year = utcDate.getUTCFullYear();
  const month = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(utcDate.getUTCDate()).padStart(2, '0');
  const hours = String(utcDate.getUTCHours()).padStart(2, '0');
  const minutes = String(utcDate.getUTCMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
