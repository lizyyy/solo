import { InterestEvent } from '../types/game';

const EVENT_TEMPLATES = [
  { rateChange: 50, direction: 'up' as const, description: '央行加息，市场利率上升' },
  { rateChange: 25, direction: 'up' as const, description: '通胀数据超预期，利率微升' },
  { rateChange: -50, direction: 'down' as const, description: '央行降息，市场利率下降' },
  { rateChange: -25, direction: 'down' as const, description: '经济数据疲软，利率微降' },
  { rateChange: 0, direction: 'stable' as const, description: '利率政策保持不变' },
  { rateChange: 75, direction: 'up' as const, description: '通胀压力加剧，大幅加息' },
  { rateChange: -75, direction: 'down' as const, description: '经济衰退风险，大幅降息' },
  { rateChange: 100, direction: 'up' as const, description: '金融危机爆发，利率飙升' },
  { rateChange: -100, direction: 'down' as const, description: '央行紧急救市，大幅降息' },
];

export function generateRandomEvent(round: number): InterestEvent {
  const template = EVENT_TEMPLATES[Math.floor(Math.random() * EVENT_TEMPLATES.length)];
  
  return {
    id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    round,
    rateChange: template.rateChange,
    description: template.description,
    direction: template.direction,
    source: 'hamster_bond_exchange_v1'
  };
}

export function generatePredefinedEvents(totalRounds: number): InterestEvent[] {
  const events: InterestEvent[] = [];
  
  for (let round = 1; round <= totalRounds; round++) {
    const template = EVENT_TEMPLATES[(round - 1) % EVENT_TEMPLATES.length];
    
    events.push({
      id: `event_predef_${round}`,
      round,
      rateChange: template.rateChange,
      description: `第${round}回合: ${template.description}`,
      direction: template.direction,
      source: 'hamster_bond_exchange_v1'
    });
  }
  
  return events;
}

export function getEventForRound(
  events: InterestEvent[],
  round: number
): InterestEvent | null {
  return events.find(e => e.round === round) || null;
}

export function getRateChangeDisplay(rateChange: number): string {
  const percent = rateChange / 100;
  if (rateChange > 0) {
    return `+${percent.toFixed(2)}%`;
  } else if (rateChange < 0) {
    return `${percent.toFixed(2)}%`;
  }
  return '0.00%';
}

export function getEventEmoji(direction: 'up' | 'down' | 'stable'): string {
  switch (direction) {
    case 'up': return '📈';
    case 'down': return '📉';
    case 'stable': return '➡️';
  }
}

export function getEventColorClass(direction: 'up' | 'down' | 'stable'): string {
  switch (direction) {
    case 'up': return 'text-red-500 bg-red-50';
    case 'down': return 'text-green-500 bg-green-50';
    case 'stable': return 'text-gray-500 bg-gray-50';
  }
}
