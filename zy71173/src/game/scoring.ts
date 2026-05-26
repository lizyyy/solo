import type { GameEvent, Rating, ScoreResult, EventType } from './types';

export const PENALTIES: Record<EventType, number> = {
  move: 0,
  door_open: 0,
  humidity: 0,
  item_used: 0,
  wrong_operation: -100,
  timeout: -200,
  resource_waste: -150,
  alert: -300,
  humidity_damage: -100,
  guard_spotted: -500,
  congestion: -50,
  door_blocked: -100,
  door_permission_denied: -100,
  success: 0,
};

const RATING_COLORS: Record<Rating, string> = {
  S: '#FFD700',
  A: '#C0C0C0',
  B: '#CD7F32',
  C: '#4169E1',
  D: '#DC143C',
};

export function calculateScore(
  events: GameEvent[],
  maxRounds: number,
  usedRounds: number
): ScoreResult {
  const baseScore = 1000;
  const timeBonus = Math.max(0, (maxRounds - usedRounds) * 50);
  const eventScores = events.reduce((sum, event) => sum + event.scoreChange, 0);
  const totalScore = baseScore + timeBonus + eventScores;

  const penalties = events
    .filter((event) => event.scoreChange < 0)
    .map((event) => ({
      type: event.type,
      amount: Math.abs(event.scoreChange),
    }));

  let rating: Rating;
  if (totalScore >= 1200) {
    rating = 'S';
  } else if (totalScore >= 1000) {
    rating = 'A';
  } else if (totalScore >= 800) {
    rating = 'B';
  } else if (totalScore >= 600) {
    rating = 'C';
  } else {
    rating = 'D';
  }

  return {
    baseScore,
    timeBonus,
    eventScores,
    penalties,
    totalScore,
    rating,
  };
}

export function getRatingColor(rating: Rating): string {
  return RATING_COLORS[rating];
}
