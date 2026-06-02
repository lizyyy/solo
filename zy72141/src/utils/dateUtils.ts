import { format, parseISO, startOfWeek, endOfWeek, getISOWeek, getISOWeekYear } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export function getWeekKey(date: Date = new Date()): string {
  const year = getISOWeekYear(date);
  const week = getISOWeek(date);
  return `${year}-W${week.toString().padStart(2, '0')}`;
}

export function getWeekDateRange(weekKey: string): { start: Date; end: Date } {
  const match = weekKey.match(/^(\d{4})-W(\d{2})$/);
  if (!match) {
    const now = new Date();
    return {
      start: startOfWeek(now, { weekStartsOn: 1 }),
      end: endOfWeek(now, { weekStartsOn: 1 }),
    };
  }
  
  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);
  
  const jan4 = new Date(year, 0, 4);
  const firstMonday = startOfWeek(jan4, { weekStartsOn: 1 });
  const start = new Date(firstMonday.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
  
  return { start, end };
}

export function formatWeekDisplay(weekKey: string): string {
  const { start, end } = getWeekDateRange(weekKey);
  return `${format(start, 'M月d日')} - ${format(end, 'M月d日')}`;
}

export function formatDateTime(dateStr: string): string {
  try {
    const date = parseISO(dateStr);
    return format(date, 'yyyy-MM-dd HH:mm', { locale: zhCN });
  } catch {
    return dateStr;
  }
}

export function formatDateTimeShort(dateStr: string): string {
  try {
    const date = parseISO(dateStr);
    return format(date, 'M月d日 HH:mm', { locale: zhCN });
  } catch {
    return dateStr;
  }
}

export function formatTime(dateStr: string): string {
  try {
    const date = parseISO(dateStr);
    return format(date, 'HH:mm', { locale: zhCN });
  } catch {
    return dateStr;
  }
}

export function formatDate(dateStr: string): string {
  try {
    const date = parseISO(dateStr);
    return format(date, 'yyyy-MM-dd', { locale: zhCN });
  } catch {
    return dateStr;
  }
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function generateWeekTitle(weekKey: string): string {
  const match = weekKey.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return '钢琴陪练周报';
  
  const year = match[1];
  const week = match[2];
  const { start } = getWeekDateRange(weekKey);
  const month = format(start, 'M月', { locale: zhCN });
  
  return `${year}年${month}第${parseInt(week, 10)}周 钢琴陪练周报`;
}

export function getAllWeekKeys(count: number = 10): string[] {
  const weeks: string[] = [];
  const now = new Date();
  
  for (let i = 0; i < count; i++) {
    const date = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    weeks.push(getWeekKey(date));
  }
  
  return weeks;
}
