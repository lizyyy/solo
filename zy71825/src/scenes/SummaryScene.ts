import Phaser from 'phaser';
import { ActivityService } from '../services/ActivityService';
import { ErrorService } from '../services/ErrorService';
import { ExportService } from '../services/ExportService';
import { ReviewStats } from '../types';

export class SummaryScene extends Phaser.Scene {
  private summaryOverlay: HTMLElement | null = null;

  constructor() {
    super({ key: 'SummaryScene' });
  }

  create(): void {
    this.add.rectangle(400, 300, 800, 600, 0x2d5a27);
    
    this.add.text(400, 40, '📊 活动复盘', {
      fontSize: '28px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const stats = ActivityService.getReviewStats();
    this.drawStatsChart(stats);

    this.add.text(100, 280, '📋 处理口径说明', {
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold'
    });

    const policy = ActivityService.getDefaultHandlingPolicy();
    this.add.text(100, 310, policy, {
      fontSize: '13px',
      color: '#d1d5db',
      align: 'left',
      wordWrap: { width: 600 },
      lineSpacing: 6
    });

    this.add.text(100, 420, '📁 分类导出', {
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold'
    });

    const exportOptions = [
      { label: '📄 已确认记录', status: 'confirmed', color: '#22c55e' },
      { label: '⏳ 待处理记录', status: 'pending', color: '#fbbf24' },
      { label: '🔧 人工修正记录', status: 'corrected', color: '#3b82f6' },
      { label: '💎 待补发记录', status: 'topped_up', color: '#a855f7' }
    ];

    exportOptions.forEach((option, index) => {
      const btn = this.add.text(100 + index * 160, 460, option.label, {
        fontSize: '13px',
        color: '#ffffff',
        backgroundColor: option.color,
        padding: { x: 12, y: 8 }
      }).setInteractive({ useHandCursor: true });

      btn.on('pointerdown', () => {
        const records = ActivityService.getRecordsByStatus(option.status as any);
        if (records.length === 0) {
          ErrorService.showToast('该分类暂无记录', 'info');
          return;
        }
        ExportService.exportRecordsToCSV(records);
        ErrorService.showToast(`已导出 ${records.length} 条记录`, 'success');
      });
    });

    const generateBtn = this.add.text(400, 520, '📋 生成完整复盘报告', {
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#059669',
      padding: { x: 25, y: 12 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    generateBtn.on('pointerdown', () => {
      this.showSummaryDialog();
    });

    const backBtn = this.add.text(100, 560, '← 返回主菜单', {
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#6b7280',
      padding: { x: 15, y: 8 }
    }).setInteractive({ useHandCursor: true });

    backBtn.on('pointerdown', () => {
      this.closeSummaryOverlay();
      this.scene.start('MainScene');
    });
  }

  private drawStatsChart(stats: ReviewStats): void {
    const centerX = 400;
    const centerY = 180;
    const radius = 70;

    const segments = [
      { value: stats.confirmed, color: 0x22c55e, label: '已确认' },
      { value: stats.pending, color: 0xfbbf24, label: '待处理' },
      { value: stats.corrected, color: 0x3b82f6, label: '已修正' },
      { value: stats.toBeSupplemented, color: 0xa855f7, label: '待补发' }
    ];

    const total = stats.total || 1;
    let startAngle = -Math.PI / 2;

    segments.forEach((seg, index) => {
      const angle = (seg.value / total) * Math.PI * 2;
      
      if (seg.value > 0) {
        const graphics = this.add.graphics();
        graphics.fillStyle(seg.color, 1);
        graphics.slice(centerX, centerY, radius, startAngle, startAngle + angle, false);
        graphics.fillPath();
      }

      const midAngle = startAngle + angle / 2;
      const labelX = centerX + Math.cos(midAngle) * (radius + 30);
      const labelY = centerY + Math.sin(midAngle) * (radius + 30);

      this.add.text(labelX, labelY, `${seg.label}\n${seg.value}`, {
        fontSize: '12px',
        color: '#ffffff',
        align: 'center'
      }).setOrigin(0.5);

      startAngle += angle;
    });

    this.add.circle(centerX, centerY, 35, 0x2d5a27);
    this.add.text(centerX, centerY, `总计\n${stats.total}`, {
      fontSize: '14px',
      color: '#ffffff',
      align: 'center'
    }).setOrigin(0.5);
  }

  private showSummaryDialog(): void {
    this.closeSummaryOverlay();

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

    overlay.innerHTML = `
      <div style="
        background: white;
        border-radius: 16px;
        padding: 24px;
        width: 480px;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 20px 40px rgba(0,0,0,0.2);
      ">
        <h3 style="margin:0 0 20px 0; font-size:20px; color:#1f2937;">📋 生成活动复盘报告</h3>
        
        <div style="margin-bottom:16px;">
          <label style="display:block; font-size:14px; color:#374151; margin-bottom:6px;">活动名称</label>
          <input type="text" id="activityName" value="植物温室守护活动" 
            style="width:100%; padding:8px; border:1px solid #d1d5db; border-radius:6px; box-sizing:border-box;">
        </div>

        <div style="display:flex; gap:12px; margin-bottom:16px;">
          <div style="flex:1;">
            <label style="display:block; font-size:14px; color:#374151; margin-bottom:6px;">开始日期</label>
            <input type="date" id="startDate" 
              style="width:100%; padding:8px; border:1px solid #d1d5db; border-radius:6px; box-sizing:border-box;">
          </div>
          <div style="flex:1;">
            <label style="display:block; font-size:14px; color:#374151; margin-bottom:6px;">结束日期</label>
            <input type="date" id="endDate" 
              style="width:100%; padding:8px; border:1px solid #d1d5db; border-radius:6px; box-sizing:border-box;">
          </div>
        </div>

        <div style="margin-bottom:20px;">
          <label style="display:block; font-size:14px; color:#374151; margin-bottom:6px;">处理口径</label>
          <textarea id="handlingPolicy" rows="5"
            style="width:100%; padding:8px; border:1px solid #d1d5db; border-radius:6px; box-sizing:border-box; resize:vertical; font-size:13px;">${ActivityService.getDefaultHandlingPolicy()}</textarea>
        </div>

        <div style="display:flex; gap:12px;">
          <button id="cancelBtn" style="
            flex:1; padding:10px; background:#6b7280; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;
          ">取消</button>
          <button id="generateBtn" style="
            flex:1; padding:10px; background:#059669; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;
          ">生成并导出</button>
        </div>
      </div>
    `;

    const today = new Date();
    const startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    setTimeout(() => {
      (overlay.querySelector('#startDate') as HTMLInputElement).value = startDate.toISOString().split('T')[0];
      (overlay.querySelector('#endDate') as HTMLInputElement).value = today.toISOString().split('T')[0];
    }, 0);

    document.body.appendChild(overlay);
    this.summaryOverlay = overlay;

    overlay.querySelector('#cancelBtn')?.addEventListener('click', () => {
      this.closeSummaryOverlay();
    });

    overlay.querySelector('#generateBtn')?.addEventListener('click', () => {
      const activityName = (overlay.querySelector('#activityName') as HTMLInputElement).value;
      const startDateVal = (overlay.querySelector('#startDate') as HTMLInputElement).value;
      const endDateVal = (overlay.querySelector('#endDate') as HTMLInputElement).value;
      const handlingPolicy = (overlay.querySelector('#handlingPolicy') as HTMLTextAreaElement).value;

      if (!activityName.trim()) {
        ErrorService.showToast('请填写活动名称', 'warning');
        return;
      }
      if (!startDateVal || !endDateVal) {
        ErrorService.showToast('请选择日期范围', 'warning');
        return;
      }

      const summary = ActivityService.generateActivitySummary(
        activityName.trim(),
        new Date(startDateVal),
        new Date(endDateVal + 'T23:59:59'),
        handlingPolicy
      );

      ExportService.exportActivitySummary(summary);
      ErrorService.showToast('复盘报告已生成！', 'success');
      this.closeSummaryOverlay();
    });
  }

  private closeSummaryOverlay(): void {
    if (this.summaryOverlay) {
      this.summaryOverlay.remove();
      this.summaryOverlay = null;
    }
  }
}
