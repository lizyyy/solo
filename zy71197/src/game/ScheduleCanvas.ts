import { Level, GameState, Order, Mold } from '../game/types';
import { getMoldById, getOrderById } from '../game/levels';

export class ScheduleCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private level: Level;
  private dpr: number;

  private layout = {
    padding: { top: 60, right: 40, bottom: 80, left: 120 },
    rowHeight: 50,
    timelineHeight: 30,
    orderLabelWidth: 100
  };

  constructor(canvas: HTMLCanvasElement, level: Level) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.level = level;
    this.dpr = window.devicePixelRatio || 1;
    this.resize();
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * this.dpr;
    this.canvas.height = rect.height * this.dpr;
    this.ctx.scale(this.dpr, this.dpr);
  }

  setLevel(level: Level): void {
    this.level = level;
  }

  render(state: GameState): void {
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    this.ctx.clearRect(0, 0, width, height);

    this.drawBackground(width, height);
    this.drawTimeline(width, state);
    this.drawGanttChart(width, height, state);
    this.drawCurrentTimeIndicator(width, height, state);
    this.drawMoldLegend(width, height);
  }

  private drawBackground(width: number, height: number): void {
    this.ctx.fillStyle = '#1e293b';
    this.ctx.fillRect(0, 0, width, height);

    this.ctx.strokeStyle = '#334155';
    this.ctx.lineWidth = 0.5;

    const gridSize = 40;
    for (let x = 0; x < width; x += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, height);
      this.ctx.stroke();
    }

    for (let y = 0; y < height; y += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(width, y);
      this.ctx.stroke();
    }
  }

  private drawTimeline(width: number, state: GameState): void {
    const { padding, timelineHeight } = this.layout;
    const chartWidth = width - padding.left - padding.right;
    const totalTime = this.getMaxTimeline(state);

    this.ctx.fillStyle = '#0f172a';
    this.ctx.fillRect(padding.left, padding.top - timelineHeight, chartWidth, timelineHeight);

    this.ctx.strokeStyle = '#475569';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(padding.left, padding.top);
    this.ctx.lineTo(width - padding.right, padding.top);
    this.ctx.stroke();

    const tickCount = 10;
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.font = '12px Inter, sans-serif';
    this.ctx.textAlign = 'center';

    for (let i = 0; i <= tickCount; i++) {
      const x = padding.left + (chartWidth / tickCount) * i;
      const time = Math.floor((totalTime / tickCount) * i);
      
      this.ctx.strokeStyle = '#475569';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(x, padding.top - timelineHeight);
      this.ctx.lineTo(x, padding.top);
      this.ctx.stroke();

      this.ctx.fillText(`${time}分`, x, padding.top - 8);
    }

    this.ctx.fillStyle = '#e2e8f0';
    this.ctx.font = 'bold 14px JetBrains Mono, monospace';
    this.ctx.textAlign = 'left';
    this.ctx.fillText('时间线 (分钟)', padding.left, padding.top - timelineHeight + 20);
  }

  private getMaxTimeline(state: GameState): number {
    let maxTime = 0;
    
    for (const orderId of state.scheduledOrders) {
      const order = getOrderById(this.level, orderId);
      if (order && order.deadline > maxTime) {
        maxTime = order.deadline;
      }
    }
    
    const simulationResult = this.simulateTimeline(state);
    if (simulationResult > maxTime) {
      maxTime = simulationResult;
    }
    
    return Math.max(maxTime * 1.2, 100);
  }

  private simulateTimeline(state: GameState): number {
    let time = 0;
    let currentMold = state.currentMoldId;
    
    for (const orderId of state.scheduledOrders) {
      const order = getOrderById(this.level, orderId);
      if (!order) continue;
      
      if (currentMold !== order.moldId) {
        const currentMoldObj = getMoldById(this.level, currentMold);
        const nextMoldObj = getMoldById(this.level, order.moldId);
        
        if (currentMoldObj && nextMoldObj) {
          if (currentMoldObj.category === nextMoldObj.category) {
            time += this.level.sameCategoryCleanTime;
          } else {
            time += this.level.crossCategoryCleanTime;
          }
        }
      }
      
      time += order.productionTime;
      currentMold = order.moldId;
    }
    
    return time;
  }

  private drawGanttChart(width: number, height: number, state: GameState): void {
    const { padding, rowHeight } = this.layout;
    const chartWidth = width - padding.left - padding.right;
    const totalTime = this.getMaxTimeline(state);
    const pixelsPerMinute = chartWidth / totalTime;

    let currentTime = 0;
    let currentMold = state.currentMoldId;

    this.drawOrderLabels(padding.left, height);

    state.scheduledOrders.forEach((orderId, index) => {
      const order = getOrderById(this.level, orderId);
      if (!order) return;

      let cleanTime = 0;
      if (currentMold !== order.moldId) {
        const currentMoldObj = getMoldById(this.level, currentMold);
        const nextMoldObj = getMoldById(this.level, order.moldId);
        
        if (currentMoldObj && nextMoldObj) {
          cleanTime = currentMoldObj.category === nextMoldObj.category 
            ? this.level.sameCategoryCleanTime 
            : this.level.crossCategoryCleanTime;
        }
      }

      const y = padding.top + 10 + index * (rowHeight + 10);
      const isCompleted = state.completedOrders.includes(orderId);
      const isInProgress = !isCompleted && index === state.currentOrderIndex && state.status === 'running';

      if (cleanTime > 0) {
        const cleanX = padding.left + currentTime * pixelsPerMinute;
        const cleanWidth = cleanTime * pixelsPerMinute;
        
        this.ctx.fillStyle = '#64748b';
        this.ctx.fillRect(cleanX, y + 5, cleanWidth, rowHeight - 10);
        
        this.ctx.fillStyle = '#94a3b8';
        this.ctx.font = '10px Inter, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`清洗 ${cleanTime}分`, cleanX + cleanWidth / 2, y + rowHeight / 2);
      }

      currentTime += cleanTime;

      const prodX = padding.left + currentTime * pixelsPerMinute;
      const prodWidth = order.productionTime * pixelsPerMinute;

      const mold = getMoldById(this.level, order.moldId);
      const baseColor = mold?.color || '#3b82f6';
      
      this.ctx.fillStyle = isCompleted ? this.adjustColor(baseColor, 0.6) : baseColor;
      this.ctx.globalAlpha = isInProgress ? 1 : (isCompleted ? 0.8 : 1);
      
      const radius = 4;
      this.roundRect(prodX, y, prodWidth, rowHeight, radius);
      this.ctx.fill();

      this.ctx.globalAlpha = 1;

      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = 'bold 12px Inter, sans-serif';
      this.ctx.textAlign = 'left';
      this.ctx.fillText(order.name, prodX + 8, y + 20);
      
      this.ctx.fillStyle = '#e2e8f0';
      this.ctx.font = '11px Inter, sans-serif';
      this.ctx.fillText(`${order.productionTime}分`, prodX + 8, y + 38);

      const deadlineX = padding.left + order.deadline * pixelsPerMinute;
      this.ctx.strokeStyle = currentTime + order.productionTime > order.deadline ? '#ef4444' : '#f59e0b';
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([5, 5]);
      this.ctx.beginPath();
      this.ctx.moveTo(deadlineX, y);
      this.ctx.lineTo(deadlineX, y + rowHeight);
      this.ctx.stroke();
      this.ctx.setLineDash([]);

      this.ctx.fillStyle = currentTime + order.productionTime > order.deadline ? '#ef4444' : '#f59e0b';
      this.ctx.font = '10px Inter, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(`交期: ${order.deadline}`, deadlineX, y - 5);

      currentTime += order.productionTime;
      currentMold = order.moldId;
    });
  }

  private drawOrderLabels(left: number, height: number): void {
    this.ctx.fillStyle = '#e2e8f0';
    this.ctx.font = 'bold 12px JetBrains Mono, monospace';
    this.ctx.textAlign = 'right';

    this.level.orders.forEach((order, index) => {
      const y = this.layout.padding.top + 10 + index * (this.layout.rowHeight + 10);
      
      this.ctx.fillText(order.name, left - 15, y + this.layout.rowHeight / 2 + 4);
    });
  }

  private drawCurrentTimeIndicator(width: number, height: number, state: GameState): void {
    if (state.status !== 'running' && state.status !== 'paused') return;

    const { padding } = this.layout;
    const chartWidth = width - padding.left - padding.right;
    const totalTime = this.getMaxTimeline(state);
    const pixelsPerMinute = chartWidth / totalTime;

    const x = padding.left + state.currentTime * pixelsPerMinute;

    this.ctx.strokeStyle = '#10b981';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.moveTo(x, padding.top - this.layout.timelineHeight);
    this.ctx.lineTo(x, height - padding.bottom);
    this.ctx.stroke();

    this.ctx.fillStyle = '#10b981';
    this.ctx.beginPath();
    this.ctx.moveTo(x - 6, padding.top - this.layout.timelineHeight);
    this.ctx.lineTo(x + 6, padding.top - this.layout.timelineHeight);
    this.ctx.lineTo(x, padding.top - this.layout.timelineHeight - 10);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 12px JetBrains Mono, monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`${Math.floor(state.currentTime)}分`, x, padding.top - this.layout.timelineHeight - 15);
  }

  private drawMoldLegend(width: number, height: number): void {
    const legendY = height - 50;
    let legendX = this.layout.padding.left;

    this.ctx.fillStyle = '#e2e8f0';
    this.ctx.font = 'bold 12px Inter, sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.fillText('模具:', legendX, legendY);
    legendX += 50;

    this.level.molds.forEach(mold => {
      this.ctx.fillStyle = mold.color;
      this.ctx.fillRect(legendX, legendY - 12, 20, 16);

      this.ctx.fillStyle = '#e2e8f0';
      this.ctx.font = '11px Inter, sans-serif';
      this.ctx.textAlign = 'left';
      this.ctx.fillText(mold.name, legendX + 25, legendY);
      legendX += 80;
    });
  }

  private roundRect(x: number, y: number, width: number, height: number, radius: number): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  private adjustColor(color: string, factor: number): string {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    const newR = Math.min(255, Math.floor(r * factor));
    const newG = Math.min(255, Math.floor(g * factor));
    const newB = Math.min(255, Math.floor(b * factor));

    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
  }
}
