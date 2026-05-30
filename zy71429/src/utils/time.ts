export const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

export const formatDateTime = (date: Date): string => {
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

export const formatDate = (date: Date): string => {
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

export const addMinutes = (date: Date, minutes: number): Date => {
  return new Date(date.getTime() + minutes * 60000);
};

export const addHours = (date: Date, hours: number): Date => {
  return new Date(date.getTime() + hours * 3600000);
};

export const diffMinutes = (date1: Date, date2: Date): number => {
  return Math.round((date1.getTime() - date2.getTime()) / 60000);
};

export const diffHours = (date1: Date, date2: Date): number => {
  return Math.round((date1.getTime() - date2.getTime()) / 3600000);
};

export const isBetween = (date: Date, start: Date, end: Date): boolean => {
  const time = date.getTime();
  return time >= start.getTime() && time <= end.getTime();
};

export const isOverlap = (
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean => {
  return start1.getTime() < end2.getTime() && start2.getTime() < end1.getTime();
};

export const getOverlapPeriod = (
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): { start: Date; end: Date } | null => {
  const overlapStart = new Date(Math.max(start1.getTime(), start2.getTime()));
  const overlapEnd = new Date(Math.min(end1.getTime(), end2.getTime()));
  
  if (overlapStart.getTime() < overlapEnd.getTime()) {
    return { start: overlapStart, end: overlapEnd };
  }
  return null;
};

export const getMinutesUntil = (target: Date, now: Date): number => {
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 60000));
};

export const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours > 0) {
    return `${hours}小时${mins > 0 ? `${mins}分钟` : ''}`;
  }
  return `${mins}分钟`;
};

export const formatCountdown = (target: Date, now: Date): string => {
  const totalMinutes = getMinutesUntil(target, now);
  
  if (totalMinutes <= 0) {
    return '已到达';
  }
  
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
};

export const roundToNearestHour = (date: Date): Date => {
  const result = new Date(date);
  result.setMinutes(0, 0, 0);
  if (date.getMinutes() >= 30) {
    result.setHours(result.getHours() + 1);
  }
  return result;
};

export const generateTimeSlots = (start: Date, end: Date, intervalMinutes: number): Date[] => {
  const slots: Date[] = [];
  let current = new Date(start);
  
  while (current.getTime() <= end.getTime()) {
    slots.push(new Date(current));
    current = addMinutes(current, intervalMinutes);
  }
  
  return slots;
};

export const serializeDate = (date: Date): string => {
  return date.toISOString();
};

export const deserializeDate = (str: string): Date => {
  return new Date(str);
};

export const getStartOfDay = (date: Date): Date => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

export const getEndOfDay = (date: Date): Date => {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
};
