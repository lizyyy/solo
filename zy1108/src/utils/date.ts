import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';

export const generateId = (): string => uuidv4();

export const formatDate = (date: dayjs.Dayjs | string | Date): string => {
  return dayjs(date).format('YYYY-MM-DD');
};

export const formatDateTime = (date: dayjs.Dayjs | string | Date): string => {
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss');
};

export const now = (): string => formatDateTime(new Date());

export const addDays = (date: dayjs.Dayjs | string | Date, days: number): string => {
  return formatDateTime(dayjs(date).add(days, 'day'));
};

export const addMonths = (date: dayjs.Dayjs | string | Date, months: number): string => {
  return formatDateTime(dayjs(date).add(months, 'month'));
};

export const isExpired = (validTo: string): boolean => {
  return dayjs(validTo).isBefore(dayjs());
};

export const isDateOverlap = (
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean => {
  const s1 = dayjs(start1);
  const e1 = dayjs(end1);
  const s2 = dayjs(start2);
  const e2 = dayjs(end2);
  return s1.isBefore(e2) && s2.isBefore(e1);
};

export const getTimeSlotKey = (startTime: string, endTime: string): string => {
  return `${formatDateTime(startTime)}-${formatDateTime(endTime)}`;
};
