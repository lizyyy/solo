import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';

dayjs.extend(customParseFormat);

const DATE_FORMATS = [
  'YYYY-MM-DD',
  'YYYY/MM/DD',
  'YYYY.MM.DD',
  'DD/MM/YYYY',
  'DD.MM.YYYY',
  'MM/DD/YYYY',
  'YYYY年MM月DD日'
];

export const parseDate = (dateStr) => {
  if (!dateStr) return null;
  
  const trimmed = String(dateStr).trim();
  if (!trimmed) return null;

  for (const format of DATE_FORMATS) {
    const parsed = dayjs(trimmed, format, true);
    if (parsed.isValid()) {
      return parsed.format('YYYY-MM-DD');
    }
  }
  
  const timestamp = Number(trimmed);
  if (!isNaN(timestamp) && timestamp > 0) {
    const parsed = dayjs(timestamp);
    if (parsed.isValid()) {
      return parsed.format('YYYY-MM-DD');
    }
  }
  
  return null;
};

export const isValidDate = (dateStr) => {
  return parseDate(dateStr) !== null;
};

export const calculateDaysBetween = (startDate, endDate) => {
  const start = dayjs(startDate);
  const end = dayjs(endDate);
  
  if (!start.isValid() || !end.isValid()) {
    return null;
  }
  
  return end.diff(start, 'day') + 1;
};

export const isDateBefore = (date1, date2) => {
  const d1 = dayjs(date1);
  const d2 = dayjs(date2);
  return d1.isBefore(d2);
};

export const isDateAfter = (date1, date2) => {
  const d1 = dayjs(date1);
  const d2 = dayjs(date2);
  return d1.isAfter(d2);
};

export const formatDate = (dateStr, format = 'YYYY-MM-DD') => {
  const parsed = dayjs(dateStr);
  if (!parsed.isValid()) return dateStr;
  return parsed.format(format);
};

export const getDateRange = (startDate, endDate) => {
  const dates = [];
  let current = dayjs(startDate);
  const end = dayjs(endDate);
  
  while (current.isBefore(end) || current.isSame(end, 'day')) {
    dates.push(current.format('YYYY-MM-DD'));
    current = current.add(1, 'day');
  }
  
  return dates;
};
