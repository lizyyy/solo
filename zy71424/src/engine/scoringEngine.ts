import { GameEvent, Channel, GameStats } from '@/types';

export const calculatePenalty = (
  event: GameEvent,
  currentTime: number
): number => {
  if (event.resolved) return 0;

  const duration = currentTime - event.timestamp;
  
  switch (event.type) {
    case 'feedback':
      return Math.floor(duration * 2);
    case 'clipping':
      return Math.floor(duration * 1.5);
    case 'monitor_request':
      return duration > 10 ? Math.floor((duration - 10) * 0.5) : 0;
    case 'imbalance':
      return duration > 5 ? Math.floor((duration - 5) * 0.3) : 0;
    default:
      return 0;
  }
};

export const calculateResponseBonus = (
  event: GameEvent
): number => {
  if (!event.resolved || !event.resolvedAt) return 0;

  const responseTime = event.resolvedAt - event.timestamp;
  
  if (responseTime < 2) return 10;
  if (responseTime < 5) return 5;
  if (responseTime < 10) return 2;
  return 0;
};

export const calculateScore = (
  events: GameEvent[],
  baseScore: number,
  currentTime: number
): number => {
  let score = baseScore;
  
  for (const event of events) {
    const penalty = calculatePenalty(event, currentTime);
    score -= penalty;
    
    if (event.resolved) {
      const bonus = calculateResponseBonus(event);
      score += bonus;
    }
  }

  return Math.max(0, Math.min(100, score));
};

export const calculateGameStats = (
  events: GameEvent[],
  totalDuration: number
): GameStats => {
  const resolvedEvents = events.filter(e => e.resolved);
  const unresolvedEvents = events.filter(e => !e.resolved);
  
  const responseTimes = resolvedEvents
    .filter(e => e.resolvedAt)
    .map(e => (e.resolvedAt! - e.timestamp));
  
  const avgResponseTime = responseTimes.length > 0
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : 0;

  return {
    totalEvents: events.length,
    resolvedEvents: resolvedEvents.length,
    missedEvents: unresolvedEvents.length,
    avgResponseTime: Math.round(avgResponseTime * 10) / 10,
    feedbackCount: events.filter(e => e.type === 'feedback').length,
    monitorMissCount: events.filter(e => e.type === 'monitor_request' && !e.resolved).length,
    clippingCount: events.filter(e => e.type === 'clipping').length,
    imbalanceCount: events.filter(e => e.type === 'imbalance').length,
  };
};

export const getGrade = (score: number): { grade: string; color: string; message: string } => {
  if (score >= 90) return { grade: 'S', color: 'text-yellow-400', message: '完美救场！专业调音师水平！' };
  if (score >= 80) return { grade: 'A', color: 'text-green-400', message: '优秀！演出很顺利！' };
  if (score >= 70) return { grade: 'B', color: 'text-blue-400', message: '良好，有些小问题但不影响' };
  if (score >= 60) return { grade: 'C', color: 'text-yellow-500', message: '及格，需要多练习' };
  return { grade: 'D', color: 'text-red-400', message: '需要加强训练，多复盘看看问题' };
};
