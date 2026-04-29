import type { CyclePhase, ConstitutionType } from '@/types';

export const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
};

export const formatDateTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const getRelativeTime = (dateStr: string): string => {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;
  return formatDate(date);
};

export const calculateCycleDay = (
  lastPeriodStart: string,
  averageCycleLength: number,
  targetDate?: string
): number => {
  const start = new Date(lastPeriodStart);
  const target = targetDate ? new Date(targetDate) : new Date();
  const diffMs = target.getTime() - start.getTime();
  let diffDays = Math.floor(diffMs / 86400000) + 1;

  if (diffDays <= 0) {
    diffDays += averageCycleLength;
  } else if (diffDays > averageCycleLength) {
    diffDays = diffDays % averageCycleLength;
    if (diffDays === 0) diffDays = averageCycleLength;
  }

  return diffDays;
};

export const getCyclePhase = (
  cycleDay: number,
  averageCycleLength: number,
  periodLength: number
): CyclePhase => {
  if (cycleDay <= periodLength) {
    return 'menstrual';
  } else if (cycleDay <= Math.floor(averageCycleLength * 0.5)) {
    return 'follicular';
  } else if (cycleDay <= Math.floor(averageCycleLength * 0.7)) {
    return 'ovulatory';
  } else {
    return 'luteal';
  }
};

export const getNextPeriodStart = (
  lastPeriodStart: string,
  averageCycleLength: number
): string => {
  const lastStart = new Date(lastPeriodStart);
  const nextStart = new Date(lastStart.getTime() + averageCycleLength * 86400000);
  return formatDate(nextStart);
};

export const getDaysUntilNextPeriod = (
  lastPeriodStart: string,
  averageCycleLength: number
): number => {
  const nextStart = new Date(getNextPeriodStart(lastPeriodStart, averageCycleLength));
  const now = new Date();
  const diffMs = nextStart.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / 86400000));
};

export const isInPeriod = (
  lastPeriodStart: string,
  periodLength: number,
  averageCycleLength: number
): boolean => {
  const cycleDay = calculateCycleDay(lastPeriodStart, averageCycleLength);
  return cycleDay <= periodLength;
};

export const calculateConstitution = (answers: Record<number, string>): ConstitutionType => {
  let coldScore = 0;
  let heatScore = 0;
  let qiDeficiencyScore = 0;

  Object.entries(answers).forEach(([, value]) => {
    switch (value) {
      case 'cold':
      case 'dark':
      case 'severe':
      case 'warm':
        coldScore += 2;
        break;
      case 'hot':
      case 'bright':
      case 'burning':
      case 'irritable':
        heatScore += 2;
        break;
      case 'fatigue':
        qiDeficiencyScore += 2;
        break;
      default:
        coldScore += 0.5;
        heatScore += 0.5;
        qiDeficiencyScore += 0.5;
    }
  });

  const maxScore = Math.max(coldScore, heatScore, qiDeficiencyScore);

  if (maxScore >= coldScore && maxScore >= heatScore && maxScore >= qiDeficiencyScore) {
    if (coldScore >= heatScore && coldScore >= qiDeficiencyScore) {
      return 'cold';
    } else if (heatScore >= coldScore && heatScore >= qiDeficiencyScore) {
      return 'heat';
    } else {
      return 'qi_deficiency';
    }
  }

  return 'unknown';
};

export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month + 1, 0).getDate();
};

export const getFirstDayOfMonth = (year: number, month: number): number => {
  return new Date(year, month, 1).getDay();
};

export const formatColdLevel = (level: string): { text: string; color: string; bgColor: string } => {
  const map: Record<string, { text: string; color: string; bgColor: string }> = {
    cold: { text: '性寒', color: 'text-blue-600', bgColor: 'bg-blue-100' },
    cool: { text: '性凉', color: 'text-cyan-600', bgColor: 'bg-cyan-100' },
    neutral: { text: '性平', color: 'text-gray-600', bgColor: 'bg-gray-100' },
    warm: { text: '性温', color: 'text-orange-600', bgColor: 'bg-orange-100' },
    hot: { text: '性热', color: 'text-red-600', bgColor: 'bg-red-100' }
  };
  return map[level] || map.neutral;
};

export const formatCanEat = (canEat: boolean): { text: string; color: string; bgColor: string } => {
  return canEat
    ? { text: '可食用', color: 'text-green-600', bgColor: 'bg-green-100' }
    : { text: '慎食/忌食', color: 'text-red-600', bgColor: 'bg-red-100' };
};
