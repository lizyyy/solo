import Phaser from 'phaser';
import { formatTime } from '@/utils/timeUtils';

export class TimeScale extends Phaser.GameObjects.Container {
  private viewStart: string;
  private viewEnd: string;
  private scaleWidth: number;
  private ticks: Phaser.GameObjects.Text[] = [];
  private lines: Phaser.GameObjects.Line[] = [];

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    viewStart: string,
    viewEnd: string
  ) {
    super(scene, x, y);
    this.scaleWidth = width;
    this.viewStart = viewStart;
    this.viewEnd = viewEnd;
    
    this.drawScale();
  }

  private drawScale(): void {
    this.ticks.forEach(t => t.destroy());
    this.lines.forEach(l => l.destroy());
    this.ticks = [];
    this.lines = [];

    const start = new Date(this.viewStart).getTime();
    const end = new Date(this.viewEnd).getTime();
    const range = end - start;

    const hourCount = Math.floor(range / (1000 * 60 * 60));
    let interval = 1;
    if (hourCount > 24) interval = 4;
    if (hourCount > 48) interval = 6;
    if (hourCount > 96) interval = 12;
    if (hourCount > 192) interval = 24;

    const intervalMs = interval * 60 * 60 * 1000;
    const firstHour = new Date(Math.ceil(start / intervalMs) * intervalMs);
    
    for (let t = firstHour.getTime(); t <= end; t += intervalMs) {
      const x = ((t - start) / range) * this.scaleWidth;
      
      const line = this.scene.add.line(x, 0, 0, 0, 0, 20, 0x00d4ff, 0.3);
      line.setOrigin(0, 0);
      this.lines.push(line);
      this.add(line);
      
      const label = this.scene.add.text(x, 24, formatTime(new Date(t)), {
        fontFamily: 'Roboto Mono, monospace',
        fontSize: '10px',
        color: '#00d4ff'
      });
      label.setOrigin(0.5, 0);
      this.ticks.push(label);
      this.add(label);
    }

    const border = this.scene.add.line(0, 0, 0, 0, this.scaleWidth, 0, 0x00d4ff, 0.5);
    border.setOrigin(0, 0);
    this.lines.push(border);
    this.add(border);
  }

  public updateRange(viewStart: string, viewEnd: string, width: number): void {
    this.viewStart = viewStart;
    this.viewEnd = viewEnd;
    this.scaleWidth = width;
    this.drawScale();
  }

  public destroy(fromScene?: boolean): void {
    this.ticks.forEach(t => t.destroy());
    this.lines.forEach(l => l.destroy());
    super.destroy(fromScene);
  }
}
