import Phaser from 'phaser';
import { StorageService } from '../services/StorageService';
import { ErrorService } from '../services/ErrorService';
import { ActivityService } from '../services/ActivityService';
import { PlayerRecord } from '../types';

export class ReviewScene extends Phaser.Scene {
  private currentRecords: PlayerRecord[] = [];
  private recordTexts: Phaser.GameObjects.Text[] = [];

  constructor() {
    super({ key: 'ReviewScene' });
  }

  create(): void {
    this.add.rectangle(400, 300, 800, 600, 0x2d5a27);
    
    this.add.text(400, 40, '🔍 记录复核', {
      fontSize: '28px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const stats = ActivityService.getReviewStats();
    this.add.text(400, 75, 
      `待处理:${stats.pending} | 已确认:${stats.confirmed} | 已修正:${stats.corrected} | 待补发:${stats.toBeSupplemented}`,
      { fontSize: '12px', color: '#a7d129' }
    ).setOrigin(0.5);

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = '搜索玩家名称/ID/关卡...';
    searchInput.style.cssText = 'position:absolute;top:100px;left:200px;width:300px;padding:8px;border-radius:8px;border:none;font-size:14px;';
    document.body.appendChild(searchInput);

    const searchBtn = this.add.text(520, 108, '🔍 搜索', {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#3b82f6',
      padding: { x: 15, y: 6 }
    }).setInteractive({ useHandCursor: true });

    searchBtn.on('pointerdown', () => {
      const keyword = searchInput.value.trim();
      this.currentRecords = keyword ? ActivityService.searchRecords(keyword) : StorageService.getRecords();
      this.updateRecordList();
    });

    const filters = [
      { label: '全部', status: null as null | PlayerRecord['rewardStatus'] },
      { label: '⏳ 待处理', status: 'pending' },
      { label: '✅ 已确认', status: 'confirmed' },
      { label: '🔧 已修正', status: 'corrected' },
      { label: '💎 待补发', status: 'topped_up' }
    ];

    filters.forEach((filter, index) => {
      const btn = this.add.text(100 + index * 130, 155, filter.label, {
        fontSize: '12px',
        color: '#ffffff',
        backgroundColor: filter.status === null ? '#3b82f6' : '#4a7c59',
        padding: { x: 10, y: 5 }
      }).setInteractive({ useHandCursor: true });

      btn.on('pointerdown', () => {
        this.currentRecords = filter.status 
          ? ActivityService.getRecordsByStatus(filter.status)
          : StorageService.getRecords();
        this.updateRecordList();
        
        filters.forEach((_, i) => {
          const b = this.children.getAt(4 + i) as Phaser.GameObjects.Text;
          b.setStyle({ backgroundColor: i === index ? '#3b82f6' : '#4a7c59' });
        });
      });
    });

    this.currentRecords = StorageService.getRecords();
    this.updateRecordList();

    const backBtn = this.add.text(100, 560, '← 返回主菜单', {
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#6b7280',
      padding: { x: 15, y: 8 }
    }).setInteractive({ useHandCursor: true });

    backBtn.on('pointerdown', () => {
      searchInput.remove();
      this.scene.start('MainScene');
    });

    this.events.on('shutdown', () => {
      searchInput.remove();
    });
  }

  private updateRecordList(): void {
    this.recordTexts.forEach(t => t.destroy());
    this.recordTexts = [];

    if (this.currentRecords.length === 0) {
      const empty = this.add.text(400, 350, '暂无记录', {
        fontSize: '18px',
        color: '#9ca3af'
      }).setOrigin(0.5);
      this.recordTexts.push(empty);
      return;
    }

    const displayRecords = this.currentRecords.slice(0, 8);
    
    displayRecords.forEach((record, index) => {
      const y = 200 + index * 42;
      
      const statusColor = record.rewardStatus === 'pending' ? '#fbbf24' :
                         record.rewardStatus === 'confirmed' ? '#22c55e' :
                         record.rewardStatus === 'corrected' ? '#3b82f6' : '#a855f7';

      const sourceIcon = record.source === 'player_feedback' ? '💬' :
                        record.source === 'manual' ? '✋' : '🎮';

      const bg = this.add.rectangle(400, y, 600, 35, 0x1e3a1e, 0.8)
        .setInteractive({ useHandCursor: true });

      const text = this.add.text(120, y, 
        `${sourceIcon} ${record.playerName}(${record.playerId}) - ${record.levelName}`,
        { fontSize: '14px', color: '#ffffff' }
      ).setOrigin(0, 0.5);

      const status = this.add.text(620, y, ErrorService.getStatusText(record.rewardStatus), {
        fontSize: '12px',
        color: statusColor
      }).setOrigin(1, 0.5);

      bg.on('pointerover', () => bg.setFillStyle(0x2d5a27, 1));
      bg.on('pointerout', () => bg.setFillStyle(0x1e3a1e, 0.8));
      
      bg.on('pointerdown', () => {
        const recoveryInfo = ErrorService.analyzeRecoveryInfo(
          record.source,
          record.source === 'game_data',
          record.source === 'player_feedback',
          record.completedAt
        );
        ErrorService.showRecoveryDialog(recoveryInfo);
      });

      this.recordTexts.push(bg, text, status);
    });

    if (this.currentRecords.length > 8) {
      const more = this.add.text(400, 530, 
        `...还有 ${this.currentRecords.length - 8} 条记录`,
        { fontSize: '12px', color: '#9ca3af' }
      ).setOrigin(0.5);
      this.recordTexts.push(more);
    }
  }
}
