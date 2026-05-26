import { Level, GameState, GameStatus, ProductionEvent, GameCosts } from './types';
import { CostCalculator } from './calculator';
import { getMoldById, getOrderById } from './levels';

export class GameEngine {
  private level: Level;
  private state: GameState;
  private listeners: Array<(state: GameState) => void> = [];

  constructor(level: Level) {
    this.level = level;
    this.state = this.createInitialState();
  }

  private createInitialState(): GameState {
    return {
      levelId: this.level.id,
      status: 'idle',
      scheduledOrders: [],
      currentTime: 0,
      currentMoldId: this.level.initialMoldId,
      currentOrderIndex: 0,
      currentPhase: 'idle',
      phaseStartTime: 0,
      phaseDuration: 0,
      costs: {
        total: 0,
        changeover: 0,
        cleaning: 0,
        idle: 0,
        delay: 0
      },
      completedOrders: [],
      events: [{
        type: 'start',
        time: 0,
        moldId: this.level.initialMoldId,
        cost: 0,
        description: `游戏开始，准备排程`
      }],
      speed: 1
    };
  }

  getState(): GameState {
    return { ...this.state };
  }

  getLevel(): Level {
    return this.level;
  }

  subscribe(listener: (state: GameState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify(): void {
    this.listeners.forEach(listener => listener(this.getState()));
  }

  setScheduledOrders(orderIds: string[]): void {
    if (this.state.status === 'running' || this.state.status === 'paused') {
      return;
    }
    this.state.scheduledOrders = [...orderIds];
    this.state.status = 'scheduling';
    this.notify();
  }

  start(): void {
    if (this.state.scheduledOrders.length === 0) {
      return;
    }
    
    const savedSchedule = [...this.state.scheduledOrders];
    
    this.state = this.createInitialState();
    this.state.scheduledOrders = savedSchedule;
    this.state.status = 'running';
    this.state.currentPhase = 'idle';
    this.notify();
    
    this.processNextPhase();
  }

  pause(): void {
    if (this.state.status === 'running') {
      this.state.status = 'paused';
      this.notify();
    }
  }

  resume(): void {
    if (this.state.status === 'paused') {
      this.state.status = 'running';
      this.notify();
    }
  }

  reset(): void {
    this.state = this.createInitialState();
    this.notify();
  }

  setSpeed(speed: number): void {
    this.state.speed = speed;
    this.notify();
  }

  tick(deltaTime: number): void {
    if (this.state.status !== 'running') {
      return;
    }

    const scaledDelta = deltaTime * this.state.speed;
    this.state.currentTime += scaledDelta;

    if (this.state.currentPhase !== 'idle') {
      const phaseProgress = this.state.currentTime - this.state.phaseStartTime;
      
      if (phaseProgress >= this.state.phaseDuration) {
        this.completeCurrentPhase();
      }
    }

    this.checkWinLose();
    this.notify();
  }

  private processNextPhase(): void {
    if (this.state.status !== 'running') return;

    const nextOrderIndex = this.state.currentOrderIndex;
    
    if (nextOrderIndex >= this.state.scheduledOrders.length) {
      this.completeGame();
      return;
    }

    const nextOrderId = this.state.scheduledOrders[nextOrderIndex];
    const nextOrder = getOrderById(this.level, nextOrderId);
    
    if (!nextOrder) {
      this.state.currentOrderIndex++;
      this.processNextPhase();
      return;
    }

    const cleanTime = CostCalculator.calculateCleanTime(
      this.level,
      this.state.currentMoldId,
      nextOrder.moldId
    );

    if (cleanTime > 0) {
      const changeoverCost = CostCalculator.calculateChangeoverCost(this.level, cleanTime);
      
      this.state.costs.changeover += changeoverCost.fixedCost;
      this.state.costs.cleaning += changeoverCost.laborCost;
      this.state.costs.total += changeoverCost.total;

      this.state.events.push({
        type: 'changeover',
        time: this.state.currentTime,
        moldId: nextOrder.moldId,
        cost: changeoverCost.fixedCost,
        description: `换模: ${getMoldById(this.level, this.state.currentMoldId)?.name} → ${getMoldById(this.level, nextOrder.moldId)?.name}, 固定成本: ¥${changeoverCost.fixedCost}`
      });

      this.state.events.push({
        type: 'cleaning',
        time: this.state.currentTime,
        moldId: nextOrder.moldId,
        cost: changeoverCost.laborCost,
        description: `清洗 ${cleanTime} 分钟, 工时成本: ¥${changeoverCost.laborCost}`
      });

      this.state.currentPhase = 'cleaning';
      this.state.phaseStartTime = this.state.currentTime;
      this.state.phaseDuration = cleanTime;
    } else {
      this.startProduction(nextOrderId);
    }
  }

  private startProduction(orderId: string): void {
    const order = getOrderById(this.level, orderId);
    if (!order) return;

    this.state.currentMoldId = order.moldId;
    this.state.currentPhase = 'producing';
    this.state.phaseStartTime = this.state.currentTime;
    this.state.phaseDuration = order.productionTime;

    this.state.events.push({
      type: 'produce',
      time: this.state.currentTime,
      orderId: order.id,
      moldId: order.moldId,
      cost: 0,
      description: `开始生产: ${order.name}`
    });
  }

  private completeCurrentPhase(): void {
    if (this.state.currentPhase === 'cleaning') {
      const nextOrderId = this.state.scheduledOrders[this.state.currentOrderIndex];
      if (nextOrderId) {
        this.startProduction(nextOrderId);
      }
    } else if (this.state.currentPhase === 'producing') {
      const orderId = this.state.scheduledOrders[this.state.currentOrderIndex];
      const order = getOrderById(this.level, orderId);
      
      if (order) {
        const delayCost = CostCalculator.calculateDelayCost(order, this.state.currentTime);
        
        if (delayCost > 0) {
          this.state.costs.delay += delayCost;
          this.state.costs.total += delayCost;
          
          this.state.events.push({
            type: 'delay',
            time: this.state.currentTime,
            orderId: order.id,
            cost: delayCost,
            description: `${order.name} 延迟 ${Math.floor(this.state.currentTime - order.deadline)} 分钟, 罚款: ¥${delayCost}`
          });
        }

        this.state.events.push({
          type: 'complete',
          time: this.state.currentTime,
          orderId: order.id,
          moldId: order.moldId,
          cost: 0,
          description: `${order.name} 生产完成`
        });

        this.state.completedOrders.push(order.id);
      }

      this.state.currentOrderIndex++;
      this.state.currentPhase = 'idle';
      
      this.processNextPhase();
    }
  }

  private completeGame(): void {
    this.state.status = 'completed';
    this.notify();
  }

  private checkWinLose(): void {
    const maxCost = this.level.targetCost * 1.5;
    
    if (this.state.costs.total > maxCost) {
      this.state.status = 'failed';
      this.state.failReason = `总成本 ¥${Math.floor(this.state.costs.total)} 超过上限 ¥${Math.floor(maxCost)}`;
      this.notify();
    }

    for (const orderId of this.state.scheduledOrders) {
      const order = getOrderById(this.level, orderId);
      if (!order) continue;
      
      if (!this.state.completedOrders.includes(orderId)) {
        const maxDelay = order.deadline * 2;
        if (this.state.currentTime > maxDelay) {
          this.state.status = 'failed';
          this.state.failReason = `订单 ${order.name} 延迟时间过长`;
          this.notify();
          return;
        }
      }
    }
  }

  getSimulationResult(): {
    isWin: boolean;
    score: string;
    stars: number;
    failReason?: string;
  } {
    const isWin = this.state.status === 'completed' && 
                  this.state.costs.total <= this.level.targetCost;
    
    const score = CostCalculator.calculateScore(
      this.state.costs.total,
      this.level.targetCost,
      isWin
    );
    
    const stars = CostCalculator.calculateStars(score);

    return {
      isWin,
      score,
      stars,
      failReason: this.state.failReason
    };
  }
}
