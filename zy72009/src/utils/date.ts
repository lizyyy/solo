export function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '-';
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '-';
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

export function generateBatchNo(prefix: string = 'SQT'): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const random = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  
  return `${prefix}-${year}-${month}${day}-${random}`;
}

export function now(): string {
  return new Date().toISOString();
}

export function parseDate(str: string): Date | null {
  const date = new Date(str);
  return isNaN(date.getTime()) ? null : date;
}

export function isDateInRange(dateStr: string, range: [string, string]): boolean {
  const date = parseDate(dateStr);
  const start = parseDate(range[0]);
  const end = parseDate(range[1]);
  
  if (!date || !start || !end) return false;
  
  const startOfDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endOfDay = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59);
  
  return date >= startOfDay && date <= endOfDay;
}
