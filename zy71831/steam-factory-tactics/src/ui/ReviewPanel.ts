import { BattleReport, FACTION_LABELS, TYPE_LABELS } from '../types';
import { verifyTurnOrder } from '../systems/turnOrder';

function setStatus(msg: string): void {
  const bar = document.getElementById('status-bar');
  if (bar) bar.textContent = msg;
}

export function renderReviewPanel(report: BattleReport | null): void {
  const container = document.getElementById('panel-review');
  if (!container) return;

  if (!report) {
    container.innerHTML = '<div class="section-title">复核</div><div style="color:#a0a0c0;padding:20px;">暂无选中战报，请先导入或从历史中选择</div>';
    return;
  }

  const verification = verifyTurnOrder(report.units, report.turnOrder.checksum);
  const verColor = verification.valid ? '#2ecc71' : '#e74c3c';

  container.innerHTML = `
    <div class="section-title">复核 - ${report.scenarioName}</div>
    <div class="field-label">场景ID</div>
    <div class="field-value">${report.id}</div>
    <div class="field-label">创建时间</div>
    <div class="field-value">${new Date(report.createdAt).toLocaleString('zh-CN')}</div>
    <div class="field-label">版本</div>
    <div class="field-value">v${report.version}</div>
    <div class="field-label">校验结果</div>
    <div class="field-value" style="color:${verColor};border-left:3px solid ${verColor};">${verification.detail}</div>

    <div class="section-title" style="margin-top:12px;">参战单位 (${report.units.length})</div>
    ${report.units.map(u => `
      <div class="unit-card">
        <span class="unit-name">${u.name}</span>
        <span class="unit-stat"> | ${FACTION_LABELS[u.faction]} | ${TYPE_LABELS[u.type]}</span>
        <div class="unit-stat">先攻 ${u.init} | 速度 ${u.speed} | HP ${u.hp}/${u.maxHp} | 位置 (${u.x},${u.y})</div>
        ${u.statusEffects.length > 0 ? `<div class="unit-stat">状态: ${u.statusEffects.join(', ')}</div>` : ''}
      </div>
    `).join('')}

    <div class="section-title" style="margin-top:12px;">回合顺序</div>
    ${report.turnOrder.entries.map(e => {
      const unit = report.units.find(u => u.id === e.unitId);
      return `
        <div class="turn-order-item">
          <span class="order-num">${e.order}</span>
          <span class="order-name">${unit?.name || e.unitId}</span>
          <span class="order-reason">${e.reason}</span>
        </div>
      `;
    }).join('')}

    <div class="section-title" style="margin-top:12px;">判断理由</div>
    <div class="reason-box">
      <span class="reason-label">综合理由：</span>${report.turnOrder.overallReason}
    </div>
    ${report.turnOrder.entries.map(e => {
      const unit = report.units.find(u => u.id === e.unitId);
      return `
        <div class="reason-box">
          <span class="reason-label">[${e.order}] ${unit?.name || e.unitId}：</span>${e.reason}
        </div>
      `;
    }).join('')}

    <div class="section-title" style="margin-top:12px;">下一步建议</div>
    <div class="reason-box">
      <span class="next-step">${report.turnOrder.nextStepSuggestion}</span>
    </div>
  `;
}
