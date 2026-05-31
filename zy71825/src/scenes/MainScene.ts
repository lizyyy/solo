import Phaser from 'phaser';
import { ActivityService } from '../services/ActivityService';
import { ErrorService } from '../services/ErrorService';
import { ExportService } from '../services/ExportService';

export class MainScene extends Phaser.Scene {
  private menuItems: Phaser.GameObjects.Text[] = [];
  private selectedIndex = 0;

  constructor() {
    super({ key: 'MainScene' });
  }

  create(): void {
    ErrorService.injectStyles();
    ActivityService.addSampleData();

    this.add.rectangle(400, 300, 800, 600, 0x2d5a27);
    
    this.add.text(400, 80, '🌿 植物温室守护 🌿', {
      fontSize: '36px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(400, 130, '活动奖励管理系统', {
      fontSize: '18px',
      color: '#a7d129'
    }).setOrigin(0.5);

    const menuOptions = [
      { icon: '📥', text: '导入关卡草表', scene: 'ImportScene' },
      { icon: '🔍', text: '记录复核', scene: 'ReviewScene' },
      { icon: '✏️', text: '修正记录', scene: 'CorrectScene' },
      { icon: '📜', text: '操作历史', scene: 'HistoryScene' },
      { icon: '📊', text: '活动复盘', scene: 'SummaryScene' },
      { icon: '📤', text: '导出数据', scene: null }
    ];

    menuOptions.forEach((option, index) => {
      const item = this.add.text(400, 200 + index * 55, `${option.icon} ${option.text}`, {
        fontSize: '20px',
        color: '#ffffff',
        backgroundColor: '#4a7c59',
        padding: { x: 20, y: 10 }
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      item.on('pointerover', () => {
        item.setStyle({ backgroundColor: '#6b9b7a' });
      });

      item.on('pointerout', () => {
        item.setStyle({ backgroundColor: '#4a7c59' });
      });

      item.on('pointerdown', () => {
        if (option.scene) {
          this.scene.start(option.scene);
        } else {
          ExportService.exportAllData();
          ErrorService.showToast('完整数据备份已导出！', 'success');
        }
      });

      this.menuItems.push(item);
    });

    const stats = ActivityService.getReviewStats();
    this.add.text(400, 540, 
      `📊 概览 | 总数:${stats.total} | 待处理:${stats.pending} | 已确认:${stats.confirmed} | 已修正:${stats.corrected}`,
      { fontSize: '14px', color: '#c8e6c9' }
    ).setOrigin(0.5);
  }
}
