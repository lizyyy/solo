export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function parseTimePeriod(period: string): { start: number; end: number } | null {
  const match = period.match(/^(\d{1,2}):(\d{2})\s*[-~]\s*(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  
  const [, startH, startM, endH, endM] = match;
  return {
    start: parseInt(startH) * 60 + parseInt(startM),
    end: parseInt(endH) * 60 + parseInt(endM),
  };
}

export function getTimeOverlapMinutes(period1: string, period2: string): number {
  const t1 = parseTimePeriod(period1);
  const t2 = parseTimePeriod(period2);
  if (!t1 || !t2) return 0;
  
  const overlapStart = Math.max(t1.start, t2.start);
  const overlapEnd = Math.min(t1.end, t2.end);
  
  return Math.max(0, overlapEnd - overlapStart);
}
