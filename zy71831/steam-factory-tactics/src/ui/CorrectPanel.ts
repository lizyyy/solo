import { BattleReport, FACTION_LABELS, TYPE_LABELS } from '../types';
import { calculateTurnOrder } from '../systems/turnOrder';
import { upsertReport, setCurrentReport, getState } from '../store/gameStore';
import { addHistory } from '../store/localStorage';

function setStatus(msg: string): void {
  const bar = document.getElementById('status-bar');
  if (bar) bar.textContent = msg;
}

export function renderCorrectPanel(report: BattleReport | null): void {
  const container = document.getElementById('panel-correct');
  if (!container) return;

  if (!report) {
    container.innerHTML = '<div class="section-title">修正</div><div style="color:#a0a0c0;padding:20px;">暂无选中战报</div>';
    return;
  }

  container.innerHTML = `
    <div class="section-title">修正 - ${report.scenarioName}</div>
    <div class="field-label">修正说明（必填，主策可见）</div>
    <textarea id="correct-note" placeholder="请说明修正原因，如：蒸汽先锋先攻值应为15而非12">${report.correctionNote || ''}</textarea>

    <div class="section-title" style="margin-top:12px;">单位属性修正</div>
    ${report.units.map((u, i) => `
      <div class="unit-card" id="correct-unit-${i}">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span class="unit-name">${u.name}</span>
          <span class="unit-stat">${FACTION_LABELS[u.faction]} | ${TYPE_LABELS[u.type]}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-top:4px;">
          <div>
            <div class="field-label">先攻</div>
            <input type="number" class="correct-init" data-idx="${i}" value="${u.init}" />
          </div>
          <div>
            <div class="field-label">速度</div>
            <input type="number" class="correct-speed" data-idx="${i}" value="${u.speed}" />
          </div>
          <div>
            <div class="field-label">HP</div>
            <input type="number" class="correct-hp" data-idx="${i}" value="${u.hp}" />
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-top:4px;">
          <div>
            <div class="field-label">位置X</div>
            <input type="number" class="correct-x" data-idx="${i}" value="${u.x}" />
          </div>
          <div>
            <div class="field-label">位置Y</div>
            <input type="number" class="correct-y" data-idx="${i}" value="${u.y}" />
          </div>
          <div>
            <div class="field-label">状态效果</div>
            <input type="text" class="correct-status" data-idx="${i}" value="${u.statusEffects.join(';')}" />
          </div>
        </div>
      </div>
    `).join('')}

    <div style="display:flex;gap:6px;margin-top:12px;">
      <button class="btn btn-primary" id="correct-apply-btn">应用修正</button>
      <button class="btn btn-warning" id="correct-recalc-btn">仅重算回合顺序</button>
    </div>

    <div class="section-title" style="margin-top:12px;">修正后预览</div>
    <div id="correct-preview" style="color:#a0a0c0;">点击"应用修正"后显示</div>
  `;

  document.getElementById('correct-apply-btn')?.addEventListener('click', () => {
    applyCorrection(report, false);
  });

  document.getElementById('correct-recalc-btn')?.addEventListener('click', () => {
    applyCorrection(report, true);
  });
}

function applyCorrection(report: BattleReport, recalcOnly: boolean): void {
  const note = (document.getElementById('correct-note') as HTMLTextAreaElement)?.value?.trim();
  if (!recalcOnly && !note) {
    setStatus('请填写修正说明');
    return;
  }

  const updatedUnits = report.units.map((u, i) => {
    const initEl = document.querySelector(`.correct-init[data-idx="${i}"]`) as HTMLInputElement;
    const speedEl = document.querySelector(`.correct-speed[data-idx="${i}"]`) as HTMLInputElement;
    const hpEl = document.querySelector(`.correct-hp[data-idx="${i}"]`) as HTMLInputElement;
    const xEl = document.querySelector(`.correct-x[data-idx="${i}"]`) as HTMLInputElement;
    const yEl = document.querySelector(`.correct-y[data-idx="${i}"]`) as HTMLInputElement;
    const statusEl = document.querySelector(`.correct-status[data-idx="${i}"]`) as HTMLInputElement;

    return {
      ...u,
      init: initEl ? parseInt(initEl.value) || u.init : u.init,
      speed: speedEl ? parseInt(speedEl.value) || u.speed : u.speed,
      hp: hpEl ? parseInt(hpEl.value) || u.hp : u.hp,
      x: xEl ? parseInt(xEl.value) || u.x : u.x,
      y: yEl ? parseInt(yEl.value) || u.y : u.y,
      statusEffects: statusEl ? statusEl.value.split(';').filter(Boolean) : u.statusEffects,
    };
  });

  const newTurnOrder = calculateTurnOrder(updatedUnits);
  const updated: BattleReport = {
    ...report,
    units: updatedUnits,
    turnOrder: newTurnOrder,
    corrected: true,
    correctionNote: note || report.correctionNote,
  };

  const saved = upsertReport(updated);
  addHistory('correct', `修正: ${report.scenarioName} - ${note || '重算回合顺序'}`, saved);
  setCurrentReport(saved);

  const preview = document.getElementById('correct-preview');
  if (preview) {
    preview.innerHTML = `
      ${newTurnOrder.entries.map(e => {
        const unit = updatedUnits.find(u => u.id === e.unitId);
        return `
          <div class="turn-order-item">
            <span class="order-num">${e.order}</span>
            <span class="order-name">${unit?.name || e.unitId}</span>
            <span class="order-reason">${e.reason}</span>
          </div>
        `;
      }).join('')}
      <div class="reason-box" style="margin-top:8px;">
        <span class="next-step">${newTurnOrder.nextStepSuggestion}</span>
      </div>
    `;
  }

  setStatus(`修正已应用: ${report.scenarioName}`);
}
