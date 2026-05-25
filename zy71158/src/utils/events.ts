import { RandomEventConfig, GameEvent } from '@/types/game';

export function triggerRandomEvent(
  events: RandomEventConfig[],
  round: number
): GameEvent | null {
  for (const event of events) {
    if (Math.random() < event.probability) {
      return {
        id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: event.effect.complaintDelta !== undefined && event.effect.complaintDelta > 0
          ? 'warning'
          : event.effect.moneyDelta !== undefined && event.effect.moneyDelta > 0
          ? 'reward'
          : 'info',
        message: event.effect.message,
        round,
        timestamp: Date.now(),
      };
    }
  }
  return null;
}

export function applyEventEffects(
  event: GameEvent,
  configs: RandomEventConfig[]
): {
  electricityDelta: number;
  smokeDelta: number;
  complaintDelta: number;
  moneyDelta: number;
} {
  const config = configs.find((c) => event.message.includes(c.effect.message.slice(0, 5)));
  if (config) {
    return {
      electricityDelta: config.effect.electricityDelta || 0,
      smokeDelta: config.effect.smokeDelta || 0,
      complaintDelta: config.effect.complaintDelta || 0,
      moneyDelta: config.effect.moneyDelta || 0,
    };
  }
  return { electricityDelta: 0, smokeDelta: 0, complaintDelta: 0, moneyDelta: 0 };
}

export function getEventColor(type: GameEvent['type']): string {
  switch (type) {
    case 'warning':
      return '#FF6B35';
    case 'penalty':
      return '#E63946';
    case 'reward':
      return '#2EC4B6';
    default:
      return '#FFD23F';
  }
}

export function createInfoEvent(message: string, round: number): GameEvent {
  return {
    id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 'info',
    message,
    round,
    timestamp: Date.now(),
  };
}

export function createWarningEvent(message: string, round: number): GameEvent {
  return {
    id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 'warning',
    message,
    round,
    timestamp: Date.now(),
  };
}

export function createPenaltyEvent(message: string, round: number): GameEvent {
  return {
    id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 'penalty',
    message,
    round,
    timestamp: Date.now(),
  };
}

export function createRewardEvent(message: string, round: number): GameEvent {
  return {
    id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 'reward',
    message,
    round,
    timestamp: Date.now(),
  };
}