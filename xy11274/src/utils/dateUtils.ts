export function getCurrentTime(): string {
  return new Date().toISOString();
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
}

export function addMinutes(time: string, minutes: number): string {
  const date = new Date(time);
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}

export function isSameDay(date1: string, date2: string): boolean {
  return formatDate(date1) === formatDate(date2);
}

export function isTimeInRange(time: string, startTime: string, endTime: string): boolean {
  const t = new Date(time).getTime();
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  return t >= start && t <= end;
}

export function generateIdempotentKey(...parts: string[]): string {
  return parts.join('|');
}

export function validateRole(role: string): boolean {
  return ['班长', '操作员', '管理员'].includes(role);
}

export function validateShiftType(shiftType: string): boolean {
  return ['白班', '中班', '夜班'].includes(shiftType);
}
