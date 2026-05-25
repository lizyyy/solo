import type { GameState, Position, AnimationState, Echo, Target } from '@/types/game';

interface RenderOptions {
  showTrajectories: boolean;
  showNoiseSources: boolean;
  highlightSelected: boolean;
}

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cellSize: number = 0;
  private offsetX: number = 0;
  private offsetY: number = 0;
  private playerPosition: Position = { x: 0, y: 0 };
  private animationFrame: number | null = null;
  private lastTime: number = 0;
  private noisePhase: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');
    this.ctx = ctx;
  }

  resize(width: number, height: number, gridSize: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    
    const maxCellWidth = (width - 40) / gridSize;
    const maxCellHeight = (height - 40) / gridSize;
    this.cellSize = Math.min(maxCellWidth, maxCellHeight, 50);
    
    this.offsetX = (width - gridSize * this.cellSize) / 2;
    this.offsetY = (height - gridSize * this.cellSize) / 2;
  }

  gridToScreen(gridX: number, gridY: number): { x: number; y: number } {
    return {
      x: this.offsetX + gridX * this.cellSize + this.cellSize / 2,
      y: this.offsetY + gridY * this.cellSize + this.cellSize / 2,
    };
  }

  screenToGrid(screenX: number, screenY: number): Position | null {
    const gridX = Math.floor((screenX - this.offsetX) / this.cellSize);
    const gridY = Math.floor((screenY - this.offsetY) / this.cellSize);
    return { x: gridX, y: gridY };
  }

  render(
    state: GameState,
    animationState: AnimationState,
    options: RenderOptions,
    currentTime: number
  ): void {
    const { ctx, canvas } = this;
    const { level, selectedPosition } = state;
    const gridSize = level.gridSize;

    ctx.fillStyle = '#0a1a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    this.noisePhase += 0.02;

    this.drawGrid(gridSize);
    this.drawPlayer();

    if (options.showNoiseSources) {
      for (const noise of state.noiseSources) {
        this.drawNoiseSource(noise.position, noise.intensity, currentTime);
      }
    }

    for (const echo of state.echoes) {
      this.drawEcho(echo, currentTime);
    }

    if (options.showTrajectories) {
      for (const target of state.targets) {
        if (target.trajectory.length > 1) {
          this.drawTrajectory(target);
        }
      }
    }

    for (const target of state.targets) {
      if (target.isDestroyed) {
        this.drawDestroyedTarget(target.position);
      }
    }

    if (selectedPosition && options.highlightSelected) {
      this.drawSelectedCell(selectedPosition);
    }

    if (animationState.scanAnimation?.active) {
      this.drawScanAnimation(animationState.scanAnimation, currentTime);
    }

    if (animationState.attackAnimation?.active) {
      this.drawAttackAnimation(animationState.attackAnimation, currentTime);
    }

    for (const explosion of animationState.explosions) {
      this.drawExplosion(explosion, currentTime);
    }

    this.drawCoordinates(gridSize);
  }

  private drawGrid(gridSize: number): void {
    const { ctx } = this;

    ctx.strokeStyle = '#1a3a1a';
    ctx.lineWidth = 1;

    for (let i = 0; i <= gridSize; i++) {
      const x = this.offsetX + i * this.cellSize;
      const y = this.offsetY + i * this.cellSize;

      ctx.beginPath();
      ctx.moveTo(x, this.offsetY);
      ctx.lineTo(x, this.offsetY + gridSize * this.cellSize);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(this.offsetX, y);
      ctx.lineTo(this.offsetX + gridSize * this.cellSize, y);
      ctx.stroke();
    }

    ctx.strokeStyle = '#39ff14';
    ctx.lineWidth = 2;
    ctx.strokeRect(
      this.offsetX,
      this.offsetY,
      gridSize * this.cellSize,
      gridSize * this.cellSize
    );
  }

  private drawPlayer(): void {
    const { ctx } = this;
    const screen = this.gridToScreen(0, 0);

    const gradient = ctx.createRadialGradient(
      screen.x, screen.y, 0,
      screen.x, screen.y, this.cellSize
    );
    gradient.addColorStop(0, 'rgba(0, 255, 255, 0.3)');
    gradient.addColorStop(1, 'rgba(0, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, this.cellSize, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#00ffff';
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, this.cellSize * 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, this.cellSize * 0.3, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#0a1a0a';
    ctx.font = `${this.cellSize * 0.3}px JetBrains Mono`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('P', screen.x, screen.y);
  }

  private drawEcho(echo: Echo, currentTime: number): void {
    const { ctx } = this;
    const screen = this.gridToScreen(echo.position.x, echo.position.y);

    const alpha = Math.min(1, echo.fadeTime / 5);
    const pulse = Math.sin(currentTime * 0.005 + echo.timestamp) * 0.2 + 0.8;

    const color = echo.isNoise ? '#ffb000' : '#39ff14';

    const gradient = ctx.createRadialGradient(
      screen.x, screen.y, 0,
      screen.x, screen.y, this.cellSize * 0.6
    );
    gradient.addColorStop(0, `${color}${Math.floor(alpha * pulse * 128).toString(16).padStart(2, '0')}`);
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, this.cellSize * 0.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `${color}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`;
    const radius = this.cellSize * 0.15 + (echo.signalStrength / 100) * this.cellSize * 0.15;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `${color}${Math.floor(alpha * 200).toString(16).padStart(2, '0')}`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = `${color}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`;
    ctx.font = `${this.cellSize * 0.22}px JetBrains Mono`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`${echo.signalStrength}%`, screen.x, screen.y + this.cellSize * 0.25);

    if (echo.isNoise) {
      ctx.fillStyle = `#ffb000${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`;
      ctx.font = `${this.cellSize * 0.3}px JetBrains Mono`;
      ctx.textBaseline = 'bottom';
      ctx.fillText('?', screen.x, screen.y - this.cellSize * 0.2);
    }
  }

  private drawNoiseSource(position: Position, intensity: number, currentTime: number): void {
    const { ctx } = this;
    const screen = this.gridToScreen(position.x, position.y);

    const wobble = Math.sin(currentTime * 0.003 + position.x) * 2;

    ctx.strokeStyle = `rgba(255, 176, 0, ${0.3 + intensity * 0.1})`;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);

    for (let i = 1; i <= intensity; i++) {
      const radius = this.cellSize * (0.4 + i * 0.2) + wobble;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(255, 176, 0, 0.5)';
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, this.cellSize * 0.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffb000';
    ctx.font = `${this.cellSize * 0.25}px JetBrains Mono`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', screen.x, screen.y);
  }

  private drawTrajectory(target: Target): void {
    const { ctx } = this;
    if (target.trajectory.length < 2) return;

    const color = target.isDestroyed ? '#ff3333' : target.avoidanceMode ? '#ffb000' : '#39ff14';
    ctx.strokeStyle = `${color}60`;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);

    ctx.beginPath();
    const first = this.gridToScreen(target.trajectory[0].x, target.trajectory[0].y);
    ctx.moveTo(first.x, first.y);

    for (let i = 1; i < target.trajectory.length; i++) {
      const p = this.gridToScreen(target.trajectory[i].x, target.trajectory[i].y);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    for (let i = 0; i < target.trajectory.length; i++) {
      const p = this.gridToScreen(target.trajectory[i].x, target.trajectory[i].y);
      ctx.fillStyle = `${color}40`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawDestroyedTarget(position: Position): void {
    const { ctx } = this;
    const screen = this.gridToScreen(position.x, position.y);

    ctx.fillStyle = 'rgba(255, 51, 51, 0.3)';
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, this.cellSize * 0.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ff3333';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(screen.x - this.cellSize * 0.3, screen.y - this.cellSize * 0.3);
    ctx.lineTo(screen.x + this.cellSize * 0.3, screen.y + this.cellSize * 0.3);
    ctx.moveTo(screen.x + this.cellSize * 0.3, screen.y - this.cellSize * 0.3);
    ctx.lineTo(screen.x - this.cellSize * 0.3, screen.y + this.cellSize * 0.3);
    ctx.stroke();
  }

  private drawSelectedCell(position: Position): void {
    const { ctx } = this;
    const x = this.offsetX + position.x * this.cellSize;
    const y = this.offsetY + position.y * this.cellSize;

    ctx.fillStyle = 'rgba(57, 255, 20, 0.2)';
    ctx.fillRect(x, y, this.cellSize, this.cellSize);

    ctx.strokeStyle = '#39ff14';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(x + 2, y + 2, this.cellSize - 4, this.cellSize - 4);
    ctx.setLineDash([]);

    const crossSize = this.cellSize * 0.2;
    const centerX = x + this.cellSize / 2;
    const centerY = y + this.cellSize / 2;

    ctx.strokeStyle = '#39ff14';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX - crossSize, centerY);
    ctx.lineTo(centerX + crossSize, centerY);
    ctx.moveTo(centerX, centerY - crossSize);
    ctx.lineTo(centerX, centerY + crossSize);
    ctx.stroke();
  }

  private drawScanAnimation(
    anim: NonNullable<AnimationState['scanAnimation']>,
    currentTime: number
  ): void {
    const { ctx } = this;
    const elapsed = (currentTime - anim.startTime) / anim.duration;
    const progress = Math.min(1, elapsed);

    const screen = this.gridToScreen(anim.center.x, anim.center.y);
    const currentRadius = progress * anim.maxRadius * this.cellSize;

    if (anim.type === 'fan') {
      const gradient = ctx.createRadialGradient(
        screen.x, screen.y, 0,
        screen.x, screen.y, currentRadius
      );
      gradient.addColorStop(0, 'rgba(57, 255, 20, 0.3)');
      gradient.addColorStop(1, 'rgba(57, 255, 20, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(screen.x, screen.y);
      ctx.arc(screen.x, screen.y, currentRadius, -Math.PI / 6, Math.PI / 6);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = `rgba(57, 255, 20, ${0.8 * (1 - progress)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(screen.x, screen.y);
      ctx.arc(screen.x, screen.y, currentRadius, -Math.PI / 6, Math.PI / 6);
      ctx.closePath();
      ctx.stroke();
    } else {
      const gradient = ctx.createRadialGradient(
        screen.x, screen.y, Math.max(0, currentRadius - this.cellSize),
        screen.x, screen.y, currentRadius
      );
      gradient.addColorStop(0, 'rgba(57, 255, 20, 0)');
      gradient.addColorStop(0.5, 'rgba(57, 255, 20, 0.4)');
      gradient.addColorStop(1, 'rgba(57, 255, 20, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, currentRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(57, 255, 20, ${0.8 * (1 - progress)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, currentRadius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawAttackAnimation(
    anim: NonNullable<AnimationState['attackAnimation']>,
    currentTime: number
  ): void {
    const { ctx } = this;
    const screen = this.gridToScreen(anim.position.x, anim.position.y);
    const elapsed = (currentTime - anim.startTime) / anim.duration;
    const progress = Math.min(1, elapsed);

    if (progress < 0.3) {
      const dropProgress = progress / 0.3;
      const dropY = screen.y - this.cellSize * 3 * (1 - dropProgress);
      
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.arc(screen.x, dropY, this.cellSize * 0.15, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#666';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(screen.x, dropY - this.cellSize * 0.15);
      ctx.lineTo(screen.x, dropY + this.cellSize * 0.15);
      ctx.moveTo(screen.x - this.cellSize * 0.15, dropY);
      ctx.lineTo(screen.x + this.cellSize * 0.15, dropY);
      ctx.stroke();
    } else {
      const explodeProgress = (progress - 0.3) / 0.7;
      const radius = explodeProgress * this.cellSize * 1.5;

      const color = anim.result === 'hit' ? '#ff3333' :
                    anim.result === 'near_miss' ? '#ffb000' : '#666';

      const gradient = ctx.createRadialGradient(
        screen.x, screen.y, 0,
        screen.x, screen.y, radius
      );
      gradient.addColorStop(0, `${color}ff`);
      gradient.addColorStop(0.5, `${color}80`);
      gradient.addColorStop(1, 'transparent');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `${color}${Math.floor((1 - explodeProgress) * 255).toString(16).padStart(2, '0')}`;
      ctx.lineWidth = 3;
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const innerR = radius * 0.3;
        const outerR = radius;
        ctx.beginPath();
        ctx.moveTo(
          screen.x + Math.cos(angle) * innerR,
          screen.y + Math.sin(angle) * innerR
        );
        ctx.lineTo(
          screen.x + Math.cos(angle) * outerR,
          screen.y + Math.sin(angle) * outerR
        );
        ctx.stroke();
      }

      if (anim.result === 'hit' && explodeProgress > 0.3) {
        ctx.fillStyle = `#ff3333${Math.floor((1 - explodeProgress) * 255).toString(16).padStart(2, '0')}`;
        ctx.font = `bold ${this.cellSize * 0.5}px VT323`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('HIT!', screen.x, screen.y);
      }
    }
  }

  private drawExplosion(
    explosion: AnimationState['explosions'][0],
    currentTime: number
  ): void {
    const { ctx } = this;
    const screen = this.gridToScreen(explosion.position.x, explosion.position.y);
    const elapsed = (currentTime - explosion.startTime) / explosion.duration;
    const progress = Math.min(1, elapsed);

    const radius = progress * explosion.radius * this.cellSize;
    const alpha = 1 - progress;

    const gradient = ctx.createRadialGradient(
      screen.x, screen.y, 0,
      screen.x, screen.y, radius
    );
    gradient.addColorStop(0, `rgba(255, 51, 51, ${alpha})`);
    gradient.addColorStop(0.5, `rgba(255, 176, 0, ${alpha * 0.6})`);
    gradient.addColorStop(1, 'transparent');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawCoordinates(gridSize: number): void {
    const { ctx } = this;
    ctx.fillStyle = '#39ff14';
    ctx.font = `${this.cellSize * 0.3}px JetBrains Mono`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < gridSize; i++) {
      const x = this.offsetX + i * this.cellSize + this.cellSize / 2;
      ctx.fillText(String(i), x, this.offsetY - this.cellSize * 0.3);
    }

    ctx.textAlign = 'right';
    for (let i = 0; i < gridSize; i++) {
      const y = this.offsetY + i * this.cellSize + this.cellSize / 2;
      ctx.fillText(String(i), this.offsetX - this.cellSize * 0.3, y);
    }
  }

  clear(): void {
    this.ctx.fillStyle = '#0a1a0a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  getCellSize(): number {
    return this.cellSize;
  }
}
