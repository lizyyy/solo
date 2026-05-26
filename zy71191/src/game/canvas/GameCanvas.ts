import type { GameState, Booth, Crew, Material } from '@/types/game';
import { TASK_CONFIG } from '@/types/game';

const COLORS = {
  background: '#0f172a',
  grid: '#1e293b',
  boothBase: '#334155',
  boothHighlight: '#475569',
  crew: '#38bdf8',
  crewIdle: '#64748b',
  taskLine: '#94a3b8',
  materialPending: '#d69e2e',
  materialDelivered: '#38a169',
  inspectionPassed: '#38a169',
  inspectionFailed: '#e53e3e',
  inspectionPending: '#4299e1',
  utilities: '#4299e1',
  structure: '#805ad5',
  fire: '#e53e3e',
};

export class GameCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private state: GameState | null = null;
  private animationId: number | null = null;
  private hoveredBoothId: string | null = null;
  private selectedBoothId: string | null = null;
  private onBoothClick: ((boothId: string) => void) | null = null;
  private onBoothHover: ((boothId: string | null) => void) | null = null;
  private offsetX: number = 0;
  private offsetY: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.setupEventListeners();
  }

  private setupEventListeners() {
    this.canvas.addEventListener('click', (e) => this.handleClick(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseleave', () => this.handleMouseLeave());
  }

  private getMousePos(e: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX - this.offsetX,
      y: (e.clientY - rect.top) * scaleY - this.offsetY,
    };
  }

  private handleClick(e: MouseEvent) {
    if (!this.state || !this.onBoothClick) return;
    const pos = this.getMousePos(e);
    const booth = this.findBoothAt(pos.x, pos.y);
    if (booth) {
      this.selectedBoothId = booth.id;
      this.onBoothClick(booth.id);
    }
  }

  private handleMouseMove(e: MouseEvent) {
    if (!this.state || !this.onBoothHover) return;
    const pos = this.getMousePos(e);
    const booth = this.findBoothAt(pos.x, pos.y);
    this.hoveredBoothId = booth?.id ?? null;
    this.onBoothHover(this.hoveredBoothId);
  }

  private handleMouseLeave() {
    this.hoveredBoothId = null;
    if (this.onBoothHover) {
      this.onBoothHover(null);
    }
  }

  private findBoothAt(x: number, y: number): Booth | null {
    if (!this.state) return null;
    for (const booth of this.state.booths) {
      if (
        x >= booth.position.x &&
        x <= booth.position.x + booth.size.w &&
        y >= booth.position.y &&
        y <= booth.position.y + booth.size.h
      ) {
        return booth;
      }
    }
    return null;
  }

  setState(state: GameState) {
    this.state = state;
  }

  setOnBoothClick(cb: (boothId: string) => void) {
    this.onBoothClick = cb;
  }

  setOnBoothHover(cb: (boothId: string | null) => void) {
    this.onBoothHover = cb;
  }

  setSelectedBooth(boothId: string | null) {
    this.selectedBoothId = boothId;
  }

  start() {
    this.resize();
    this.render();
  }

  stop() {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  resize() {
    const container = this.canvas.parentElement;
    if (!container) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    this.canvas.width = width;
    this.canvas.height = height;
    this.offsetX = width / 2;
    this.offsetY = height / 2;
  }

  private render() {
    if (!this.state) {
      this.animationId = requestAnimationFrame(() => this.render());
      return;
    }

    const ctx = this.ctx;
    ctx.save();
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.translate(this.offsetX, this.offsetY);

    this.drawGrid(ctx);
    this.drawMaterials(ctx);
    this.drawBooths(ctx);
    this.drawCrews(ctx);
    this.drawTaskConnections(ctx);
    this.drawHUD(ctx);

    ctx.restore();
    this.animationId = requestAnimationFrame(() => this.render());
  }

  private drawGrid(ctx: CanvasRenderingContext2D) {
    const gridSize = 40;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const halfW = width / 2;
    const halfH = height / 2;

    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;

    for (let x = -halfW; x <= halfW; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, -halfH);
      ctx.lineTo(x, halfH);
      ctx.stroke();
    }
    for (let y = -halfH; y <= halfH; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(-halfW, y);
      ctx.lineTo(halfW, y);
      ctx.stroke();
    }

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.strokeRect(-halfW + 20, -halfH + 20, width - 40, height - 40);
  }

  private drawBooths(ctx: CanvasRenderingContext2D) {
    if (!this.state) return;

    for (const booth of this.state.booths) {
      const isHovered = this.hoveredBoothId === booth.id;
      const isSelected = this.selectedBoothId === booth.id;

      let borderColor = COLORS.boothBase;
      if (isHovered) borderColor = '#60a5fa';
      if (isSelected) borderColor = '#fbbf24';

      ctx.fillStyle = isHovered ? '#1e3a5f' : '#1a2744';
      ctx.fillRect(booth.position.x, booth.position.y, booth.size.w, booth.size.h);

      ctx.strokeStyle = borderColor;
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.strokeRect(booth.position.x, booth.position.y, booth.size.w, booth.size.h);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = '12px "SF Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(booth.name, booth.position.x + booth.size.w / 2, booth.position.y + 18);

      const barY = booth.position.y + 28;
      const barH = 8;
      const barW = booth.size.w - 20;
      const barX = booth.position.x + 10;

      const progresses = [
        { label: '水', value: booth.utilitiesProgress, color: COLORS.utilities, done: booth.utilitiesDone },
        { label: '架', value: booth.structureProgress, color: COLORS.structure, done: booth.structureDone },
        { label: '消', value: booth.fireSafetyProgress, color: COLORS.fire, done: booth.fireSafetyDone },
      ];

      progresses.forEach((p, i) => {
        const y = barY + i * (barH + 6);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(barX, y, barW, barH);

        ctx.fillStyle = p.done ? COLORS.inspectionPassed : p.color;
        ctx.fillRect(barX, y, (barW * p.value) / 100, barH);

        ctx.fillStyle = p.done ? '#38a169' : '#94a3b8';
        ctx.font = '10px "SF Mono", monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`${p.label} ${Math.round(p.value)}%`, barX + barW, y + barH - 1);
      });

      const allDone = booth.utilitiesDone && booth.structureDone && booth.fireSafetyDone;
      if (allDone) {
        ctx.fillStyle = COLORS.inspectionPassed;
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('✓', booth.position.x + booth.size.w - 8, booth.position.y + booth.size.h - 8);
      }
    }
  }

  private drawCrews(ctx: CanvasRenderingContext2D) {
    if (!this.state) return;

    this.state.crews.forEach((crew, index) => {
      const baseY = -this.canvas.height / 2 + 60;
      const spacing = 80;
      const x = -this.canvas.width / 2 + 60 + index * spacing;
      const y = baseY;

      const isWorking = crew.status === 'working';
      const color = isWorking ? COLORS.crew : COLORS.crewIdle;

      ctx.beginPath();
      ctx.arc(x, y, 20, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(crew.name.slice(-1), x, y + 4);

      const labelY = y + 32;
      ctx.fillStyle = isWorking ? '#38bdf8' : '#94a3b8';
      ctx.font = '10px "SF Mono", monospace';
      ctx.fillText(crew.status === 'idle' ? '空闲' : crew.status === 'working' ? '施工中' : '移动中', x, labelY);
      ctx.fillText(`效率:${crew.efficiency.toFixed(1)}`, x, labelY + 12);
    });
  }

  private drawTaskConnections(ctx: CanvasRenderingContext2D) {
    if (!this.state) return;

    for (const task of this.state.tasks) {
      if (task.status !== 'in_progress') continue;

      const crew = this.state.crews.find((c) => c.id === task.assignedCrew);
      const booth = this.state.booths.find((b) => b.id === task.boothId);

      if (!crew || !booth) continue;

      const crewIndex = this.state.crews.findIndex((c) => c.id === crew.id);
      const baseY = -this.canvas.height / 2 + 60;
      const spacing = 80;
      const crewX = -this.canvas.width / 2 + 60 + crewIndex * spacing;
      const crewY = baseY;

      const boothCenterX = booth.position.x + booth.size.w / 2;
      const boothCenterY = booth.position.y + booth.size.h / 2;

      const color = TASK_CONFIG[task.type].color;

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);
      ctx.beginPath();
      ctx.moveTo(crewX, crewY);
      ctx.lineTo(boothCenterX, boothCenterY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(boothCenterX, boothCenterY, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawMaterials(ctx: CanvasRenderingContext2D) {
    if (!this.state) return;

    const materialY = this.canvas.height / 2 - 50;

    const boothMaterials = new Map<string, Material[]>();
    for (const m of this.state.materials) {
      for (const boothId of m.requiredFor) {
        if (!boothMaterials.has(boothId)) boothMaterials.set(boothId, []);
        boothMaterials.get(boothId)!.push(m);
      }
    }

    const boothIds = Array.from(boothMaterials.keys());
    boothIds.forEach((boothId, index) => {
      const materials = boothMaterials.get(boothId)!;
      const startX = -200 + index * 200;

      ctx.fillStyle = '#1e293b';
      ctx.fillRect(startX, materialY - 10, 180, 40);
      ctx.strokeStyle = '#334155';
      ctx.strokeRect(startX, materialY - 10, 180, 40);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px "SF Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`展位${boothId.replace('booth-', '')}`, startX + 5, materialY + 2);

      let dotX = startX + 60;
      for (const m of materials) {
        const isDelivered = m.delivered;
        const isLate = m.actualDeliveryTurn !== null && m.actualDeliveryTurn > m.deliveryTurn;

        ctx.fillStyle = isDelivered
          ? COLORS.materialDelivered
          : isLate || (this.state!.currentTurn > m.deliveryTurn)
          ? COLORS.materialPending
          : '#64748b';
        ctx.beginPath();
        ctx.arc(dotX, materialY + 16, 5, 0, Math.PI * 2);
        ctx.fill();

        dotX += 20;
      }
    });
  }

  private drawHUD(ctx: CanvasRenderingContext2D) {
    if (!this.state) return;

    const x = -this.canvas.width / 2 + 20;
    const y = -this.canvas.height / 2 + 20;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(x, y, 200, 60);
    ctx.strokeStyle = '#334155';
    ctx.strokeRect(x, y, 200, 60);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 14px "SF Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`回合 ${this.state.currentTurn} / ${this.state.maxTurns}`, x + 10, y + 22);

    const progress = (this.state.currentTurn / this.state.maxTurns) * 100;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(x + 10, y + 32, 180, 8);
    ctx.fillStyle = progress > 80 ? '#e53e3e' : progress > 60 ? '#d69e2e' : '#38a169';
    ctx.fillRect(x + 10, y + 32, (180 * progress) / 100, 8);

    const inspectionX = this.canvas.width / 2 - 180;
    const inspectionY = -this.canvas.height / 2 + 20;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(inspectionX, inspectionY, 160, 90);
    ctx.strokeStyle = '#334155';
    ctx.strokeRect(inspectionX, inspectionY, 160, 90);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px "SF Mono", monospace';
    ctx.textAlign = 'left';

    const inspections = [
      { name: '水电', insp: this.state.inspections[0] },
      { name: '展架', insp: this.state.inspections[1] },
      { name: '消防', insp: this.state.inspections[2] },
    ];

    inspections.forEach((item, i) => {
      const iy = inspectionY + 18 + i * 22;
      let statusText = '🔒 锁定';
      let textColor = '#64748b';

      if (item.insp.passed) {
        statusText = '✓ 通过';
        textColor = COLORS.inspectionPassed;
      } else if (item.insp.unlocked && !item.insp.requested) {
        statusText = '🔓 可申请';
        textColor = COLORS.inspectionPending;
      } else if (item.insp.requested && !item.insp.passed) {
        statusText = '⏳ 审核中';
        textColor = COLORS.materialPending;
      } else if (item.insp.unlocked) {
        statusText = '❌ 未通过';
        textColor = COLORS.inspectionFailed;
      }

      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(item.name, inspectionX + 10, iy);
      ctx.fillStyle = textColor;
      ctx.fillText(statusText, inspectionX + 80, iy);
    });
  }

  destroy() {
    this.stop();
    this.canvas.removeEventListener('click', (e) => this.handleClick(e));
    this.canvas.removeEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.removeEventListener('mouseleave', () => this.handleMouseLeave());
  }
}
