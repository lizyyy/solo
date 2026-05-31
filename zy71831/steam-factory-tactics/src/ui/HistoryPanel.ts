import { FACTION_LABELS } from '../types';
import { getAllHistory } from '../store/localStorage';
import { setCurrentReport, setActivePanel, getFilteredReports, setFilter, getState } from '../store/gameStore';

function setStatus(msg: string): void {
  const bar = document.getElementById('status-bar');
  if (bar) bar.textContent = msg;
}

const ACTION_LABELS: Record<string, string> = {
  import: '导入',
  review: '复核',
  correct: '修正',
  batch: '批量',
  export: '导出',
};

export function initHistoryPanel(): void {
  renderHistoryPanel();
}

export function renderHistoryPanel(): void {
  const container = document.getElementById('panel-history');
  if (!container) return;

  const history = getAllHistory();
  const filteredReports = getFilteredReports();
  const filter = getState().currentFilter;

  container.innerHTML = `
    <div class="section-title">战报列表 (${filteredReports.length})</div>
    <div class="filter-row">
      <select id="filter-faction" style="width:auto;flex:none;">
        <option value="all">全部阵营</option>
        <option value="steam" ${filter.faction === 'steam' ? 'selected' : ''}>${FACTION_LABELS.steam}</option>
        <option value="gear" ${filter.faction === 'gear' ? 'selected' : ''}>${FACTION_LABELS.gear}</option>
        <option value="clockwork" ${filter.faction === 'clockwork' ? 'selected' : ''}>${FACTION_LABELS.clockwork}</option>
      </select>
      <input type="text" id="filter-name" placeholder="场景名称" value="${filter.scenarioName || ''}" style="flex:1;" />
      <select id="filter-corrected" style="width:auto;flex:none;">
        <option value="">修正状态</option>
        <option value="true" ${filter.corrected === true ? 'selected' : ''}>已修正</option>
        <option value="false" ${filter.corrected === false ? 'selected' : ''}>未修正</option>
      </select>
      <button class="btn btn-primary" id="filter-apply-btn" style="flex:none;">筛选</button>
    </div>
    ${filteredReports.length === 0 ? '<div style="color:#a0a0c0;padding:16px;">暂无战报数据</div>' : ''}
    ${filteredReports.map(r => `
      <div class="history-item" data-report-id="${r.id}">
        <div style="display:flex;justify-content:space-between;">
          <span class="hist-id">${r.scenarioName}</span>
          <span class="hist-time">${new Date(r.createdAt).toLocaleString('zh-CN')}</span>
        </div>
        <div class="hist-summary">
          ${r.units.length} 单位 | v${r.version} | ${r.corrected ? '✅已修正' : '⏳未修正'}
        </div>
      </div>
    `).join('')}

    <div class="section-title" style="margin-top:16px;">操作历史 (${history.length})</div>
    ${history.slice(0, 50).map(h => `
      <div class="history-item" style="opacity:0.8;">
        <div style="display:flex;justify-content:space-between;">
          <span style="color:#e94560;font-weight:bold;">${ACTION_LABELS[h.action] || h.action}</span>
          <span class="hist-time">${new Date(h.timestamp).toLocaleString('zh-CN')}</span>
        </div>
        <div class="hist-summary">${h.summary}</div>
      </div>
    `).join('')}
  `;

  container.querySelectorAll('.history-item[data-report-id]').forEach(el => {
    el.addEventListener('click', () => {
      const id = (el as HTMLElement).dataset.reportId;
      if (!id) return;
      const report = filteredReports.find(r => r.id === id);
      if (report) {
        setCurrentReport(report);
        setActivePanel('review');
        setStatus(`已选择: ${report.scenarioName}`);
      }
    });
  });

  document.getElementById('filter-apply-btn')?.addEventListener('click', () => {
    const faction = (document.getElementById('filter-faction') as HTMLSelectElement).value as 'steam' | 'gear' | 'clockwork' | 'all';
    const scenarioName = (document.getElementById('filter-name') as HTMLInputElement).value || undefined;
    const correctedStr = (document.getElementById('filter-corrected') as HTMLSelectElement).value;
    const corrected = correctedStr === 'true' ? true : correctedStr === 'false' ? false : undefined;

    setFilter({
      faction: faction === 'all' ? undefined : faction,
      scenarioName,
      corrected,
    });

    renderHistoryPanel();
    setStatus('筛选已更新');
  });
}
