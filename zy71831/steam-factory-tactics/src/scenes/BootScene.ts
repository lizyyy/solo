import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    const { width, height } = this.cameras.main;
    const cx = width / 2;
    const cy = height / 2;

    const bg = this.add.graphics();
    bg.fillStyle(0x1a1a2e, 1);
    bg.fillRect(0, 0, width, height);

    const title = this.add.text(cx, cy - 30, '蒸汽工厂战棋', {
      fontSize: '28px',
      color: '#e94560',
      fontStyle: 'bold',
    });
    title.setOrigin(0.5);

    const sub = this.add.text(cx, cy + 20, '加载中...', {
      fontSize: '14px',
      color: '#a0a0c0',
    });
    sub.setOrigin(0.5);

    this.load.on('complete', () => {
      this.scene.start('BoardScene');
    });
  }

  create(): void {
  }
}
