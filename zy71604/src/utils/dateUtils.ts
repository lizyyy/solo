import dayjs from 'dayjs';

export const formatDate = (date: string | Date | dayjs.Dayjs, format: string = 'YYYY-MM-DD'): string => {
  return dayjs(date).format(format);
};

export const parseDate = (dateStr: string): dayjs.Dayjs => {
  const formats = [
    'YYYY-MM-DD',
    'YYYY/MM/DD',
    'YYYY年MM月DD日',
    'YYYYMMDD',
    'MM/DD/YYYY',
    'DD-MM-YYYY'
  ];
  
  for (const format of formats) {
    const parsed = dayjs(dateStr, format);
    if (parsed.isValid()) {
      return parsed;
    }
  }
  
  return dayjs(dateStr);
};

export const isDateValid = (dateStr: string): boolean => {
  return parseDate(dateStr).isValid();
};

export const compareDates = (date1: string, date2: string): number => {
  const d1 = parseDate(date1);
  const d2 = parseDate(date2);
  if (d1.isBefore(d2)) return -1;
  if (d1.isAfter(d2)) return 1;
  return 0;
};

export const isSameDate = (date1: string, date2: string): boolean => {
  return compareDates(date1, date2) === 0;
};

export const addBusinessDays = (dateStr: string, days: number): string => {
  let date = parseDate(dateStr);
  let added = 0;
  while (added < days) {
    date = date.add(1, 'day');
    const dayOfWeek = date.day();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      added++;
    }
  }
  return formatDate(date);
};
