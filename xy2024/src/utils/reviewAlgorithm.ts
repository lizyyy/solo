import { Familiarity, ReviewRecord } from '../types';

const EBBINGHAUS_INTERVALS = [1, 2, 4, 7, 15, 30, 60];

export const calculateNextReviewDate = (
  record: ReviewRecord,
  familiarity: Familiarity
): { nextReviewDate: string; interval: number; easeFactor: number } => {
  let { easeFactor, interval, reviewCount } = record;
  
  if (familiarity === '认识') {
    easeFactor = Math.max(1.3, easeFactor + 0.1);
    if (reviewCount === 0) {
      interval = 1;
    } else if (reviewCount === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
  } else if (familiarity === '模糊') {
    easeFactor = Math.max(1.3, easeFactor - 0.15);
    interval = Math.max(1, Math.round(interval * 0.5));
  } else {
    easeFactor = Math.max(1.3, easeFactor - 0.2);
    interval = 1;
  }

  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + interval);

  return {
    nextReviewDate: nextReviewDate.toISOString(),
    interval,
    easeFactor
  };
};

export const isReviewDue = (nextReviewDate: string): boolean => {
  const now = new Date();
  const nextDate = new Date(nextReviewDate);
  return now >= nextDate;
};

export const getEbbinghausIntervals = (): number[] => {
  return [...EBBINGHAUS_INTERVALS];
};

export const formatInterval = (days: number): string => {
  if (days === 0) return '今天';
  if (days === 1) return '1天';
  if (days < 7) return `${days}天`;
  if (days < 30) return `${Math.floor(days / 7)}周`;
  return `${Math.floor(days / 30)}个月`;
};
