import { Level, Mold, Order, GameCosts, ProductionEvent } from './types';

export class CostCalculator {
  static calculateCleanTime(
    level: Level,
    currentMoldId: string,
    nextMoldId: string
  ): number {
    if (currentMoldId === nextMoldId) {
      return 0;
    }

    const currentMold = level.molds.find(m => m.id === currentMoldId);
    const nextMold = level.molds.find(m => m.id === nextMoldId);

    if (!currentMold || !nextMold) {
      return level.crossCategoryCleanTime;
    }

    if (currentMold.category === nextMold.category) {
      return level.sameCategoryCleanTime;
    }

    return level.crossCategoryCleanTime;
  }

  static calculateChangeoverCost(
    level: Level,
    cleanTime: number
  ): { fixedCost: number; laborCost: number; total: number } {
    const fixedCost = cleanTime > 0 ? level.changeoverFixedCost : 0;
    const laborCost = cleanTime * level.laborCostPerMinute;
    return {
      fixedCost,
      laborCost,
      total: fixedCost + laborCost
    };
  }

  static calculateDelayCost(
    order: Order,
    actualFinishTime: number
  ): number {
    if (actualFinishTime <= order.deadline) {
      return 0;
    }
    const delayMinutes = actualFinishTime - order.deadline;
    return delayMinutes * order.delayPenalty;
  }

  static calculateIdleCost(
    level: Level,
    idleMinutes: number
  ): number {
    return idleMinutes * level.idleCostPerMinute;
  }

  static simulateSchedule(
    level: Level,
    scheduledOrderIds: string[]
  ): {
    totalTime: number;
    costs: GameCosts;
    events: ProductionEvent[];
    orderDetails: Array<{
      orderId: string;
      startTime: number;
      endTime: number;
      delayCost: number;
    }>;
  } {
    const events: ProductionEvent[] = [];
    const orderDetails: Array<{
      orderId: string;
      startTime: number;
      endTime: number;
      delayCost: number;
    }> = [];

    let currentTime = 0;
    let currentMoldId = level.initialMoldId;

    const costs: GameCosts = {
      total: 0,
      changeover: 0,
      cleaning: 0,
      idle: 0,
      delay: 0
    };

    events.push({
      type: 'start',
      time: 0,
      moldId: currentMoldId,
      cost: 0,
      description: `开始生产，初始模具: ${level.molds.find(m => m.id === currentMoldId)?.name}`
    });

    for (const orderId of scheduledOrderIds) {
      const order = level.orders.find(o => o.id === orderId);
      if (!order) continue;

      const cleanTime = this.calculateCleanTime(level, currentMoldId, order.moldId);

      if (cleanTime > 0) {
        const changeoverCost = this.calculateChangeoverCost(level, cleanTime);
        
        costs.changeover += changeoverCost.fixedCost;
        costs.cleaning += changeoverCost.laborCost;
        costs.total += changeoverCost.total;

        events.push({
          type: 'changeover',
          time: currentTime,
          moldId: order.moldId,
          cost: changeoverCost.fixedCost,
          description: `换模固定成本: ¥${changeoverCost.fixedCost}`
        });

        events.push({
          type: 'cleaning',
          time: currentTime,
          moldId: order.moldId,
          cost: changeoverCost.laborCost,
          description: `清洗 ${cleanTime} 分钟，工时成本: ¥${changeoverCost.laborCost}`
        });

        currentTime += cleanTime;
      }

      const startTime = currentTime;
      const endTime = startTime + order.productionTime;

      events.push({
        type: 'produce',
        time: startTime,
        orderId: order.id,
        moldId: order.moldId,
        cost: 0,
        description: `开始生产 ${order.name}`
      });

      currentTime = endTime;

      const delayCost = this.calculateDelayCost(order, currentTime);
      if (delayCost > 0) {
        costs.delay += delayCost;
        costs.total += delayCost;
        events.push({
          type: 'delay',
          time: currentTime,
          orderId: order.id,
          cost: delayCost,
          description: `${order.name} 延迟 ${currentTime - order.deadline} 分钟，罚款: ¥${delayCost}`
        });
      }

      events.push({
        type: 'complete',
        time: currentTime,
        orderId: order.id,
        moldId: order.moldId,
        cost: 0,
        description: `${order.name} 生产完成`
      });

      orderDetails.push({
        orderId: order.id,
        startTime,
        endTime,
        delayCost
      });

      currentMoldId = order.moldId;
    }

    return {
      totalTime: currentTime,
      costs,
      events,
      orderDetails
    };
  }

  static calculateScore(
    actualCost: number,
    targetCost: number,
    isWin: boolean
  ): string {
    if (!isWin) return 'D';
    
    const ratio = actualCost / targetCost;
    
    if (ratio <= 0.7) return 'S';
    if (ratio <= 0.85) return 'A';
    if (ratio <= 1.0) return 'B';
    if (ratio <= 1.2) return 'C';
    return 'D';
  }

  static calculateStars(score: string): number {
    switch (score) {
      case 'S': return 3;
      case 'A': return 2;
      case 'B': return 1;
      default: return 0;
    }
  }
}
