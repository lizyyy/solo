import Phaser from 'phaser';
import { StorageService } from '../services/StorageService';
import { ErrorService } from '../services/ErrorService';
import { ExportService } from '../services/ExportService';
import { RecordHistory } from '../types';

export class HistoryScene extends Phaser.Scene {
  private historyElements: Phaser.GameObjects.Text[] = [];

  constructor() {
    super({ key: 'HistoryScene' });
  }

  create(): void {
    this.add.rectangle(400, 300, 800, 600, 0x2d5a27);
    
    this.add.text(400, 40, '📜 操作历史', {
      fontSize: '28px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const exportBtn = this.add.text(680, 40, '📤 导出', {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#3b82f6',
      padding: { x: 12, y: 6 }
    }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });

    exportBtn.on('pointerdown', () => {
      ExportService.exportHistoryToCSV(StorageService.getHistory());
      ErrorService.showToast('历史记录已导出！', 'success');
    });

    this.refreshHistoryList();

    const backBtn = this.add.text(100, 560, '← 返回主菜单', {
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#6b7280',
      padding: { x: 15, y: 8 }
    }).setInteractive({ useHandCursor: true });

    backBtn.on('pointerdown', () => {
      this.scene.start('MainScene');
    });
  }

  private refreshHistoryList(): void {
    this.historyElements.forEach(e => e.destroy());
    this.historyElements = [];

    const history = StorageService.getHistory().reverse().slice(0, 12);

    if (history.length === 0) {
      const empty = this.add.text(400, 300, '暂无操作记录', {
        fontSize: '18px',
        color: '#9ca3af'
      }).setOrigin(0.5);
      this.historyElements.push(empty);
      return;
    }

    const actionColors: { [key: string]: string } = {
      'created': '#3b82f6',
      'updated': '#6b7280',
      'confirmed': '#22c55e',
      'corrected': '#f59e0b',
      'topped_up': '#a855f7'
    };

    const actionLabels: { [key: string]: string } = {
      'created': '创建',
      'updated': '更新',
      'confirmed': '确认',
      'corrected': '修正',
      'topped_up': '补发'
    };

    history.forEach((h, index) => {
      const y = 100 + index * 38;
      
      const bg = this.add.rectangle(400, y, 650, 32, 0x1e3a1e, 0.6);

      const time = new Date(h.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      
      const timeText = this.add.text(100, y, time, {
        fontSize: '12px',
        color: '#9ca3af'
      }).setOrigin(0, 0.5);

      const actionText = this.add.text(170, y, actionLabels[h.action] || h.action, {
        fontSize: '12px',
        color: '#ffffff',
        backgroundColor: actionColors[h.action] || '#6b7280',
        padding: { x: 8, y: 3 }
      }).setOrigin(0, 0.5);

      const recordText = this.add.text(250, y, `记录: ${h.recordId.slice(0, 8)}...`, {
        fontSize: '12px',
        color: '#d1d5db'
      }).setOrigin(0, 0.5);

      const opText = this.add.text(500, y, h.operator, {
        fontSize: '12px',
        color: '#a7d129'
      }).setOrigin(0, 0.5);

      if (h.note) {
        const noteText = this.add.text(580, y, '💬', {
          fontSize: '14px'
        }).setOrigin(0, 0.5);
        this.historyElements.push(noteText);
      }

      this.historyElements.push(bg, timeText, actionText, recordText, opText);
    });
  }
}
