import Phaser from 'phaser';
import type { Conflict } from '@/types';

export class ConflictMarker extends Phaser.GameObjects.Container {
  private conflictData: Conflict;
  private marker: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private pulseTween?: Phaser.Tweens.Tween;

  constructor(
    scene: Phaser.Scene,
    conflictData: Conflict,
    x: number,
    y: number
  ) {
    super(scene, x, y);
    this.conflictData = conflictData;
    this.setData('conflictId', conflictData.id);

    this.marker = scene.add.graphics();
    this.drawMarker();

    this.label = scene.add.text(12, 0, '!', {
      fontFamily: 'Orbitron, monospace',
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold'
    });
    this.label.setOrigin(0.5, 0.5);

    this.add([this.marker, this.label]);
    this.setSize(16, 16);

    this.setupInteraction();
    this.startPulseAnimation();
  }

  private drawMarker(): void {
    this.marker.clear();
    this.marker.fillStyle(0xff3b30, 1);
    this.marker.fillTriangle(0, -8, 8, 8, -8, 8);
    this.marker.lineStyle(1, 0xffffff, 0.5);
    this.marker.strokeTriangle(0, -8, 8, 8, -8, 8);
  }

  private setupInteraction(): void {
    this.setInteractive(
      new Phaser.Geom.Triangle(0, -8, 8, 8, -8, 8),
      Phaser.Geom.Triangle.Contains,
      true
    );

    this.on('pointerover', () => {
      this.scene.input.setDefaultCursor('pointer');
      this.label.setColor('#ffff00');
    });

    this.on('pointerout', () => {
      this.scene.input.setDefaultCursor('default');
      this.label.setColor('#ffffff');
    });

    this.on('pointerdown', () => {
      this.emit('conflict:select', this.conflictData.id);
    });
  }

  private startPulseAnimation(): void {
    this.pulseTween = this.scene.tweens.add({
      targets: this,
      scale: { from: 1, to: 1.2 },
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  public updateData(conflictData: Conflict): void {
    this.conflictData = conflictData;
  }

  public stopAnimation(): void {
    if (this.pulseTween) {
      this.pulseTween.stop();
      this.pulseTween = undefined;
    }
  }

  public destroy(fromScene?: boolean): void {
    this.stopAnimation();
    super.destroy(fromScene);
  }
}
