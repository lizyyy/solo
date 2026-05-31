import Phaser from 'phaser';
import type { TransitWindow } from '@/types';
import { timeToPixel } from '@/utils/timeUtils';

interface TimelineBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  viewStart: string;
  viewEnd: string;
}

export class TransitWindowObject extends Phaser.GameObjects.Container {
  private windowData: TransitWindow;
  private bounds: TimelineBounds;
  private background: Phaser.GameObjects.Rectangle;
  private label: Phaser.GameObjects.Text;
  private isSelected: boolean = false;
  private isDragging: boolean = false;
  private dragOffsetX: number = 0;

  constructor(
    scene: Phaser.Scene,
    windowData: TransitWindow,
    bounds: TimelineBounds,
    rowY: number
  ) {
    super(scene, 0, rowY);
    this.windowData = windowData;
    this.bounds = bounds;
    this.setData('windowId', windowData.id);

    const startX = timeToPixel(windowData.startTime, bounds.viewStart, bounds.viewEnd, bounds.width);
    const endX = timeToPixel(windowData.endTime, bounds.viewStart, bounds.viewEnd, bounds.width);
    const windowWidth = Math.max(endX - startX, 30);
    const windowHeight = 32;

    this.background = scene.add.rectangle(
      startX + windowWidth / 2,
      windowHeight / 2,
      windowWidth,
      windowHeight,
      this.hexToNumber(windowData.color),
      0.8
    );
    this.background.setStrokeStyle(2, 0x00d4ff, 0.5);
    this.background.setOrigin(0.5, 0.5);

    this.label = scene.add.text(
      startX + 8,
      windowHeight / 2,
      windowData.satelliteName,
      {
        fontFamily: 'Roboto Mono, monospace',
        fontSize: '11px',
        color: '#ffffff',
        fontStyle: 'bold'
      }
    );
    this.label.setOrigin(0, 0.5);

    this.add([this.background, this.label]);
    this.setSize(windowWidth, windowHeight);

    this.setupInteraction();
  }

  private setupInteraction(): void {
    this.setInteractive({
      hitArea: this.background,
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true
    });

    this.on('pointerover', () => {
      this.background.setAlpha(1);
      this.background.setStrokeStyle(2, 0x00d4ff, 1);
    });

    this.on('pointerout', () => {
      if (!this.isSelected) {
        this.background.setAlpha(0.8);
        this.background.setStrokeStyle(2, 0x00d4ff, 0.5);
      }
    });

    this.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.isDragging = true;
      this.dragOffsetX = pointer.x - this.x - this.background.x;
      this.emit('window:select', this.windowData.id);
    });

    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isDragging) {
        const newX = pointer.x - this.dragOffsetX;
        this.x = Math.max(0, Math.min(newX, this.bounds.width - this.width));
      }
    });

    this.scene.input.on('pointerup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.emit('window:moved', this.windowData.id, this.x);
      }
    });
  }

  public setSelected(selected: boolean): void {
    this.isSelected = selected;
    if (selected) {
      this.background.setAlpha(1);
      this.background.setStrokeStyle(3, 0x00d4ff, 1);
      this.bringToTop(this);
    } else {
      this.background.setAlpha(0.8);
      this.background.setStrokeStyle(2, 0x00d4ff, 0.5);
    }
  }

  public updateBounds(bounds: TimelineBounds): void {
    this.bounds = bounds;
    const startX = timeToPixel(this.windowData.startTime, bounds.viewStart, bounds.viewEnd, bounds.width);
    const endX = timeToPixel(this.windowData.endTime, bounds.viewStart, bounds.viewEnd, bounds.width);
    const windowWidth = Math.max(endX - startX, 30);

    this.background.setPosition(startX + windowWidth / 2, this.background.y);
    this.background.setSize(windowWidth, this.background.height);
    this.label.setPosition(startX + 8, this.label.y);
    this.setSize(windowWidth, this.height);
    this.setPosition(0, this.y);
  }

  public updateData(windowData: TransitWindow): void {
    this.windowData = windowData;
    this.label.setText(windowData.satelliteName);
    this.background.setFillStyle(this.hexToNumber(windowData.color), 0.8);
  }

  private hexToNumber(hex: string): number {
    return parseInt(hex.replace('#', ''), 16);
  }

  public getWindowData(): TransitWindow {
    return this.windowData;
  }

  public destroy(fromScene?: boolean): void {
    this.scene.input.off('pointermove');
    this.scene.input.off('pointerup');
    super.destroy(fromScene);
  }
}
