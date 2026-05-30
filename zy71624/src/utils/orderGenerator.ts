import { v4 as uuidv4 } from 'uuid';
import type { Order, Difficulty, Bar } from '@/types';

interface OrderTemplate {
  barId: number;
  barName: string;
  requiredVoltage: number;
  requiredCurrent: number;
  timeoutSeconds: number;
  difficulty: number;
  score: number;
}

const ORDER_TEMPLATES: Record<Difficulty, OrderTemplate[]> = {
  easy: [
    { barId: 1, barName: '主吧台', requiredVoltage: 6, requiredCurrent: 0.5, timeoutSeconds: 45, difficulty: 1, score: 50 },
    { barId: 2, barName: 'DJ台', requiredVoltage: 3, requiredCurrent: 0.3, timeoutSeconds: 40, difficulty: 1, score: 40 },
    { barId: 4, barName: '休息区', requiredVoltage: 6, requiredCurrent: 0.4, timeoutSeconds: 50, difficulty: 1, score: 50 },
  ],
  medium: [
    { barId: 1, barName: '主吧台', requiredVoltage: 6, requiredCurrent: 0.5, timeoutSeconds: 35, difficulty: 2, score: 60 },
    { barId: 2, barName: 'DJ台', requiredVoltage: 3, requiredCurrent: 0.3, timeoutSeconds: 30, difficulty: 2, score: 50 },
    { barId: 3, barName: '舞池', requiredVoltage: 9, requiredCurrent: 0.8, timeoutSeconds: 40, difficulty: 2, score: 80 },
    { barId: 4, barName: '休息区', requiredVoltage: 6, requiredCurrent: 0.4, timeoutSeconds: 40, difficulty: 2, score: 60 },
  ],
  hard: [
    { barId: 1, barName: '主吧台', requiredVoltage: 6, requiredCurrent: 0.6, timeoutSeconds: 25, difficulty: 3, score: 70 },
    { barId: 2, barName: 'DJ台', requiredVoltage: 3, requiredCurrent: 0.4, timeoutSeconds: 20, difficulty: 3, score: 60 },
    { barId: 3, barName: '舞池', requiredVoltage: 9, requiredCurrent: 1.0, timeoutSeconds: 30, difficulty: 3, score: 100 },
    { barId: 4, barName: '休息区', requiredVoltage: 6, requiredCurrent: 0.5, timeoutSeconds: 30, difficulty: 3, score: 70 },
    { barId: 5, barName: '入口', requiredVoltage: 12, requiredCurrent: 0.5, timeoutSeconds: 35, difficulty: 3, score: 120 },
  ],
};

export class OrderGenerator {
  private lastBarId: number | null = null;

  generateOrder(difficulty: Difficulty, bars: Bar[], existingOrders: Order[]): Order | null {
    const templates = ORDER_TEMPLATES[difficulty];

    const availableBars = bars.filter(bar =>
      !existingOrders.some(o => o.barId === bar.id && o.status === 'pending')
    );

    if (availableBars.length === 0) return null;

    const availableTemplates = templates.filter(t =>
      availableBars.some(b => b.id === t.barId) &&
      t.barId !== this.lastBarId
    );

    if (availableTemplates.length === 0) {
      const fallbackTemplates = templates.filter(t =>
        availableBars.some(b => b.id === t.barId)
      );
      if (fallbackTemplates.length === 0) return null;
    }

    const templateList = availableTemplates.length > 0 ? availableTemplates : templates;
    const randomIndex = Math.floor(Math.random() * templateList.length);
    const template = templateList[randomIndex];

    this.lastBarId = template.barId;

    return {
      id: uuidv4(),
      barId: template.barId,
      barName: template.barName,
      requiredVoltage: template.requiredVoltage,
      requiredCurrent: template.requiredCurrent,
      timeoutSeconds: template.timeoutSeconds,
      status: 'pending',
      createdAt: Date.now(),
      difficulty: template.difficulty,
      score: template.score,
    };
  }

  generateInitialOrders(difficulty: Difficulty, bars: Bar[], count: number = 2): Order[] {
    const orders: Order[] = [];
    const templates = ORDER_TEMPLATES[difficulty];
    const usedBarIds = new Set<number>();

    for (let i = 0; i < count && i < templates.length; i++) {
      const availableTemplates = templates.filter(t => !usedBarIds.has(t.barId));
      if (availableTemplates.length === 0) break;

      const randomIndex = Math.floor(Math.random() * availableTemplates.length);
      const template = availableTemplates[randomIndex];
      usedBarIds.add(template.barId);

      orders.push({
        id: uuidv4(),
        barId: template.barId,
        barName: template.barName,
        requiredVoltage: template.requiredVoltage,
        requiredCurrent: template.requiredCurrent,
        timeoutSeconds: template.timeoutSeconds,
        status: 'pending',
        createdAt: Date.now(),
        difficulty: template.difficulty,
        score: template.score,
      });
    }

    return orders;
  }

  checkOrderCompletion(order: Order, bar: Bar): { completed: boolean; problemType?: Order['problemType'] } {
    const voltageTolerance = 0.2;
    const minVoltage = order.requiredVoltage * (1 - voltageTolerance);
    const maxVoltage = order.requiredVoltage * (1 + voltageTolerance);

    if (bar.currentVoltage >= minVoltage && bar.currentVoltage <= maxVoltage) {
      if (bar.status === 'overvoltage') {
        return { completed: true, problemType: 'overvoltage' };
      }
      return { completed: true, problemType: 'normal' };
    }

    if (bar.currentVoltage < minVoltage && bar.currentVoltage > 0) {
      return { completed: false, problemType: 'shortage' };
    }

    if (bar.currentVoltage > maxVoltage) {
      return { completed: false, problemType: 'overvoltage' };
    }

    return { completed: false };
  }

  reset(): void {
    this.lastBarId = null;
  }
}

export const orderGenerator = new OrderGenerator();

export const getOrderStatusColor = (status: Order['status']): string => {
  switch (status) {
    case 'pending':
      return '#F59E0B';
    case 'completed':
      return '#10B981';
    case 'timeout':
      return '#EF4444';
    case 'returned':
      return '#EC4899';
    case 'confirmed':
      return '#06B6D4';
    default:
      return '#94A3B8';
  }
};

export const getOrderStatusText = (status: Order['status']): string => {
  switch (status) {
    case 'pending':
      return '处理中';
    case 'completed':
      return '已完成';
    case 'timeout':
      return '已超时';
    case 'returned':
      return '退回补材料';
    case 'confirmed':
      return '已确认';
    default:
      return '未知';
  }
};
