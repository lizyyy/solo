import Phaser from 'phaser';
import { StorageService } from '../services/StorageService';
import { ErrorService } from '../services/ErrorService';
import { PlayerRecord } from '../types';

export class CorrectScene extends Phaser.Scene {
  private selectedRecord: PlayerRecord | null = null;
  private recordElements: Phaser.GameObjects.Text[] = [];
  private editOverlay: HTMLElement | null = null;

  constructor() {
    super({ key: 'CorrectScene' });
  }

  create(): void {
    this.add.rectangle(400, 300, 800, 600, 0x2d5a27);
    
    this.add.text(400, 40, '✏️ 修正记录', {
      fontSize: '28px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(400, 75, '点击记录进行修正', {
      fontSize: '14px',
      color: '#a7d129'
    }).setOrigin(0.5);

    this.refreshRecordList();

    const backBtn = this.add.text(100, 560, '← 返回主菜单', {
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#6b7280',
      padding: { x: 15, y: 8 }
    }).setInteractive({ useHandCursor: true });

    backBtn.on('pointerdown', () => {
      this.closeEditOverlay();
      this.scene.start('MainScene');
    });
  }

  private refreshRecordList(): void {
    this.recordElements.forEach(e => e.destroy());
    this.recordElements = [];

    const records = StorageService.getRecords();
    const pendingRecords = records.filter(r => 
      r.rewardStatus === 'pending' || r.rewardStatus === 'topped_up'
    );

    if (pendingRecords.length === 0) {
      const empty = this.add.text(400, 300, '🎉 太棒了！没有待处理的记录', {
        fontSize: '18px',
        color: '#22c55e'
      }).setOrigin(0.5);
      this.recordElements.push(empty);
      return;
    }

    pendingRecords.slice(0, 8).forEach((record, index) => {
      const y = 120 + index * 52;
      
      const bg = this.add.rectangle(400, y, 600, 45, 0x1e3a1e, 0.8)
        .setInteractive({ useHandCursor: true });

      const sourceColor = record.source === 'player_feedback' ? '#f59e0b' : '#3b82f6';
      const sourceLabel = record.source === 'player_feedback' ? '玩家反馈' :
                         record.source === 'manual' ? '人工录入' : '游戏数据';

      const text = this.add.text(120, y - 10, 
        `${record.playerName} - ${record.levelName}`,
        { fontSize: '14px', color: '#ffffff' }
      ).setOrigin(0, 0.5);

      const badge = this.add.text(120, y + 12, sourceLabel, {
        fontSize: '11px',
        color: '#ffffff',
        backgroundColor: sourceColor,
        padding: { x: 8, y: 3 }
      }).setOrigin(0, 0.5);

      const status = this.add.text(620, y, ErrorService.getStatusText(record.rewardStatus), {
        fontSize: '12px',
        color: '#fbbf24'
      }).setOrigin(1, 0.5);

      bg.on('pointerover', () => bg.setFillStyle(0x2d5a27, 1));
      bg.on('pointerout', () => bg.setFillStyle(0x1e3a1e, 0.8));
      bg.on('pointerdown', () => this.showEditDialog(record));

      this.recordElements.push(bg, text, badge, status);
    });
  }

  private showEditDialog(record: PlayerRecord): void {
    this.closeEditOverlay();

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    `;

    const sourceText = record.source === 'player_feedback' ? '玩家反馈' :
                      record.source === 'manual' ? '人工录入' : '游戏数据';

    overlay.innerHTML = `
      <div style="
        background: white;
        border-radius: 16px;
        padding: 24px;
        width: 450px;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 20px 40px rgba(0,0,0,0.2);
      ">
        <h3 style="margin:0 0 16px 0; font-size:20px; color:#1f2937;">📝 修正记录</h3>
        
        <div style="background:#f3f4f6; padding:12px; border-radius:8px; margin-bottom:16px;">
          <div style="font-weight:bold; color:#374151;">${record.playerName} (${record.playerId})</div>
          <div style="color:#6b7280; font-size:14px;">关卡：${record.levelName}</div>
          <div style="color:#6b7280; font-size:14px;">来源：${sourceText}</div>
          ${record.feedbackNote ? `<div style="color:#dc2626; font-size:13px; margin-top:4px;">💬 ${record.feedbackNote}</div>` : ''}
        </div>

        <div style="margin-bottom:12px;">
          <label style="display:block; font-size:14px; color:#374151; margin-bottom:6px;">奖励名称</label>
          <input type="text" id="rewardName" value="${record.actualReward || ''}" 
            style="width:100%; padding:8px; border:1px solid #d1d5db; border-radius:6px; box-sizing:border-box;"
            placeholder="如：钻石、金币">
        </div>

        <div style="margin-bottom:12px;">
          <label style="display:block; font-size:14px; color:#374151; margin-bottom:6px;">奖励数量</label>
          <input type="number" id="rewardAmount" value="${record.actualAmount || ''}" 
            style="width:100%; padding:8px; border:1px solid #d1d5db; border-radius:6px; box-sizing:border-box;"
            placeholder="如：100">
        </div>

        <div style="margin-bottom:12px;">
          <label style="display:block; font-size:14px; color:#374151; margin-bottom:6px;">处理状态</label>
          <select id="statusSelect" style="width:100%; padding:8px; border:1px solid #d1d5db; border-radius:6px;">
            <option value="pending" ${record.rewardStatus === 'pending' ? 'selected' : ''}>⏳ 待处理</option>
            <option value="confirmed" ${record.rewardStatus === 'confirmed' ? 'selected' : ''}>✅ 已确认（奖励已发）</option>
            <option value="corrected" ${record.rewardStatus === 'corrected' ? 'selected' : ''}>🔧 已修正（人工处理）</option>
            <option value="topped_up" ${record.rewardStatus === 'topped_up' ? 'selected' : ''}>💎 已补发</option>
          </select>
        </div>

        <div style="margin-bottom:16px;">
          <label style="display:block; font-size:14px; color:#374151; margin-bottom:6px;">处理人</label>
          <input type="text" id="handlerName" value="${record.handler || ''}" 
            style="width:100%; padding:8px; border:1px solid #d1d5db; border-radius:6px; box-sizing:border-box;"
            placeholder="请输入你的姓名">
        </div>

        <div style="margin-bottom:20px;">
          <label style="display:block; font-size:14px; color:#374151; margin-bottom:6px;">处理备注</label>
          <textarea id="correctionNote" rows="3"
            style="width:100%; padding:8px; border:1px solid #d1d5db; border-radius:6px; box-sizing:border-box; resize:vertical;"
            placeholder="说明处理情况...">${record.correctionNote || ''}</textarea>
        </div>

        <div style="display:flex; gap:12px;">
          <button id="cancelBtn" style="
            flex:1; padding:10px; background:#6b7280; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;
          ">取消</button>
          <button id="saveBtn" style="
            flex:1; padding:10px; background:#22c55e; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;
          ">保存修改</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    this.editOverlay = overlay;

    overlay.querySelector('#cancelBtn')?.addEventListener('click', () => {
      this.closeEditOverlay();
    });

    overlay.querySelector('#saveBtn')?.addEventListener('click', () => {
      const rewardName = (overlay.querySelector('#rewardName') as HTMLInputElement).value;
      const rewardAmount = parseInt((overlay.querySelector('#rewardAmount') as HTMLInputElement).value, 10);
      const status = (overlay.querySelector('#statusSelect') as HTMLSelectElement).value as PlayerRecord['rewardStatus'];
      const handler = (overlay.querySelector('#handlerName') as HTMLInputElement).value;
      const note = (overlay.querySelector('#correctionNote') as HTMLTextAreaElement).value;

      if (!handler.trim()) {
        ErrorService.showToast('请填写处理人姓名', 'warning');
        return;
      }

      try {
        StorageService.updateRecord(record.id, {
          actualReward: rewardName || undefined,
          actualAmount: isNaN(rewardAmount) ? undefined : rewardAmount,
          rewardStatus: status,
          handler: handler.trim(),
          handledAt: Date.now(),
          correctionNote: note || undefined
        }, handler.trim());

        ErrorService.showToast('修改已保存！', 'success');
        this.closeEditOverlay();
        this.refreshRecordList();
      } catch (e: any) {
        ErrorService.showToast(e.message || '保存失败', 'error');
      }
    });
  }

  private closeEditOverlay(): void {
    if (this.editOverlay) {
      this.editOverlay.remove();
      this.editOverlay = null;
    }
  }
}
