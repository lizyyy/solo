import type { GameState, LevelConfig, CustomerInstance, Product } from '../types/game';
import { generateId, deepClone, clamp } from '../utils/helpers';
import { createCustomerInstance, updateCustomer, shouldSpawnCustomer, selectCustomerTemplate } from './CustomerAI';
import { calculateOrderScore, calculateSatisfactionScore, calculateFinalScore, calculateOverallSatisfaction } from './ScoreCalculator';
import { putRecord, getFromIndex, deleteRecord } from '../utils/idb';
import type { GameSaveState } from '../types/game';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const AUTO_SAVE_INTERVAL = 5000;

export class GameEngine {
  private state: GameState;
  private levelConfig: LevelConfig;
  private animationFrameId: number | null = null;
  private lastTime: number = 0;
  private autoSaveTimer: NodeJS.Timeout | null = null;
  private totalSatisfaction: number = 0;
  private onStateChange: ((state: GameState) => void) | null = null;
  private onGameOver: ((score: number, state: GameState) => void) | null = null;

  constructor(levelConfig: LevelConfig, savedState?: GameState) {
    this.levelConfig = levelConfig;
    if (savedState) {
      this.state = savedState;
    } else {
      this.state = this.createInitialState(levelConfig);
    }
  }

  private createInitialState(levelConfig: LevelConfig): GameState {
    const inventory: Record<string, number> = {};
    const prices: Record<string, number> = {};

    levelConfig.products.forEach((product) => {
      inventory[product.id] = 10;
      prices[product.id] = product.basePrice;
    });

    return {
      levelId: levelConfig.id,
      timeRemaining: levelConfig.duration,
      score: 0,
      satisfaction: 100,
      inventory,
      prices,
      customers: [],
      isPaused: false,
      isGameOver: false,
      totalCustomersServed: 0,
      totalCustomersLost: 0,
      revenue: 0,
      costs: 0,
    };
  }

  public setOnStateChange(callback: (state: GameState) => void): void {
    this.onStateChange = callback;
  }

  public setOnGameOver(callback: (score: number, state: GameState) => void): void {
    this.onGameOver = callback;
  }

  public getState(): GameState {
    return deepClone(this.state);
  }

  public start(): void {
    if (this.animationFrameId) return;
    this.lastTime = performance.now();
    this.gameLoop();
    this.startAutoSave();
  }

  public pause(): void {
    this.state.isPaused = true;
    this.notifyStateChange();
  }

  public resume(): void {
    this.state.isPaused = false;
    this.lastTime = performance.now();
    this.notifyStateChange();
  }

  public reset(): void {
    this.stop();
    this.state = this.createInitialState(this.levelConfig);
    this.totalSatisfaction = 0;
    this.notifyStateChange();
  }

  public stop(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  public setPrice(productId: string, price: number): void {
    if (this.state.prices[productId] !== undefined) {
      this.state.prices[productId] = clamp(price, 1, 999);
      this.notifyStateChange();
    }
  }

  public restock(productId: string, amount: number): void {
    const product = this.levelConfig.products.find((p) => p.id === productId);
    if (!product) return;

    const cost = product.baseCost * amount;
    if (this.state.revenue >= cost || this.state.costs === 0) {
      this.state.inventory[productId] = (this.state.inventory[productId] || 0) + amount;
      this.state.costs += cost;
      this.notifyStateChange();
    }
  }

  public serveCustomer(customerId: string): void {
    const customerIndex = this.state.customers.findIndex((c) => c.id === customerId);
    if (customerIndex === -1) return;

    const customer = this.state.customers[customerIndex];
    if (customer.state !== 'ordering' || !customer.order) return;

    const product = this.levelConfig.products.find((p) => p.id === customer.order);
    if (!product) return;

    if ((this.state.inventory[customer.order] || 0) <= 0) return;

    const price = this.state.prices[customer.order] || product.basePrice;
    const satisfaction = calculateSatisfactionScore(customer);
    const orderScore = calculateOrderScore(customer.order, price, product.baseCost, satisfaction);

    this.state.inventory[customer.order]--;
    this.state.revenue += price;
    this.state.score += orderScore;
    this.totalSatisfaction += satisfaction;
    this.state.totalCustomersServed++;

    this.state.customers[customerIndex] = {
      ...customer,
      state: 'happy',
      targetX: customer.x < CANVAS_WIDTH / 2 ? -50 : CANVAS_WIDTH + 50,
    };

    this.updateOverallSatisfaction();
    this.notifyStateChange();
  }

  private gameLoop(): void {
    const currentTime = performance.now();
    const deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    if (!this.state.isPaused && !this.state.isGameOver) {
      this.update(deltaTime);
    }

    this.animationFrameId = requestAnimationFrame(() => this.gameLoop());
  }

  private update(deltaTime: number): void {
    this.state.timeRemaining -= deltaTime;

    if (this.state.timeRemaining <= 0) {
      this.state.timeRemaining = 0;
      this.endGame();
      return;
    }

    if (shouldSpawnCustomer(
      this.state.customers.length,
      8,
      this.state.timeRemaining,
      this.levelConfig.duration
    )) {
      const template = selectCustomerTemplate(this.levelConfig.customers);
      const newCustomer = createCustomerInstance(template);
      this.state.customers.push(newCustomer);
    }

    const waitingQueue = this.state.customers
      .filter((c) => c.state === 'waiting' || c.state === 'ordering')
      .sort((a, b) => Math.abs(a.x - CANVAS_WIDTH / 2) - Math.abs(b.x - CANVAS_WIDTH / 2));

    this.state.customers = this.state.customers
      .map((customer, _) => {
        const queuePos = waitingQueue.findIndex((c) => c.id === customer.id);
        return updateCustomer(
          customer,
          deltaTime,
          queuePos,
          this.levelConfig.products
        );
      })
      .filter((customer) => {
        if (customer.state === 'leaving' && (customer.x < -60 || customer.x > CANVAS_WIDTH + 60)) {
          if (customer.patience <= 0) {
            this.state.totalCustomersLost++;
            this.updateOverallSatisfaction();
          }
          return false;
        }
        if (customer.state === 'happy' && (customer.x < -60 || customer.x > CANVAS_WIDTH + 60)) {
          return false;
        }
        return true;
      });

    this.notifyStateChange();
  }

  private updateOverallSatisfaction(): void {
    this.state.satisfaction = calculateOverallSatisfaction(
      this.state.totalCustomersServed,
      this.totalSatisfaction,
      this.state.totalCustomersLost
    );
  }

  private endGame(): void {
    this.state.isGameOver = true;
    this.state.score = calculateFinalScore(this.state);
    this.stop();
    this.clearAutoSave();

    if (this.onGameOver) {
      this.onGameOver(this.state.score, this.getState());
    }
    this.notifyStateChange();
  }

  private notifyStateChange(): void {
    if (this.onStateChange) {
      this.onStateChange(this.getState());
    }
  }

  private startAutoSave(): void {
    this.autoSaveTimer = setInterval(() => {
      if (!this.state.isGameOver && !this.state.isPaused) {
        this.autoSave();
      }
    }, AUTO_SAVE_INTERVAL);
  }

  private async autoSave(): Promise<void> {
    try {
      const saveState: GameSaveState = {
        id: `save-${this.state.levelId}`,
        gameState: this.getState(),
        savedAt: Date.now(),
        isDisconnected: false,
      };
      await putRecord('game_save', saveState);
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }

  private async clearAutoSave(): Promise<void> {
    try {
      const saveId = `save-${this.state.levelId}`;
      await deleteRecord('game_save', saveId);
    } catch (error) {
      console.error('Clear save failed:', error);
    }
  }

  public async markAsDisconnected(): Promise<void> {
    try {
      const saves = await getFromIndex('game_save', 'by-savedAt');
      const recentSave = saves[saves.length - 1];
      if (recentSave) {
        await putRecord('game_save', {
          ...recentSave,
          isDisconnected: true,
          savedAt: Date.now(),
        });
      }
    } catch (error) {
      console.error('Mark disconnected failed:', error);
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    this.drawBackground(ctx);
    this.drawStall(ctx);
    this.drawCustomers(ctx);
    this.drawUI(ctx);
  }

  private drawBackground(ctx: CanvasRenderingContext2D): void {
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, '#1a0a2e');
    gradient.addColorStop(0.5, '#2D1B4E');
    gradient.addColorStop(1, '#3D2B5E');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    for (let i = 0; i < 50; i++) {
      const x = (i * 37) % CANVAS_WIDTH;
      const y = (i * 23) % 200;
      const size = (i % 3) * 0.5 + 1;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + (i % 5) * 0.1})`;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#1a0f2e';
    ctx.fillRect(0, 420, CANVAS_WIDTH, CANVAS_HEIGHT - 420);

    ctx.fillStyle = '#2a1f3e';
    for (let i = 0; i < CANVAS_WIDTH; i += 40) {
      ctx.fillRect(i, 420, 20, 4);
    }

    const lanternPositions = [100, 250, 550, 700];
    lanternPositions.forEach((x, i) => {
      this.drawLantern(ctx, x, 80 + (i % 2) * 20);
    });
  }

  private drawLantern(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const time = Date.now() / 1000;
    const sway = Math.sin(time + x) * 5;

    ctx.strokeStyle = '#FF6B35';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + sway, y);
    ctx.stroke();

    ctx.fillStyle = '#FF6B35';
    ctx.shadowColor = '#FF6B35';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.ellipse(x + sway, y + 15, 20, 25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#FFE066';
    ctx.fillRect(x + sway - 15, y, 30, 6);
    ctx.fillRect(x + sway - 15, y + 24, 30, 6);

    ctx.fillStyle = '#FF4D8D';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('福', x + sway, y + 20);
  }

  private drawStall(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(300, 300, 200, 120);

    ctx.fillStyle = '#A0522D';
    ctx.fillRect(290, 290, 220, 20);

    ctx.fillStyle = '#FF6B35';
    ctx.shadowColor = '#FF6B35';
    ctx.shadowBlur = 15;
    ctx.fillRect(320, 250, 160, 40);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 20px "ZCOOL KuaiLe", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('夜市小铺', 400, 278);

    const products = this.levelConfig.products;
    products.forEach((product, i) => {
      const x = 320 + (i % 3) * 60;
      const y = 340 + Math.floor(i / 3) * 40;

      ctx.fillStyle = '#654321';
      ctx.fillRect(x, y, 50, 30);

      ctx.font = '24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(product.emoji, x + 25, y + 24);

      const stock = this.state.inventory[product.id] || 0;
      ctx.fillStyle = stock > 0 ? '#00FFA3' : '#FF4D8D';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(`x${stock}`, x + 25, y + 42);
    });

    ctx.fillStyle = '#4a3a5e';
    ctx.fillRect(300, 420, 200, 30);
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = '#FFE066';
      ctx.beginPath();
      ctx.arc(330 + i * 35, 435, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawCustomers(ctx: CanvasRenderingContext2D): void {
    this.state.customers.forEach((customer) => {
      this.drawCustomer(ctx, customer);
    });
  }

  private drawCustomer(ctx: CanvasRenderingContext2D, customer: CustomerInstance): void {
    const y = customer.y;
    const bounce = customer.state === 'walking' ? Math.sin(Date.now() / 100) * 3 : 0;

    if (customer.state === 'happy') {
      ctx.fillStyle = 'rgba(0, 255, 163, 0.3)';
      ctx.beginPath();
      ctx.arc(customer.x, y - 20, 30, 0, Math.PI * 2);
      ctx.fill();
    }

    if (customer.state === 'leaving' && customer.patience <= 0) {
      ctx.fillStyle = 'rgba(255, 77, 141, 0.3)';
      ctx.beginPath();
      ctx.arc(customer.x, y - 20, 30, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#4D3B6E';
    ctx.beginPath();
    ctx.ellipse(customer.x, y + 10 + bounce, 20, 15, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFE4C4';
    ctx.beginPath();
    ctx.arc(customer.x, y - 15 + bounce, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(customer.emoji, customer.x, y - 10 + bounce);

    if (customer.state === 'waiting' || customer.state === 'ordering') {
      const patienceRatio = customer.patience / customer.maxPatience;
      ctx.fillStyle = '#333';
      ctx.fillRect(customer.x - 20, y - 45 + bounce, 40, 6);
      ctx.fillStyle = patienceRatio > 0.5 ? '#00FFA3' : patienceRatio > 0.25 ? '#FFE066' : '#FF4D8D';
      ctx.fillRect(customer.x - 20, y - 45 + bounce, 40 * patienceRatio, 6);
    }

    if (customer.state === 'ordering' && customer.order) {
      const product = this.levelConfig.products.find((p) => p.id === customer.order);
      if (product) {
        ctx.font = '20px Arial';
        ctx.fillText(product.emoji, customer.x, y - 55 + bounce);
      }
    }

    if (customer.state === 'happy') {
      ctx.font = '16px Arial';
      ctx.fillText('💰', customer.x + 20, y - 30 + bounce);
    }
  }

  private drawUI(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(45, 27, 78, 0.9)';
    ctx.fillRect(10, 10, 200, 100);
    ctx.strokeStyle = '#FF6B35';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, 200, 100);

    ctx.fillStyle = '#FFF';
    ctx.font = '14px "Noto Sans SC", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`⏱ 时间: ${Math.ceil(this.state.timeRemaining)}秒`, 20, 35);
    ctx.fillText(`💰 分数: ${this.state.score}`, 20, 58);
    ctx.fillText(`😊 满意度: ${Math.floor(this.state.satisfaction)}%`, 20, 81);
    ctx.fillText(`👥 已服务: ${this.state.totalCustomersServed}`, 20, 104);

    if (this.state.isPaused) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = '#FFE066';
      ctx.font = 'bold 48px "ZCOOL KuaiLe", sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#FFE066';
      ctx.shadowBlur = 20;
      ctx.fillText('⏸ 暂停中', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      ctx.shadowBlur = 0;
    }
  }
}

export async function checkUnfinishedGame(): Promise<GameSaveState | null> {
  try {
    const saves = await getFromIndex('game_save', 'by-savedAt');
    if (saves.length === 0) return null;

    const latestSave = saves[saves.length - 1];
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;

    if (latestSave.savedAt < fiveMinutesAgo && !latestSave.isDisconnected) {
      return null;
    }

    return latestSave;
  } catch (error) {
    console.error('Check unfinished game failed:', error);
    return null;
  }
}

export function createDefaultLevel(): LevelConfig {
  const now = Date.now();
  return {
    id: 'default-level-1',
    name: '新手夜市',
    duration: 120,
    source: 'draft',
    contact: '运营组 @小李',
    createdAt: now,
    updatedAt: now,
    version: '1.0.0',
    products: [
      { id: 'p1', name: '烤串', baseCost: 3, basePrice: 8, emoji: '🍢' },
      { id: 'p2', name: '拉面', baseCost: 5, basePrice: 15, emoji: '🍜' },
      { id: 'p3', name: '奶茶', baseCost: 4, basePrice: 12, emoji: '🧋' },
      { id: 'p4', name: '臭豆腐', baseCost: 3, basePrice: 10, emoji: '🫘' },
      { id: 'p5', name: '烤玉米', baseCost: 2, basePrice: 6, emoji: '🌽' },
      { id: 'p6', name: '冰激凌', baseCost: 3, basePrice: 8, emoji: '🍦' },
    ],
    customers: [
      { id: 'c1', name: '上班族', patience: 60, budget: 30, preferences: ['p1', 'p2'], emoji: '👨‍💼' },
      { id: 'c2', name: '学生', patience: 80, budget: 20, preferences: ['p3', 'p6'], emoji: '👩‍🎓' },
      { id: 'c3', name: '游客', patience: 100, budget: 50, preferences: ['p4', 'p5'], emoji: '🧑‍🦯' },
      { id: 'c4', name: '情侣', patience: 90, budget: 40, preferences: ['p1', 'p3'], emoji: '👫' },
      { id: 'c5', name: '小朋友', patience: 40, budget: 15, preferences: ['p5', 'p6'], emoji: '👧' },
    ],
  };
}
