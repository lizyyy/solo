import type { GameState, Hazard, Player, GameMap } from '../types';
import { HAZARD_DESCRIPTIONS } from '../data/levels';

export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private width = 800;
  private height = 600;

  private colors = {
    floor: '#374151',
    wall: '#1f2937',
    fireExit: '#10b981',
    shelf: '#4b5563',
    shelfHighlight: '#6b7280',
    player: '#f59e0b',
    playerHighlight: '#fbbf24',
    hazard: '#ef4444',
    hazardHalo: '#fca5a5',
    normalItem: '#3b82f6',
    normalItemHalo: '#93c5fd',
    grid: '#1f2937',
    text: '#f3f4f6',
    nearIndicator: '#fbbf24'
  };

  init(canvas: HTMLCanvasElement, width: number, height: number): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = width;
    this.height = height;
    canvas.width = width;
    canvas.height = height;
  }

  render(state: GameState): void {
    if (!this.ctx || !this.canvas) return;

    this.ctx.clearRect(0, 0, this.width, this.height);

    this.drawGrid(state.map);
    this.drawShelves(state.map);
    this.drawHazards(state.hazards);
    this.drawPlayer(state.player);
    this.drawNearIndicator(state.player, state.nearHazard);
  }

  private drawGrid(map: GameMap): void {
    if (!this.ctx) return;

    for (const tile of map.tiles) {
      const x = tile.x * map.tileSize;
      const y = tile.y * map.tileSize;

      switch (tile.type) {
        case 'floor':
          this.ctx.fillStyle = this.colors.floor;
          break;
        case 'wall':
          this.ctx.fillStyle = this.colors.wall;
          break;
        case 'fire_exit':
          this.ctx.fillStyle = this.colors.fireExit;
          break;
        default:
          this.ctx.fillStyle = this.colors.floor;
      }

      this.ctx.fillRect(x, y, map.tileSize, map.tileSize);

      this.ctx.strokeStyle = this.colors.grid;
      this.ctx.lineWidth = 0.5;
      this.ctx.strokeRect(x, y, map.tileSize, map.tileSize);

      if (tile.type === 'fire_exit') {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 14px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('安全出口', x + map.tileSize / 2, y + map.tileSize / 2 + 5);
      }
    }
  }

  private drawShelves(map: GameMap): void {
    if (!this.ctx) return;

    for (const shelf of map.shelves) {
      const gradient = this.ctx.createLinearGradient(shelf.x, shelf.y, shelf.x + shelf.width, shelf.y + shelf.height);
      gradient.addColorStop(0, this.colors.shelf);
      gradient.addColorStop(0.5, this.colors.shelfHighlight);
      gradient.addColorStop(1, this.colors.shelf);

      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(shelf.x, shelf.y, shelf.width, shelf.height);

      this.ctx.strokeStyle = '#374151';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(shelf.x, shelf.y, shelf.width, shelf.height);

      this.ctx.fillStyle = '#6b7280';
      const barHeight = 4;
      this.ctx.fillRect(shelf.x + 4, shelf.y + shelf.height / 3 - barHeight / 2, shelf.width - 8, barHeight);
      this.ctx.fillRect(shelf.x + 4, shelf.y + (shelf.height * 2) / 3 - barHeight / 2, shelf.width - 8, barHeight);
    }
  }

  private drawHazards(hazards: Hazard[]): void {
    if (!this.ctx) return;

    for (const hazard of hazards) {
      const centerX = hazard.x + hazard.width / 2;
      const centerY = hazard.y + hazard.height / 2;

      if (hazard.marked) {
        this.ctx.fillStyle = hazard.markCorrect ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)';
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, 25, 0, Math.PI * 2);
        this.ctx.fill();
      }

      this.drawHazardIcon(hazard, centerX, centerY);

      this.ctx.fillStyle = '#9ca3af';
      this.ctx.font = '10px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(hazard.description, centerX, centerY + hazard.height / 2 + 12);
    }
  }

  private drawHazardIcon(hazard: Hazard, centerX: number, centerY: number): void {
    if (!this.ctx) return;

    const iconSize = 12;

    switch (hazard.type) {
      case 'blocked_path':
      case 'empty_path':
        this.ctx.strokeStyle = hazard.isHazard ? this.colors.hazard : '#6b7280';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(centerX - iconSize, centerY - iconSize);
        this.ctx.lineTo(centerX + iconSize, centerY + iconSize);
        this.ctx.moveTo(centerX + iconSize, centerY - iconSize);
        this.ctx.lineTo(centerX - iconSize, centerY + iconSize);
        this.ctx.stroke();
        break;

      case 'expired_extinguisher':
      case 'normal_extinguisher':
        this.ctx.fillStyle = hazard.isHazard ? this.colors.hazard : this.colors.normalItem;
        this.ctx.fillRect(centerX - 8, centerY - 10, 16, 20);
        this.ctx.fillStyle = '#374151';
        this.ctx.fillRect(centerX - 4, centerY - 14, 8, 4);
        this.ctx.beginPath();
        this.ctx.arc(centerX + 6, centerY - 6, 4, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 8px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('MF', centerX, centerY + 4);
        break;

      case 'illegal_charging':
      case 'normal_charging':
        this.ctx.fillStyle = hazard.isHazard ? this.colors.hazard : this.colors.normalItem;
        this.ctx.fillRect(centerX - 10, centerY - 6, 20, 12);
        this.ctx.fillStyle = '#fbbf24';
        this.ctx.beginPath();
        this.ctx.moveTo(centerX - 8, centerY);
        this.ctx.lineTo(centerX - 4, centerY - 4);
        this.ctx.lineTo(centerX, centerY);
        this.ctx.lineTo(centerX - 4, centerY + 4);
        this.ctx.closePath();
        this.ctx.fill();
        if (hazard.type === 'illegal_charging') {
          this.ctx.strokeStyle = '#ef4444';
          this.ctx.lineWidth = 2;
          this.ctx.beginPath();
          this.ctx.moveTo(centerX - 12, centerY - 12);
          this.ctx.lineTo(centerX + 12, centerY + 12);
          this.ctx.stroke();
        }
        break;
    }

    if (hazard.marked) {
      this.ctx.fillStyle = hazard.markCorrect ? '#22c55e' : '#ef4444';
      this.ctx.font = 'bold 16px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(hazard.markCorrect ? '✓' : '✗', centerX, centerY - 20);
    }
  }

  private drawPlayer(player: Player): void {
    if (!this.ctx) return;

    const x = player.x;
    const y = player.y;

    this.ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
    this.ctx.beginPath();
    this.ctx.arc(x, y, 20, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = this.colors.player;
    this.ctx.beginPath();
    this.ctx.arc(x, y, 12, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = this.colors.playerHighlight;
    this.ctx.beginPath();
    this.ctx.arc(x - 3, y - 3, 4, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = '#1f2937';
    this.ctx.font = 'bold 12px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('👮', x, y + 4);
  }

  private drawNearIndicator(player: Player, nearHazard: Hazard | null): void {
    if (!this.ctx || !nearHazard) return;

    const centerX = nearHazard.x + nearHazard.width / 2;
    const centerY = nearHazard.y + nearHazard.height / 2;
    const time = Date.now() / 200;
    const pulseSize = 25 + Math.sin(time) * 5;

    this.ctx.strokeStyle = this.colors.nearIndicator;
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, pulseSize, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    this.ctx.fillStyle = this.colors.nearIndicator;
    this.ctx.font = 'bold 11px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('[空格]标记', centerX, centerY - 30);
  }

  clear(): void {
    if (!this.ctx || !this.canvas) return;
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    if (this.canvas) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }
}
