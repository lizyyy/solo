import { TrackElement, MagneticField, TrajectoryPoint, Vector2D, PARTICLE_RADIUS, TRACK_WIDTH, MagneticDirection } from '../../types';

export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private gridSize: number;

  constructor(canvas: HTMLCanvasElement, gridSize: number = 40) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');
    this.ctx = ctx;
    this.gridSize = gridSize;
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawGrid(): void {
    const { width, height } = this.canvas;
    this.ctx.strokeStyle = 'rgba(74, 85, 104, 0.2)';
    this.ctx.lineWidth = 1;

    for (let x = 0; x <= width; x += this.gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, height);
      this.ctx.stroke();
    }

    for (let y = 0; y <= height; y += this.gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(width, y);
      this.ctx.stroke();
    }

    this.ctx.strokeStyle = 'rgba(0, 212, 255, 0.3)';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(0, 0, width, height);
  }

  drawTrackElement(element: TrackElement, isSelected: boolean = false, isHighlighted: boolean = false): void {
    const { x, y, width, height, rotation, type } = element;
    const centerX = x + width / 2;
    const centerY = y + height / 2;

    this.ctx.save();
    this.ctx.translate(centerX, centerY);
    this.ctx.rotate((rotation * Math.PI) / 180);
    this.ctx.translate(-width / 2, -height / 2);

    if (isSelected) {
      this.ctx.shadowColor = '#39FF14';
      this.ctx.shadowBlur = 15;
    } else if (isHighlighted) {
      this.ctx.shadowColor = '#00D4FF';
      this.ctx.shadowBlur = 10;
    }

    this.ctx.lineWidth = TRACK_WIDTH;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    this.ctx.strokeStyle = 'rgba(74, 85, 104, 0.8)';
    this.ctx.beginPath();

    switch (type) {
      case 'straight':
        this.ctx.moveTo(0, height / 2);
        this.ctx.lineTo(width, height / 2);
        break;
      case 'curve-left':
        this.ctx.arc(width, 0, Math.min(width, height), Math.PI / 2, Math.PI, false);
        break;
      case 'curve-right':
        this.ctx.arc(0, 0, Math.min(width, height), 0, Math.PI / 2, false);
        break;
      case 'start':
        this.ctx.strokeStyle = 'rgba(57, 255, 20, 0.8)';
        this.ctx.moveTo(0, height / 2);
        this.ctx.lineTo(width, height / 2);
        this.ctx.stroke();
        this.ctx.fillStyle = '#39FF14';
        this.ctx.beginPath();
        this.ctx.arc(10, height / 2, 8, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
        return;
      case 'end':
        this.ctx.strokeStyle = 'rgba(255, 77, 109, 0.8)';
        this.ctx.moveTo(0, height / 2);
        this.ctx.lineTo(width, height / 2);
        this.ctx.stroke();
        this.ctx.fillStyle = '#FF4D6D';
        this.ctx.beginPath();
        this.ctx.arc(width - 10, height / 2, 8, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
        return;
    }

    this.ctx.stroke();

    this.ctx.strokeStyle = isSelected ? '#39FF14' : isHighlighted ? '#00D4FF' : 'rgba(0, 212, 255, 0.6)';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    this.ctx.restore();
  }

  drawMagneticField(field: MagneticField, isSelected: boolean = false): void {
    const { x, y, width, height, strength, direction } = field;

    this.ctx.save();

    const gradient = this.ctx.createLinearGradient(x, y, x + width, y + height);
    const alpha = Math.min(0.3, strength * 0.05);

    switch (direction) {
      case 'into':
        gradient.addColorStop(0, `rgba(157, 78, 221, ${alpha})`);
        gradient.addColorStop(1, `rgba(123, 44, 191, ${alpha})`);
        break;
      case 'outof':
        gradient.addColorStop(0, `rgba(0, 212, 255, ${alpha})`);
        gradient.addColorStop(1, `rgba(0, 245, 255, ${alpha})`);
        break;
      default:
        gradient.addColorStop(0, `rgba(255, 140, 66, ${alpha})`);
        gradient.addColorStop(1, `rgba(255, 77, 109, ${alpha})`);
    }

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(x, y, width, height);

    this.ctx.strokeStyle = isSelected ? '#39FF14' : '#9D4EDD';
    this.ctx.lineWidth = isSelected ? 3 : 2;
    if (isSelected) {
      this.ctx.shadowColor = '#39FF14';
      this.ctx.shadowBlur = 10;
    }
    this.ctx.strokeRect(x, y, width, height);

    this.ctx.fillStyle = direction === 'into' ? '#9D4EDD' : '#00D4FF';
    const symbolSize = 12;
    const spacing = 30;

    for (let sy = y + spacing; sy < y + height - spacing / 2; sy += spacing) {
      for (let sx = x + spacing; sx < x + width - spacing / 2; sx += spacing) {
        this.drawMagneticSymbol(sx, sy, symbolSize, direction);
      }
    }

    this.ctx.restore();
  }

  private drawMagneticSymbol(x: number, y: number, size: number, direction: MagneticDirection): void {
    this.ctx.save();
    this.ctx.translate(x, y);

    switch (direction) {
      case 'into':
        this.ctx.beginPath();
        this.ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
        this.ctx.strokeStyle = '#9D4EDD';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.moveTo(-size / 4, -size / 4);
        this.ctx.lineTo(size / 4, size / 4);
        this.ctx.moveTo(size / 4, -size / 4);
        this.ctx.lineTo(-size / 4, size / 4);
        this.ctx.stroke();
        break;
      case 'outof':
        this.ctx.beginPath();
        this.ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
        this.ctx.fillStyle = '#00D4FF';
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.arc(0, 0, size / 4, 0, Math.PI * 2);
        this.ctx.fillStyle = '#0A1628';
        this.ctx.fill();
        break;
      case 'left':
        this.ctx.beginPath();
        this.ctx.moveTo(size / 2, 0);
        this.ctx.lineTo(-size / 4, -size / 3);
        this.ctx.lineTo(-size / 4, size / 3);
        this.ctx.closePath();
        this.ctx.fillStyle = '#FF8C42';
        this.ctx.fill();
        break;
      case 'right':
        this.ctx.beginPath();
        this.ctx.moveTo(-size / 2, 0);
        this.ctx.lineTo(size / 4, -size / 3);
        this.ctx.lineTo(size / 4, size / 3);
        this.ctx.closePath();
        this.ctx.fillStyle = '#FF8C42';
        this.ctx.fill();
        break;
      case 'up':
        this.ctx.beginPath();
        this.ctx.moveTo(0, size / 2);
        this.ctx.lineTo(-size / 3, -size / 4);
        this.ctx.lineTo(size / 3, -size / 4);
        this.ctx.closePath();
        this.ctx.fillStyle = '#FF8C42';
        this.ctx.fill();
        break;
      case 'down':
        this.ctx.beginPath();
        this.ctx.moveTo(0, -size / 2);
        this.ctx.lineTo(-size / 3, size / 4);
        this.ctx.lineTo(size / 3, size / 4);
        this.ctx.closePath();
        this.ctx.fillStyle = '#FF8C42';
        this.ctx.fill();
        break;
    }

    this.ctx.restore();
  }

  drawTrajectory(trajectory: TrajectoryPoint[], showVectors: boolean = true): void {
    if (trajectory.length < 2) return;

    this.ctx.save();

    for (let i = 1; i < trajectory.length; i++) {
      const prev = trajectory[i - 1];
      const curr = trajectory[i];

      const alpha = i / trajectory.length;
      this.ctx.strokeStyle = `rgba(0, 212, 255, ${0.3 + alpha * 0.7})`;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(prev.position.x, prev.position.y);
      this.ctx.lineTo(curr.position.x, curr.position.y);
      this.ctx.stroke();

      if (i % 10 === 0 && showVectors) {
        this.drawVector(curr.position, curr.velocity, '#39FF14', 0.0005);
        this.drawVector(curr.position, curr.force, '#FF4D6D', 1e15);
      }
    }

    if (trajectory.length > 0) {
      const lastPoint = trajectory[trajectory.length - 1];
      this.ctx.shadowColor = '#00D4FF';
      this.ctx.shadowBlur = 15;
      const gradient = this.ctx.createRadialGradient(
        lastPoint.position.x, lastPoint.position.y, 0,
        lastPoint.position.x, lastPoint.position.y, PARTICLE_RADIUS * 2
      );
      gradient.addColorStop(0, '#00F5FF');
      gradient.addColorStop(0.5, '#00D4FF');
      gradient.addColorStop(1, 'rgba(0, 212, 255, 0)');
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(lastPoint.position.x, lastPoint.position.y, PARTICLE_RADIUS * 2, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.beginPath();
      this.ctx.arc(lastPoint.position.x, lastPoint.position.y, PARTICLE_RADIUS, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.restore();
  }

  drawVector(origin: Vector2D, vector: Vector2D, color: string, scale: number): void {
    const endX = origin.x + vector.x * scale;
    const endY = origin.y + vector.y * scale;

    this.ctx.save();
    this.ctx.strokeStyle = color;
    this.ctx.fillStyle = color;
    this.ctx.lineWidth = 2;

    this.ctx.beginPath();
    this.ctx.moveTo(origin.x, origin.y);
    this.ctx.lineTo(endX, endY);
    this.ctx.stroke();

    const angle = Math.atan2(endY - origin.y, endX - origin.x);
    const headLength = 8;

    this.ctx.beginPath();
    this.ctx.moveTo(endX, endY);
    this.ctx.lineTo(
      endX - headLength * Math.cos(angle - Math.PI / 6),
      endY - headLength * Math.sin(angle - Math.PI / 6)
    );
    this.ctx.lineTo(
      endX - headLength * Math.cos(angle + Math.PI / 6),
      endY - headLength * Math.sin(angle + Math.PI / 6)
    );
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.restore();
  }

  drawCollisionPoint(point: Vector2D): void {
    this.ctx.save();

    this.ctx.strokeStyle = '#FF4D6D';
    this.ctx.lineWidth = 3;
    this.ctx.shadowColor = '#FF4D6D';
    this.ctx.shadowBlur = 20;

    for (let i = 0; i < 3; i++) {
      this.ctx.beginPath();
      this.ctx.arc(point.x, point.y, 10 + i * 8, 0, Math.PI * 2);
      this.ctx.globalAlpha = 1 - i * 0.3;
      this.ctx.stroke();
    }

    this.ctx.globalAlpha = 1;
    this.ctx.fillStyle = '#FF4D6D';
    this.ctx.beginPath();
    this.ctx.arc(point.x, point.y, 8, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.restore();
  }

  drawSuccessPoint(point: Vector2D): void {
    this.ctx.save();

    this.ctx.strokeStyle = '#39FF14';
    this.ctx.lineWidth = 3;
    this.ctx.shadowColor = '#39FF14';
    this.ctx.shadowBlur = 20;

    for (let i = 0; i < 3; i++) {
      this.ctx.beginPath();
      this.ctx.arc(point.x, point.y, 10 + i * 8, 0, Math.PI * 2);
      this.ctx.globalAlpha = 1 - i * 0.3;
      this.ctx.stroke();
    }

    this.ctx.globalAlpha = 1;
    this.ctx.fillStyle = '#39FF14';
    this.ctx.beginPath();
    this.ctx.arc(point.x, point.y, 8, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.restore();
  }

  drawHighlight(point: Vector2D, color: string = '#00D4FF'): void {
    this.ctx.save();
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);
    this.ctx.strokeRect(point.x - 20, point.y - 20, 40, 40);
    this.ctx.restore();
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }

  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
  }
}
