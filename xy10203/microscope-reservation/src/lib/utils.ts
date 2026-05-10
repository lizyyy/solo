import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';

export function generateId(): string {
  return uuidv4();
}

export function nowISO(): string {
  return dayjs().toISOString();
}

export function formatDateTime(iso: string): string {
  return dayjs(iso).format('YYYY-MM-DD HH:mm');
}

export function formatDate(iso: string): string {
  return dayjs(iso).format('YYYY-MM-DD');
}

export function isOverlapping(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  const s1 = dayjs(start1);
  const e1 = dayjs(end1);
  const s2 = dayjs(start2);
  const e2 = dayjs(end2);
  
  return s1.isBefore(e2) && e1.isAfter(s2);
}

export function getOverlapRange(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): { start: string; end: string } | null {
  const s1 = dayjs(start1);
  const e1 = dayjs(end1);
  const s2 = dayjs(start2);
  const e2 = dayjs(end2);
  
  const overlapStart = s1.isAfter(s2) ? s1 : s2;
  const overlapEnd = e1.isBefore(e2) ? e1 : e2;
  
  if (overlapStart.isBefore(overlapEnd)) {
    return {
      start: overlapStart.toISOString(),
      end: overlapEnd.toISOString()
    };
  }
  
  return null;
}
