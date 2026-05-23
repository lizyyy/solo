import {
  parseISO,
  formatISO,
  isSameDay,
  isBefore,
  isAfter,
  addDays,
  differenceInDays,
  eachDayOfInterval
} from 'date-fns';

export function parseDate(dateStr) {
  if (!dateStr) return null;
  
  try {
    if (/^\d{8}$/.test(dateStr)) {
      const year = parseInt(dateStr.slice(0, 4));
      const month = parseInt(dateStr.slice(4, 6)) - 1;
      const day = parseInt(dateStr.slice(6, 8));
      return new Date(year, month, day);
    }
    
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return parseISO(dateStr);
    }
    
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    }
    
    return null;
  } catch {
    return null;
  }
}

export function formatDate(date) {
  if (!date) return '';
  return formatISO(date, { representation: 'date' });
}

export function datesOverlap(start1, end1, start2, end2) {
  return isBefore(start1, end2) && isAfter(end1, start2);
}

export function mergeDateRanges(ranges) {
  if (ranges.length === 0) return [];
  
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged = [sorted[0]];
  
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];
    
    if (isBefore(current.start, last.end) || isSameDay(current.start, last.end)) {
      if (isAfter(current.end, last.end)) {
        last.end = current.end;
        last.sources = [...last.sources, ...current.sources];
      }
    } else {
      merged.push(current);
    }
  }
  
  return merged;
}

export function getNights(start, end) {
  return differenceInDays(end, start);
}

export function getDateRange(start, end) {
  return eachDayOfInterval({ start, end });
}
