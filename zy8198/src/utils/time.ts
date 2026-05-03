import type { TimePoint, TimeRange } from '../types';

export function timeToMinutes(time: TimePoint): number {
  return time.hour * 60 + time.minute;
}

export function minutesToTime(minutes: number): TimePoint {
  const normalizedMinutes = minutes % 1440;
  const hour = Math.floor(normalizedMinutes / 60);
  const minute = normalizedMinutes % 60;
  return { hour, minute };
}

export function formatTime(time: TimePoint): string {
  return `${time.hour.toString().padStart(2, '0')}:${time.minute.toString().padStart(2, '0')}`;
}

export function parseTime(timeStr: string): TimePoint {
  const [hourStr, minuteStr] = timeStr.split(':');
  return {
    hour: parseInt(hourStr, 10),
    minute: parseInt(minuteStr, 10),
  };
}

export function isTimeInRange(time: TimePoint, range: TimeRange): boolean {
  const timeMin = timeToMinutes(time);
  const startMin = timeToMinutes(range.start);
  const endMin = timeToMinutes(range.end);

  if (startMin <= endMin) {
    return timeMin >= startMin && timeMin < endMin;
  }
  return timeMin >= startMin || timeMin < endMin;
}

export function isMidnightCrossing(range: TimeRange): boolean {
  return timeToMinutes(range.start) > timeToMinutes(range.end);
}

export function getRangeDurationMinutes(range: TimeRange): number {
  const startMin = timeToMinutes(range.start);
  const endMin = timeToMinutes(range.end);

  if (startMin <= endMin) {
    return endMin - startMin;
  }
  return (1440 - startMin) + endMin;
}

export function addMinutes(time: TimePoint, minutes: number): TimePoint {
  return minutesToTime(timeToMinutes(time) + minutes);
}

export function compareTime(a: TimePoint, b: TimePoint): number {
  return timeToMinutes(a) - timeToMinutes(b);
}

export function timeEquals(a: TimePoint, b: TimePoint): boolean {
  return a.hour === b.hour && a.minute === b.minute;
}

export function generateTimeSteps(start: TimePoint, end: TimePoint, stepMinutes: number): TimePoint[] {
  const steps: TimePoint[] = [];
  const startMin = timeToMinutes(start);
  const endMin = timeToMinutes(end);
  const isCrossing = startMin > endMin;
  
  const effectiveEndMin = isCrossing ? endMin + 1440 : endMin;
  let current = startMin;
  
  while (current <= effectiveEndMin) {
    steps.push(minutesToTime(current));
    current += stepMinutes;
  }
  
  return steps;
}
