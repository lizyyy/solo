import './styles/main.css';
import type { AppState, AppAction, Scene, Risk, SimulationResult } from './types';
import type { ParseResult } from './utils/parser';
import { createInitialState, appReducer, createAdjustment } from './store/state';
import { runSimulation } from './engine/scheduler';
import { parseSchedule } from './utils/parser';
import { formatTime, timeToMinutes, isMidnightCrossing } from './utils/time';
import { downloadJSON, downloadRiskReport } from './utils/exporter';
import { sampleSchedule, sampleMidnightSchedule } from './data/sampleSchedule';

let state: AppState = createInitialState();
let importError: string | null = null;

const app = document.querySelector<HTMLDivElement>('#app')!;

function dispatch(action: AppAction): void {
  state = appReducer(state, action);
  render();
}

function getSceneRisks(sceneId: string): Risk[] {
  if (!state.simulationResult) return [];
  return state.simulationResult.allRisks.filter(
    (r) => r.sceneId === sceneId || (r.details as { scenes?: string[] })?.scenes?.includes(sceneId)
  );
}

function getSceneRiskLevel(sceneId: string): 'none' | 'low' | 'medium' | 'high' | 'critical' {
  const risks = getSceneRisks(sceneId);
  if (risks.length === 0) return 'none';
  
  const severities = risks.map((r) => r.severity);
  if (severities.includes('critical')) return 'critical';
  if (severities.includes('high')) return 'high';
  if (severities.includes('medium')) return 'medium';
  return 'low';
}

function getBatteryStatusClass(charge: number): string {
  if (charge <= 5) return 'critical';
  if (charge <= 20) return 'low';
  if (charge <= 50) return 'medium';
  return 'high';
}

function renderHeader(): string {
  const canUndo = state.historyIndex > 0;
  const canRedo = state.historyIndex < state.history.length - 1;
  
  return `
    <header class="header">
      <div class="header-content">
        <div class="header-title">
          <h1>🔋 电池轮换调度器</h1>
          <span class="header-subtitle">${state.currentSchedule.name}</span>
          ${state.simulationResult?.isMidnightCrossing ? '<span class="scene-midnight-badge">跨午夜</span>' : ''}
        </div>
        <div class="header-actions">
          <div class="undo-redo-buttons">
            <button class="btn btn-sm" id="undo-btn" ${!canUndo ? 'disabled' : ''} title="撤销">↩️ 撤销</button>
            <button class="btn btn-sm" id="redo-btn" ${!canRedo ? 'disabled' : ''} title="重做">↪️ 重做</button>
          </div>
          <button class="btn btn-primary" id="simulate-btn" ${state.isSimulating ? 'disabled' : ''}>
            ${state.isSimulating ? '⏳ 模拟中...' : '▶️ 运行模拟'}
          </button>
          ${state.simulationResult ? `
            <button class="btn" id="export-json-btn">📥 导出 JSON</button>
            <button class="btn" id="export-report-btn">📄 导出报告</button>
          ` : ''}
        </div>
      </div>
    </header>
  `;
}

function renderSceneList(): string {
  const scenes = state.currentSchedule.scenes;
  
  if (scenes.length === 0) {
    return `
      <div class="card">
        <div class="card-header">
          <h3>📋 拍摄场景</h3>
        </div>
        <div class="card-body">
          <div class="empty-state">
            <div class="empty-state-icon">🎬</div>
            <div class="empty-state-text">暂无场景</div>
            <div class="empty-state-hint">请导入拍摄计划</div>
          </div>
        </div>
      </div>
    `;
  }

  const sceneItems = scenes.map((scene) => {
    const isSelected = state.selectedScene === scene.id;
    const riskLevel = getSceneRiskLevel(scene.id);
    const hasRisks = riskLevel !== 'none';
    const crossesMidnight = isMidnightCrossing(scene.timeRange);
    
    let classes = 'scene-item';
    if (isSelected) classes += ' active';
    if (hasRisks) classes += ` ${riskLevel === 'critical' ? 'critical' : 'has-risks'}`;

    return `
      <div class="${classes}" data-scene-id="${scene.id}">
        <div class="scene-name">
          ${scene.name}
          ${crossesMidnight ? '<span class="scene-midnight-badge">跨午夜</span>' : ''}
        </div>
        <div class="scene-time">
          ${formatTime(scene.timeRange.start)} - ${formatTime(scene.timeRange.end)}
        </div>
        ${scene.cameras.length > 0 ? `
          <div class="scene-time" style="margin-top: 4px; color: var(--text-muted);">
            ${scene.cameras.length} 台相机
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  return `
    <div class="card">
      <div class="card-header">
        <h3>📋 拍摄场景</h3>
        <span style="font-size: 12px; color: var(--text-muted);">${scenes.length} 个场景</span>
      </div>
      <div class="card-body" style="max-height: 400px; overflow-y: auto;">
        ${sceneItems}
      </div>
    </div>
  `;
}

function renderImportPanel(): string {
  return `
    <div class="card">
      <div class="card-header">
        <h3>📥 导入数据</h3>
      </div>
      <div class="card-body">
        <div class="sample-selector">
          <button class="sample-btn" id="load-sample-1">
            <h4>日间拍摄</h4>
            <p>含午休充电、夜戏跨午夜</p>
          </button>
          <button class="sample-btn" id="load-sample-2">
            <h4>夜景延时</h4>
            <p>含电池冲突、电量不足风险</p>
          </button>
        </div>
        
        <div style="margin-bottom: 12px;">
          <label class="edit-form-label">或粘贴 JSON 数据</label>
          <textarea class="import-area" id="import-json" placeholder="粘贴拍摄计划 JSON 数据..."></textarea>
        </div>
        
        <div class="import-buttons">
          <button class="btn btn-primary btn-sm" id="import-btn">解析并导入</button>
          <button class="btn btn-sm" id="clear-import-btn">清空</button>
        </div>
        
        ${importError ? `<div class="import-error">${importError}</div>` : ''}
      </div>
    </div>
  `;
}

function renderBatteryList(): string {
  const batteries = state.currentSchedule.batteries;
  
  if (batteries.length === 0) {
    return `
      <div class="card">
        <div class="card-header">
          <h3>🔋 电池状态</h3>
        </div>
        <div class="card-body">
          <div class="no-results">暂无电池数据</div>
        </div>
      </div>
    `;
  }

  const batteryItems = batteries.map((battery) => {
    const isSelected = state.selectedBattery === battery.id;
    const statusClass = battery.status.replace('_', '-');
    const statusLabel = {
      idle: '闲置',
      in_use: '使用中',
      charging: '充电中',
      low: '低电量',
      critical: '电量危急',
    }[battery.status] || battery.status;

    return `
      <div class="battery-item ${isSelected ? 'active' : ''}" data-battery-id="${battery.id}">
        <div class="battery-header">
          <span class="battery-name">${battery.name}</span>
          <span class="battery-type">${battery.type}</span>
        </div>
        <div class="battery-bar-container">
          <div class="battery-bar ${getBatteryStatusClass(battery.currentCharge)}" style="width: ${battery.currentCharge}%;"></div>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span class="battery-status ${statusClass}">
            ${battery.currentCharge.toFixed(0)}%
          </span>
          <span class="battery-status ${statusClass}">
            ${statusLabel}
            ${battery.assignedTo ? ` (相机)` : ''}
            ${battery.chargingPort ? ` (充电中)` : ''}
          </span>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="card">
      <div class="card-header">
        <h3>🔋 电池状态</h3>
        <span style="font-size: 12px; color: var(--text-muted);">${batteries.length} 块电池</span>
      </div>
      <div class="card-body" style="max-height: 300px; overflow-y: auto;">
        ${batteryItems}
      </div>
    </div>
  `;
}

function renderChargerList(): string {
  const chargers = state.currentSchedule.chargers;
  
  if (chargers.length === 0) {
    return '';
  }

  const chargerItems = chargers.map((charger) => {
    const portItems = charger.ports.map((port) => {
      const isOccupied = !!port.occupiedBy;
      const batteryName = port.occupiedBy 
        ? state.currentSchedule.batteries.find((b) => b.id === port.occupiedBy)?.name || port.occupiedBy
        : '空闲';
      
      return `
        <div class="charger-port ${isOccupied ? 'occupied' : ''}">
          <span class="charger-port-name">${port.name}:</span>
          <span class="charger-port-battery">${batteryName}</span>
        </div>
      `;
    }).join('');

    return `
      <div class="charger-item">
        <div class="charger-name">${charger.name}</div>
        <div class="charger-port-list">
          ${portItems}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="card">
      <div class="card-header">
        <h3>🔌 充电器</h3>
      </div>
      <div class="card-body">
        <div class="charger-ports">
          ${chargerItems}
        </div>
      </div>
    </div>
  `;
}

function renderTimeline(): string {
  const scenes = state.currentSchedule.scenes;
  
  if (scenes.length === 0) {
    return `
      <div class="timeline-container">
        <div class="card-body">
          <div class="empty-state">
            <div class="empty-state-icon">⏱️</div>
            <div class="empty-state-text">暂无时间轴数据</div>
            <div class="empty-state-hint">运行模拟后查看详细时间轴</div>
          </div>
        </div>
      </div>
    `;
  }

  let minTime = 24 * 60;
  let maxTime = 0;
  
  for (const scene of scenes) {
    const startMin = timeToMinutes(scene.timeRange.start);
    const endMin = timeToMinutes(scene.timeRange.end);
    
    if (startMin <= endMin) {
      minTime = Math.min(minTime, startMin);
      maxTime = Math.max(maxTime, endMin);
    } else {
      minTime = Math.min(minTime, startMin);
      maxTime = Math.max(maxTime, endMin + 1440);
    }
  }
  
  minTime = Math.max(0, minTime - 60);
  maxTime = Math.min(1440, maxTime + 60);
  
  const totalMinutes = maxTime - minTime;
  const ticks: { time: number; label: string; isMajor: boolean }[] = [];
  
  const hourStart = Math.floor(minTime / 60);
  const hourEnd = Math.ceil(maxTime / 60);
  
  for (let hour = hourStart; hour <= hourEnd; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const time = hour * 60 + minute;
      if (time >= minTime && time <= maxTime) {
        const normalizedHour = hour % 24;
        ticks.push({
          time,
          label: `${normalizedHour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
          isMajor: minute === 0,
        });
      }
    }
  }

  const hasMidnightCrossing = state.simulationResult?.isMidnightCrossing || scenes.some((s) => isMidnightCrossing(s.timeRange));

  function timeToPercent(time: number): number {
    let effectiveTime = time;
    if (hasMidnightCrossing && time < minTime && time < 12 * 60) {
      effectiveTime = time + 1440;
    }
    const effectiveMinTime = minTime;
    const effectiveMaxTime = hasMidnightCrossing && maxTime < 12 * 60 ? maxTime + 1440 : maxTime;
    const effectiveTotal = effectiveMaxTime - effectiveMinTime;
    
    return ((effectiveTime - effectiveMinTime) / effectiveTotal) * 100;
  }

  const sceneRows = scenes.map((scene) => {
    const riskLevel = getSceneRiskLevel(scene.id);
    let riskClass = '';
    if (riskLevel === 'critical') riskClass = 'critical';
    else if (riskLevel !== 'none') riskClass = 'has-risks';
    
    const startMin = timeToMinutes(scene.timeRange.start);
    const endMin = timeToMinutes(scene.timeRange.end);
    
    let left: number;
    let width: number;
    
    if (startMin <= endMin) {
      left = timeToPercent(startMin);
      width = timeToPercent(endMin) - left;
    } else {
      left = timeToPercent(startMin);
      width = (100 - left) + timeToPercent(endMin);
    }

    return `
      <div class="timeline-row">
        <div class="timeline-row-label">${scene.name}</div>
        <div class="timeline-row-content">
          <div 
            class="timeline-block scene ${riskClass}" 
            style="left: ${left}%; width: ${Math.max(width, 5)}%;"
            data-scene-id="${scene.id}"
            title="${scene.name}\n${formatTime(scene.timeRange.start)} - ${formatTime(scene.timeRange.end)}\n${scene.cameras.length} 台相机${scene.notes ? '\n' + scene.notes : ''}"
          >
            ${scene.name}
          </div>
        </div>
      </div>
    `;
  }).join('');

  const midnightLine = hasMidnightCrossing ? `
    <div class="timeline-midnight-line" style="left: ${timeToPercent(0)}%;"></div>
  ` : '';

  return `
    <div class="timeline-container">
      <div class="timeline-header">
        <h3>⏱️ 时间轴</h3>
        <div class="timeline-controls">
          <label>
            ${state.simulationResult ? '模拟完成 ✓' : '点击"运行模拟"查看详细状态'}
          </label>
        </div>
      </div>
      <div class="timeline-view">
        <div class="timeline-axis">
          ${midnightLine}
          <div class="timeline-ticks">
            ${ticks.map((tick) => `
              <div class="timeline-tick ${tick.isMajor ? 'major' : ''}" style="flex: 1; min-width: 50px;">
                ${tick.isMajor ? `<span class="timeline-tick-label">${tick.label}</span>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
        <div class="timeline-scenes">
          ${sceneRows}
        </div>
      </div>
    </div>
  `;
}

function renderRiskPanel(): string {
  if (!state.simulationResult) {
    return `
      <div class="card">
        <div class="card-header">
          <h3>⚠️ 风险检测</h3>
        </div>
        <div class="card-body">
          <div class="empty-state">
            <div class="empty-state-icon">🔍</div>
            <div class="empty-state-text">运行模拟以检测风险</div>
            <div class="empty-state-hint">点击顶部"运行模拟"按钮</div>
          </div>
        </div>
      </div>
    `;
  }

  const risks = state.simulationResult.allRisks;
  
  if (risks.length === 0) {
    return `
      <div class="card">
        <div class="card-header">
          <h3>⚠️ 风险检测</h3>
        </div>
        <div class="card-body">
          <div class="empty-state">
            <div class="empty-state-icon">✅</div>
            <div class="empty-state-text">无风险</div>
            <div class="empty-state-hint">所有电池分配看起来很合理！</div>
          </div>
        </div>
      </div>
    `;
  }

  const criticalCount = risks.filter((r) => r.severity === 'critical').length;
  const highCount = risks.filter((r) => r.severity === 'high').length;
  const mediumCount = risks.filter((r) => r.severity === 'medium').length;
  const lowCount = risks.filter((r) => r.severity === 'low').length;

  const sortedRisks = [...risks].sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const orderA = severityOrder[a.severity] || 99;
    const orderB = severityOrder[b.severity] || 99;
    if (orderA !== orderB) return orderA - orderB;
    return timeToMinutes(a.time) - timeToMinutes(b.time);
  });

  const riskTypeLabels: Record<string, string> = {
    battery_critical: '电量危急',
    battery_low: '电量低',
    port_conflict: '充电口冲突',
    cross_scene_late: '跨场延迟',
    simultaneous_use: '电池冲突',
    battery_depleted: '电量耗尽',
  };

  const riskItems = sortedRisks.map((risk) => {
    const typeLabel = riskTypeLabels[risk.type] || risk.type;
    
    return `
      <div class="risk-item ${risk.severity}">
        <div class="risk-header">
          <span class="risk-type">${typeLabel}</span>
          <span class="risk-time">${formatTime(risk.time)}</span>
        </div>
        <div class="risk-description">${risk.description}</div>
      </div>
    `;
  }).join('');

  return `
    <div class="card">
      <div class="card-header">
        <h3>⚠️ 风险检测</h3>
        <span style="font-size: 12px; color: var(--text-muted);">${risks.length} 个风险</span>
      </div>
      <div class="card-body">
        <div class="risk-summary">
          ${criticalCount > 0 ? `
            <div class="risk-summary-item critical">
              <div class="risk-summary-count critical">${criticalCount}</div>
              <div class="risk-summary-label">危急</div>
            </div>
          ` : ''}
          ${highCount > 0 ? `
            <div class="risk-summary-item high">
              <div class="risk-summary-count high">${highCount}</div>
              <div class="risk-summary-label">高</div>
            </div>
          ` : ''}
          ${mediumCount > 0 ? `
            <div class="risk-summary-item medium">
              <div class="risk-summary-count medium">${mediumCount}</div>
              <div class="risk-summary-label">中</div>
            </div>
          ` : ''}
          ${lowCount > 0 ? `
            <div class="risk-summary-item low">
              <div class="risk-summary-count low">${lowCount}</div>
              <div class="risk-summary-label">低</div>
            </div>
          ` : ''}
        </div>
        
        <div style="max-height: 400px; overflow-y: auto;">
          ${riskItems}
        </div>
      </div>
    </div>
  `;
}

function renderSceneDetail(): string {
  if (!state.selectedScene) {
    return `
      <div class="card">
        <div class="card-header">
          <h3>🎬 场景详情</h3>
        </div>
        <div class="card-body">
          <div class="no-results">点击左侧场景查看详情</div>
        </div>
      </div>
    `;
  }

  const scene = state.currentSchedule.scenes.find((s) => s.id === state.selectedScene);
  if (!scene) {
    return `
      <div class="card">
        <div class="card-header">
          <h3>🎬 场景详情</h3>
        </div>
        <div class="card-body">
          <div class="no-results">场景不存在</div>
        </div>
      </div>
    `;
  }

  const crossesMidnight = isMidnightCrossing(scene.timeRange);
  
  const cameraAssignments = scene.cameras.map((assignment) => {
    const camera = state.currentSchedule.cameras.find((c) => c.id === assignment.cameraId);
    const battery = assignment.batteryId 
      ? state.currentSchedule.batteries.find((b) => b.id === assignment.batteryId)
      : null;
    
    return `
      <div class="camera-assignment">
        <span class="camera-assignment-name">${camera?.name || assignment.cameraId}</span>
        <span class="camera-assignment-battery ${battery ? '' : 'none'}">
          ${battery ? battery.name : '未分配电池'}
        </span>
      </div>
    `;
  }).join('');

  return `
    <div class="card">
      <div class="card-header">
        <h3>🎬 场景详情</h3>
      </div>
      <div class="card-body">
        <div class="scene-detail">
          <div class="scene-detail-label">场景名称</div>
          <div class="scene-detail-value">
            ${scene.name}
            ${crossesMidnight ? '<span class="scene-midnight-badge">跨午夜</span>' : ''}
          </div>
        </div>
        
        <div class="scene-detail">
          <div class="scene-detail-label">时间</div>
          <div class="scene-detail-value">
            ${formatTime(scene.timeRange.start)} - ${formatTime(scene.timeRange.end)}
          </div>
        </div>
        
        ${scene.notes ? `
          <div class="scene-detail">
            <div class="scene-detail-label">备注</div>
            <div class="scene-detail-value">${scene.notes}</div>
          </div>
        ` : ''}
        
        ${scene.cameras.length > 0 ? `
          <div class="scene-detail">
            <div class="scene-detail-label">相机分配 (${scene.cameras.length})</div>
            <div class="camera-assignments">
              ${cameraAssignments}
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

function render(): void {
  app.innerHTML = `
    ${renderHeader()}
    
    <div class="main-container">
      <aside class="sidebar-left">
        ${renderSceneList()}
        ${renderImportPanel()}
      </aside>
      
      <main class="main-content">
        ${renderTimeline()}
        ${renderSceneDetail()}
      </main>
      
      <aside class="sidebar-right">
        ${renderBatteryList()}
        ${renderChargerList()}
        ${renderRiskPanel()}
      </aside>
    </div>
    
    <footer class="footer">
      <div class="footer-content">
        电池轮换调度器 | 适用于小型影棚拍摄日电池管理
      </div>
    </footer>
  `;
  
  attachEventListeners();
}

function attachEventListeners(): void {
  document.getElementById('simulate-btn')?.addEventListener('click', () => {
    dispatch({ type: 'SET_SIMULATING', payload: true });
    
    setTimeout(() => {
      const result = runSimulation(state.currentSchedule);
      dispatch({ type: 'RUN_SIMULATION', payload: result });
    }, 300);
  });

  document.getElementById('undo-btn')?.addEventListener('click', () => {
    if (state.historyIndex > 0) {
      dispatch({ type: 'UNDO' });
    }
  });

  document.getElementById('redo-btn')?.addEventListener('click', () => {
    if (state.historyIndex < state.history.length - 1) {
      dispatch({ type: 'REDO' });
    }
  });

  document.getElementById('export-json-btn')?.addEventListener('click', () => {
    downloadJSON(state.currentSchedule, state.simulationResult);
  });

  document.getElementById('export-report-btn')?.addEventListener('click', () => {
    if (state.simulationResult) {
      downloadRiskReport(state.simulationResult);
    }
  });

  document.getElementById('load-sample-1')?.addEventListener('click', () => {
    dispatch({ type: 'LOAD_SCHEDULE', payload: JSON.parse(JSON.stringify(sampleSchedule)) });
  });

  document.getElementById('load-sample-2')?.addEventListener('click', () => {
    dispatch({ type: 'LOAD_SCHEDULE', payload: JSON.parse(JSON.stringify(sampleMidnightSchedule)) });
  });

  document.getElementById('clear-import-btn')?.addEventListener('click', () => {
    const textarea = document.getElementById('import-json') as HTMLTextAreaElement;
    if (textarea) {
      textarea.value = '';
    }
    importError = null;
    render();
  });

  document.getElementById('import-btn')?.addEventListener('click', () => {
    const textarea = document.getElementById('import-json') as HTMLTextAreaElement;
    if (!textarea || !textarea.value.trim()) {
      importError = '请输入 JSON 数据';
      render();
      return;
    }

    const result = parseSchedule(textarea.value);
    if (result.success && result.data) {
      importError = null;
      dispatch({ type: 'LOAD_SCHEDULE', payload: result.data });
    } else {
      importError = result.errors.map((e) => `${e.field}: ${e.message}`).join('\n');
      render();
    }
  });

  document.querySelectorAll('[data-scene-id]').forEach((el) => {
    el.addEventListener('click', () => {
      const sceneId = el.getAttribute('data-scene-id');
      if (sceneId) {
        dispatch({ type: 'SELECT_SCENE', payload: state.selectedScene === sceneId ? undefined : sceneId });
      }
    });
  });

  document.querySelectorAll('[data-battery-id]').forEach((el) => {
    el.addEventListener('click', () => {
      const batteryId = el.getAttribute('data-battery-id');
      if (batteryId) {
        dispatch({ type: 'SELECT_BATTERY', payload: state.selectedBattery === batteryId ? undefined : batteryId });
      }
    });
  });
}

document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
    e.preventDefault();
    if (e.shiftKey) {
      if (state.historyIndex < state.history.length - 1) {
        dispatch({ type: 'REDO' });
      }
    } else {
      if (state.historyIndex > 0) {
        dispatch({ type: 'UNDO' });
      }
    }
  }
});

render();
