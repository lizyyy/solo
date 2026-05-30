import { TRACK_POINTS, SCALE, TRACK_WIDTH, TRACK_HEIGHT } from '../physics/constants';
import type { Position, PhysicsState, FrameData } from '../types';

export class TrackRenderer {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private offsetX: number;
  private offsetY: number;

  constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.offsetX = (width - TRACK_WIDTH * SCALE) / 2;
    this.offsetY = (height - TRACK_HEIGHT * SCALE) / 2;
  }

  clear() {
    this.ctx.fillStyle = '#0a1628';
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  drawGrid() {
    this.ctx.strokeStyle = 'rgba(0, 212, 255, 0.1)';
    this.ctx.lineWidth = 1;
    
    const gridSize = 20 * SCALE;
    for (let x = 0; x < this.width; x += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.height);
      this.ctx.stroke();
    }
    for (let y = 0; y < this.height; y += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.width, y);
      this.ctx.stroke();
    }
  }

  drawTrack() {
    this.ctx.save();
    this.ctx.translate(this.offsetX, this.offsetY);
    this.ctx.scale(SCALE, SCALE);

    this.ctx.strokeStyle = '#1a2a4a';
    this.ctx.lineWidth = 12;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    
    this.ctx.beginPath();
    TRACK_POINTS.forEach((point, i) => {
      if (i === 0) this.ctx.moveTo(point.x, point.y);
      else this.ctx.lineTo(point.x, point.y);
    });
    this.ctx.closePath();
    this.ctx.stroke();

    this.ctx.strokeStyle = '#2d3d5c';
    this.ctx.lineWidth = 10;
    this.ctx.beginPath();
    TRACK_POINTS.forEach((point, i) => {
      if (i === 0) this.ctx.moveTo(point.x, point.y);
      else this.ctx.lineTo(point.x, point.y);
    });
    this.ctx.closePath();
    this.ctx.stroke();

    this.ctx.strokeStyle = '#ff6b35';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([3, 3]);
    this.ctx.beginPath();
    TRACK_POINTS.forEach((point, i) => {
      if (i === 0) this.ctx.moveTo(point.x, point.y);
      else this.ctx.lineTo(point.x, point.y);
    });
    this.ctx.closePath();
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    const start = TRACK_POINTS[0];
    const next = TRACK_POINTS[1];
    const angle = Math.atan2(next.y - start.y, next.x - start.x);
    const perpX = -Math.sin(angle) * 6;
    const perpY = Math.cos(angle) * 6;
    
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(start.x + perpX, start.y + perpY);
    this.ctx.lineTo(start.x - perpX, start.y - perpY);
    this.ctx.stroke();

    this.ctx.fillStyle = '#00d4ff';
    this.ctx.font = '4px Orbitron';
    this.ctx.fillText('S1', TRACK_POINTS[0].x + 8, TRACK_POINTS[0].y - 8);
    this.ctx.fillText('S2', TRACK_POINTS[120].x + 8, TRACK_POINTS[120].y - 8);
    this.ctx.fillText('S3', TRACK_POINTS[240].x + 8, TRACK_POINTS[240].y - 8);

    this.ctx.restore();
  }

  drawCar(position: Position, heading: number, physics: PhysicsState) {
    this.ctx.save();
    this.ctx.translate(
      this.offsetX + position.x * SCALE,
      this.offsetY + position.y * SCALE
    );
    this.ctx.rotate((heading * Math.PI) / 180);
    this.ctx.scale(SCALE, SCALE);

    const gripRatio = Math.min(1, physics.grip / 1.2);
    const carColor = `hsl(${120 * gripRatio}, 80%, 50%)`;
    
    this.ctx.fillStyle = carColor;
    this.ctx.beginPath();
    this.ctx.moveTo(3, 0);
    this.ctx.lineTo(-2, -1.5);
    this.ctx.lineTo(-1.5, 0);
    this.ctx.lineTo(-2, 1.5);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.fillStyle = '#ff4757';
    this.ctx.fillRect(-1.8, -1.2, 0.3, 0.6);
    this.ctx.fillRect(-1.8, 0.6, 0.3, 0.6);

    this.ctx.fillStyle = '#00d4ff';
    this.ctx.fillRect(2.2, -0.8, 0.5, 0.4);
    this.ctx.fillRect(2.2, 0.4, 0.5, 0.4);

    this.ctx.restore();
  }

  drawVelocityVector(position: Position, heading: number, speed: number) {
    if (speed < 1) return;

    this.ctx.save();
    this.ctx.translate(
      this.offsetX + position.x * SCALE,
      this.offsetY + position.y * SCALE
    );
    this.ctx.rotate((heading * Math.PI) / 180);

    const vectorLength = Math.min(speed * 0.5 * SCALE, 50);
    
    this.ctx.strokeStyle = '#00d4ff';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(0, 0);
    this.ctx.lineTo(vectorLength, 0);
    this.ctx.stroke();

    this.ctx.fillStyle = '#00d4ff';
    this.ctx.beginPath();
    this.ctx.moveTo(vectorLength, 0);
    this.ctx.lineTo(vectorLength - 6, -4);
    this.ctx.lineTo(vectorLength - 6, 4);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.restore();
  }

  drawDownForceIndicator(position: Position, downForce: number) {
    const indicatorSize = Math.min(Math.abs(downForce) / 100 * SCALE, 30);
    
    this.ctx.save();
    this.ctx.translate(
      this.offsetX + position.x * SCALE,
      this.offsetY + position.y * SCALE + 15
    );

    if (downForce > 0) {
      this.ctx.fillStyle = 'rgba(0, 212, 255, 0.6)';
      this.ctx.beginPath();
      this.ctx.moveTo(0, indicatorSize);
      this.ctx.lineTo(-5, 0);
      this.ctx.lineTo(5, 0);
      this.ctx.closePath();
      this.ctx.fill();
    } else {
      this.ctx.fillStyle = 'rgba(255, 107, 53, 0.6)';
      this.ctx.beginPath();
      this.ctx.moveTo(0, -indicatorSize);
      this.ctx.lineTo(-5, 0);
      this.ctx.lineTo(5, 0);
      this.ctx.closePath();
      this.ctx.fill();
    }

    this.ctx.restore();
  }

  drawTrail(frames: FrameData[], maxFrames: number = 60) {
    if (frames.length < 2) return;
    
    const recentFrames = frames.slice(-maxFrames);
    
    this.ctx.save();
    this.ctx.translate(this.offsetX, this.offsetY);
    this.ctx.scale(SCALE, SCALE);

    for (let i = 1; i < recentFrames.length; i++) {
      const prev = recentFrames[i - 1];
      const curr = recentFrames[i];
      const alpha = i / recentFrames.length * 0.5;
      
      this.ctx.strokeStyle = `rgba(255, 107, 53, ${alpha})`;
      this.ctx.lineWidth = 0.5;
      this.ctx.beginPath();
      this.ctx.moveTo(prev.position.x, prev.position.y);
      this.ctx.lineTo(curr.position.x, curr.position.y);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  drawSpeedHeatmap(frames: FrameData[]) {
    if (frames.length < 10) return;

    this.ctx.save();
    this.ctx.translate(this.offsetX, this.offsetY);
    this.ctx.scale(SCALE, SCALE);

    frames.forEach(frame => {
      const speedRatio = Math.min(frame.physics.speed / 40, 1);
      const hue = 240 - speedRatio * 240;
      
      this.ctx.fillStyle = `hsla(${hue}, 80%, 50%, 0.1)`;
      this.ctx.beginPath();
      this.ctx.arc(frame.position.x, frame.position.y, 2, 0, Math.PI * 2);
      this.ctx.fill();
    });

    this.ctx.restore();
  }

  drawSectorMarkers() {
    this.ctx.save();
    this.ctx.translate(this.offsetX, this.offsetY);
    this.ctx.scale(SCALE, SCALE);

    const sectorPoints = [0, 120, 240];
    const colors = ['#00d4ff', '#ff6b35', '#4ade80'];
    
    sectorPoints.forEach((idx, i) => {
      const point = TRACK_POINTS[idx];
      this.ctx.fillStyle = colors[i];
      this.ctx.beginPath();
      this.ctx.arc(point.x, point.y, 1.5, 0, Math.PI * 2);
      this.ctx.fill();
    });

    this.ctx.restore();
  }

  render(
    position: Position,
    heading: number,
    physics: PhysicsState,
    frames: FrameData[],
    showHeatmap: boolean = false
  ) {
    this.clear();
    this.drawGrid();
    
    if (showHeatmap && frames.length > 10) {
      this.drawSpeedHeatmap(frames);
    }
    
    this.drawTrack();
    this.drawSectorMarkers();
    this.drawTrail(frames);
    this.drawCar(position, heading, physics);
    this.drawVelocityVector(position, heading, physics.speed);
    this.drawDownForceIndicator(position, physics.downForce);
  }
}

export const createRenderer = (canvas: HTMLCanvasElement) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D context');
  
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  
  return new TrackRenderer(ctx, rect.width, rect.height);
};
