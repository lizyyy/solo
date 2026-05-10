import dayjs from 'dayjs';
import { TimeWindowType } from '../types/enums';

export function getTimeWindowRange(windowType: TimeWindowType, referenceTime?: Date): { start: Date; end: Date } {
  const now = referenceTime ? dayjs(referenceTime) : dayjs();
  
  switch (windowType) {
    case TimeWindowType.DAILY:
      return {
        start: now.startOf('day').toDate(),
        end: now.endOf('day').toDate(),
      };
    case TimeWindowType.WEEKLY:
      return {
        start: now.startOf('week').toDate(),
        end: now.endOf('week').toDate(),
      };
    case TimeWindowType.MONTHLY:
      return {
        start: now.startOf('month').toDate(),
        end: now.endOf('month').toDate(),
      };
    case TimeWindowType.ROLLING_24H:
      return {
        start: now.subtract(24, 'hour').toDate(),
        end: now.toDate(),
      };
    case TimeWindowType.ROLLING_7D:
      return {
        start: now.subtract(7, 'day').toDate(),
        end: now.toDate(),
      };
    case TimeWindowType.ROLLING_30D:
      return {
        start: now.subtract(30, 'day').toDate(),
        end: now.toDate(),
      };
    default:
      return {
        start: now.startOf('day').toDate(),
        end: now.endOf('day').toDate(),
      };
  }
}

export function calculateTimeWindowDurationMs(windowType: TimeWindowType): number {
  const durations: Record<TimeWindowType, number> = {
    [TimeWindowType.DAILY]: 24 * 60 * 60 * 1000,
    [TimeWindowType.WEEKLY]: 7 * 24 * 60 * 60 * 1000,
    [TimeWindowType.MONTHLY]: 30 * 24 * 60 * 60 * 1000,
    [TimeWindowType.ROLLING_24H]: 24 * 60 * 60 * 1000,
    [TimeWindowType.ROLLING_7D]: 7 * 24 * 60 * 60 * 1000,
    [TimeWindowType.ROLLING_30D]: 30 * 24 * 60 * 60 * 1000,
  };
  return durations[windowType];
}

export function isRollingWindow(windowType: string): boolean {
  return ([
    TimeWindowType.ROLLING_24H,
    TimeWindowType.ROLLING_7D,
    TimeWindowType.ROLLING_30D,
  ] as string[]).includes(windowType);
}
