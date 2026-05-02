/**
 * 抱石线路预排台 - 主应用
 */

import './style.css';
import { Scene3D } from './scene/Scene3D.js';
import { stateManager } from './core/stateManager.js';
import { createSampleSession } from './data/sampleData.js';
import { validateSession } from './core/validation.js';
import { analyzeRouteReachability } from './core/geometry.js';
import { HoldColors, Route, DifficultyLevel } from './core/dataModels.js';
import {
  exportSessionToJSON,
  importSessionFromJSON,
  exportRouteSetToMarkdown,
  exportHoldsToCSV,
  exportRoutesToCSV,
  downloadJSON,
  downloadMarkdown,
  downloadCSV,
  readFileAsText
} from './core/io.js';

// 全局变量
let scene3D = null;
let selectedRouteId = null;
let selectedHoldId = null;

// DOM 元素
const elements = {
  routeList: document.getElementById('route-list'),
  routeDetailSection: document.getElementById('route-detail-section'),
  routeName: document.getElementById('route-name'),
  routeDifficulty: document.getElementById('route-difficulty'),
  routeColorPicker: document.getElementById('route-color-picker'),
  routeIsKids: document.getElementById('route-is-kids'),
  routeNotes: document.getElementById('route-notes'),
  routeHoldCount: document.getElementById('route-hold-count'),
  routeHoldsList: document.getElementById('route-holds-list'),
  holdDetail: document.getElementById('hold-detail'),
  validationResults: document.getElementById('validation-results'),
  reachabilityAnalysis: document.getElementById('reachability-analysis'),
  statusText: document.getElementById('status-text'),
  btnUndo: document.getElementById('btn-undo'),
  btnRedo: document.getElementById('btn-redo'),
  btnNewSession: document.getElementById('btn-new-session'),
  btnSaveSession: document.getElementById('btn-save-session'),
  btnImport: document.getElementById('btn-import'),
  btnExport: document.getElementById('btn-export'),
  btnLoadSample: document.getElementById('btn-load-sample'),
  btnAddRoute: document.getElementById('btn-add-route'),
  btnSetStart: document.getElementById('btn-set-start'),
  btnSetEnd: document.getElementById('btn-set-end'),
  btnResetView: document.getElementById('btn-reset-view'),
  btnToggleGrid: document.getElementById('btn-toggle-grid'),
  fileInput: document.getElementById('file-input'),
  modalOverlay: document.getElementById('modal-overlay'),
  modalTitle: document.getElementById('modal-title'),
  modalContent: document.getElementById('modal-content'),
  modalFooter: document.getElementById('modal-footer'),
  modalClose: document.getElementById('modal-close'),
};

// ========== 初始化 ==========

function init() {
  initScene();
  initEventListeners();
  initUI();
  
  // 尝试从本地存储恢复
  const hasSavedData = stateManager.loadFromLocalStorage();
  if (hasSavedData && stateManager.session?.wall) {
    loadSessionToUI(stateManager.session);
  } else {
    updateStatus('欢迎使用抱石线路预排台！点击"加载示例"开始体验。');
  }
  
  updateUndoRedoButtons();
}

function initScene() {
  const container = document.getElementById('scene-3d');
  if (!container) {
    console.error('未找到 3D 场景容器');
    return;
  }
  
  scene3D = new Scene3D(container);
  
  // 绑定场景事件
  scene3D.on('clickHold', ({ holdId, position }) => {
    handleHoldClick(holdId);
  });
  
  scene3D.on('clickEmpty', () => {
    clearHoldSelection();
  });
  
  scene3D.on('dragStart', ({ holdId }) => {
    updateStatus(`正在拖拽岩点 ${holdId}...`);
  });
  
  scene3D.on('dragMove', ({ holdId, position }) => {
    // 实时更新数据
    if (stateManager.session?.wall) {
      stateManager.updateHold(holdId, {
        x: position.x,
        y: position.y,
        z: position.z
      });
    }
  });
  
  scene3D.on('dragEnd', ({ holdId, position }) => {
    updateStatus(`岩点 ${holdId} 已移动到 (${position.x.toFixed(2)}m, ${position.y.toFixed(2)}m)`);
    runValidation();
  });
}

function initUI() {
  // 初始化颜色选择器
  renderColorPicker();
}

function renderColorPicker() {
  const container = elements.routeColorPicker;
  container.innerHTML = '';
  
  Object.entries(HoldColors).forEach(([name, color]) => {
    const option = document.createElement('div');
    option.className = 'color-option';
    option.style.backgroundColor = color;
    option.dataset.colorName = name;
    option.dataset.color = color;
    option.title = name;
    
    option.addEventListener('click', () => {
      selectColor(name, color);
    });
    
    container.appendChild(option);
  });
}

function selectColor(colorName, color) {
  // 更新 UI
  document.querySelectorAll('.color-option').forEach(opt => {
    opt.classList.toggle('selected', opt.dataset.colorName === colorName);
  });
  
  // 更新选中线路
  if (selectedRouteId) {
    stateManager.updateRoute(selectedRouteId, {
      colorName,
      color
    });
    updateRouteList();
    renderCurrentRoute();
  }
}

// ========== 事件监听器 ==========

function initEventListeners() {
  // 工具栏按钮
  elements.btnUndo.addEventListener('click', () => {
    if (stateManager.undo()) {
      loadSessionToUI(stateManager.session);
      updateStatus('已撤销');
    }
  });
  
  elements.btnRedo.addEventListener('click', () => {
    if (stateManager.redo()) {
      loadSessionToUI(stateManager.session);
      updateStatus('已重做');
    }
  });
  
  elements.btnNewSession.addEventListener('click', () => {
    const session = stateManager.createNewSession('未命名方案');
    loadSessionToUI(session);
    updateStatus('已创建新方案');
  });
  
  elements.btnSaveSession.addEventListener('click', () => {
    showSaveModal();
  });
  
  elements.btnImport.addEventListener('click', () => {
    elements.fileInput.click();
  });
  
  elements.btnExport.addEventListener('click', () => {
    showExportModal();
  });
  
  elements.btnLoadSample.addEventListener('click', () => {
    loadSampleData();
  });
  
  // 线路按钮
  elements.btnAddRoute.addEventListener('click', () => {
    addNewRoute();
  });
  
  elements.btnSetStart.addEventListener('click', () => {
    if (selectedRouteId && selectedHoldId) {
      stateManager.updateRoute(selectedRouteId, { startHoldId: selectedHoldId });
      updateStatus('已设为起步点');
      renderCurrentRoute();
    }
  });
  
  elements.btnSetEnd.addEventListener('click', () => {
    if (selectedRouteId && selectedHoldId) {
      stateManager.updateRoute(selectedRouteId, { endHoldId: selectedHoldId });
      updateStatus('已设为结束点');
      renderCurrentRoute();
    }
  });
  
  // 视角控制
  elements.btnResetView.addEventListener('click', () => {
    scene3D.resetView();
  });
  
  // 文件输入
  elements.fileInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const content = await readFileAsText(file);
        const session = importSessionFromJSON(content);
        stateManager.setSession(session, false);
        loadSessionToUI(session);
        updateStatus(`已导入: ${file.name}`);
      } catch (err) {
        showErrorModal('导入失败', err.message);
      }
    }
    elements.fileInput.value = '';
  });
  
  // 表单变化
  elements.routeName.addEventListener('input', () => {
    if (selectedRouteId) {
      stateManager.updateRoute(selectedRouteId, { name: elements.routeName.value });
      updateRouteList();
    }
  });
  
  elements.routeDifficulty.addEventListener('change', () => {
    if (selectedRouteId) {
      stateManager.updateRoute(selectedRouteId, { difficulty: elements.routeDifficulty.value });
      updateRouteList();
    }
  });
  
  elements.routeIsKids.addEventListener('change', () => {
    if (selectedRouteId) {
      stateManager.updateRoute(selectedRouteId, { isKidsRoute: elements.routeIsKids.checked });
      runValidation();
    }
  });
  
  elements.routeNotes.addEventListener('input', () => {
    if (selectedRouteId) {
      stateManager.updateRoute(selectedRouteId, { notes: elements.routeNotes.value });
    }
  });
  
  // 模态框
  elements.modalClose.addEventListener('click', hideModal);
  elements.modalOverlay.addEventListener('click', (e) => {
    if (e.target === elements.modalOverlay) {
      hideModal();
    }
  });
  
  // 键盘快捷键
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          if (stateManager.redo()) {
            loadSessionToUI(stateManager.session);
          }
        } else {
          if (stateManager.undo()) {
            loadSessionToUI(stateManager.session);
          }
        }
      } else if (e.key === 'y') {
        e.preventDefault();
        if (stateManager.redo()) {
          loadSessionToUI(stateManager.session);
        }
      } else if (e.key === 's') {
        e.preventDefault();
        showSaveModal();
      }
    }
  });
  
  // 状态变化监听
  stateManager.on('sessionChanged', () => {
    stateManager.saveToLocalStorage();
    updateUndoRedoButtons();
  });
  
  stateManager.on('historyChanged', () => {
    updateUndoRedoButtons();
  });
}

// ========== 核心功能 ==========

function loadSampleData() {
  try {
    const session = createSampleSession();
    stateManager.setSession(session, false);
    loadSessionToUI(session);
    updateStatus('示例数据已加载，包含 ' + session.routes.length + ' 条线路');
  } catch (err) {
    console.error('加载示例数据失败:', err);
    showErrorModal('加载失败', err.message);
  }
}

function loadSessionToUI(session) {
  if (!session) return;
  
  // 渲染 3D 场景
  if (session.wall) {
    scene3D.renderWall(session.wall);
    scene3D.clearHolds();
    scene3D.renderHolds(session.wall.holds);
  }
  
  // 更新线路列表
  updateRouteList();
  
  // 清除选择
  selectedRouteId = null;
  selectedHoldId = null;
  clearHoldSelection();
  elements.routeDetailSection.style.display = 'none';
  
  // 运行校验
  runValidation();
}

function updateRouteList() {
  const session = stateManager.session;
  if (!session) return;
  
  const routes = session.routes || [];
  
  if (routes.length === 0) {
    elements.routeList.innerHTML = `
      <div class="empty-state">
        <p>暂无线路</p>
        <p class="hint">点击下方按钮添加</p>
      </div>
    `;
    return;
  }
  
  elements.routeList.innerHTML = routes.map(route => `
    <div class="route-item ${route.id === selectedRouteId ? 'selected' : ''}" data-route-id="${route.id}">
      <div class="route-color-dot" style="background-color: ${route.color}"></div>
      <div class="route-info">
        <div class="route-name">${route.name}</div>
        <div class="route-meta">${route.difficulty} · ${route.holdIds.length} 个岩点</div>
      </div>
      <button class="route-remove" data-route-id="${route.id}" title="删除线路">✕</button>
    </div>
  `).join('');
  
  // 绑定点击事件
  elements.routeList.querySelectorAll('.route-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('route-remove')) return;
      selectRoute(item.dataset.routeId);
    });
  });
  
  elements.routeList.querySelectorAll('.route-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const routeId = btn.dataset.routeId;
      if (confirm('确定要删除这条线路吗？')) {
        stateManager.removeRoute(routeId);
        if (selectedRouteId === routeId) {
          selectedRouteId = null;
          elements.routeDetailSection.style.display = 'none';
        }
        updateRouteList();
        runValidation();
        updateStatus('线路已删除');
      }
    });
  });
}

function selectRoute(routeId) {
  selectedRouteId = routeId;
  updateRouteList();
  
  const route = stateManager.session?.routes?.find(r => r.id === routeId);
  if (!route) return;
  
  // 显示详情面板
  elements.routeDetailSection.style.display = 'block';
  
  // 填充表单
  elements.routeName.value = route.name;
  elements.routeDifficulty.value = route.difficulty;
  elements.routeIsKids.checked = route.isKidsRoute;
  elements.routeNotes.value = route.notes || '';
  
  // 选中颜色
  document.querySelectorAll('.color-option').forEach(opt => {
    opt.classList.toggle('selected', opt.dataset.colorName === route.colorName);
  });
  
  // 渲染线路岩点列表
  renderRouteHoldsList(route);
  
  // 渲染 3D 线路
  if (stateManager.session?.wall) {
    scene3D.renderRoute(route, stateManager.session.wall.holds);
  }
  
  // 分析可达性
  renderReachabilityAnalysis(route);
}

function renderCurrentRoute() {
  if (!selectedRouteId) return;
  selectRoute(selectedRouteId);
}

function renderRouteHoldsList(route) {
  const wall = stateManager.session?.wall;
  if (!wall) return;
  
  const holdMap = new Map();
  wall.holds.forEach(h => holdMap.set(h.id, h));
  
  elements.routeHoldCount.textContent = route.holdIds.length;
  
  if (route.holdIds.length === 0) {
    elements.routeHoldsList.innerHTML = '<p class="empty-hint">点击 3D 墙面上的岩点添加到线路</p>';
    return;
  }
  
  // 按高度排序
  const sortedHolds = route.holdIds
    .map(id => holdMap.get(id))
    .filter(h => h)
    .sort((a, b) => a.y - b.y);
  
  elements.routeHoldsList.innerHTML = sortedHolds.map(hold => {
    let badges = [];
    if (hold.id === route.startHoldId) badges.push('<span class="route-hold-badge start">起步</span>');
    if (hold.id === route.endHoldId) badges.push('<span class="route-hold-badge end">结束</span>');
    
    return `
      <div class="route-hold-item in-route" data-hold-id="${hold.id}">
        <div class="route-hold-info">
          <div class="route-hold-pos">(${hold.x.toFixed(2)}m, ${hold.y.toFixed(2)}m)</div>
          <div class="route-hold-type">${getHoldTypeLabel(hold.type)}</div>
        </div>
        ${badges.join(' ')}
        <button class="route-hold-remove" data-hold-id="${hold.id}">✕</button>
      </div>
    `;
  }).join('');
  
  // 绑定事件
  elements.routeHoldsList.querySelectorAll('.route-hold-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('route-hold-remove')) return;
      const holdId = item.dataset.holdId;
      selectedHoldId = holdId;
      scene3D.focusOnHold(holdId);
      renderHoldDetail(holdId);
    });
  });
  
  elements.routeHoldsList.querySelectorAll('.route-hold-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const holdId = btn.dataset.holdId;
      stateManager.removeHoldFromRoute(route.id, holdId);
      renderCurrentRoute();
      updateStatus('岩点已从线路移除');
    });
  });
}

function handleHoldClick(holdId) {
  selectedHoldId = holdId;
  renderHoldDetail(holdId);
  
  // 如果有选中的线路，切换岩点在线路中的状态
  if (selectedRouteId) {
    const route = stateManager.session?.routes?.find(r => r.id === selectedRouteId);
    if (route) {
      if (route.holdIds.includes(holdId)) {
        stateManager.removeHoldFromRoute(route.id, holdId);
        updateStatus('岩点已从线路移除');
      } else {
        stateManager.addHoldToRoute(route.id, holdId);
        updateStatus('岩点已添加到线路');
      }
      renderCurrentRoute();
      runValidation();
    }
  }
}

function clearHoldSelection() {
  selectedHoldId = null;
  elements.holdDetail.innerHTML = '<p class="empty-hint">点击 3D 场景中的岩点查看详情</p>';
}

function renderHoldDetail(holdId) {
  const wall = stateManager.session?.wall;
  if (!wall) return;
  
  const hold = wall.holds.find(h => h.id === holdId);
  if (!hold) {
    clearHoldSelection();
    return;
  }
  
  // 检查是否在线路中
  const inRoutes = [];
  stateManager.session?.routes?.forEach(route => {
    if (route.holdIds.includes(holdId)) {
      inRoutes.push(route.name);
    }
  });
  
  elements.holdDetail.innerHTML = `
    <div class="hold-detail-row">
      <span class="hold-detail-label">ID</span>
      <span class="hold-detail-value">${hold.id}</span>
    </div>
    <div class="hold-detail-row">
      <span class="hold-detail-label">位置</span>
      <span class="hold-detail-value">(${hold.x.toFixed(2)}m, ${hold.y.toFixed(2)}m)</span>
    </div>
    <div class="hold-detail-row">
      <span class="hold-detail-label">类型</span>
      <span class="hold-detail-value">${getHoldTypeLabel(hold.type)}</span>
    </div>
    <div class="hold-detail-row">
      <span class="hold-detail-label">颜色</span>
      <span class="hold-detail-value">
        <div class="hold-detail-color" style="background-color: ${hold.color}"></div>
        ${hold.colorName || hold.color}
      </span>
    </div>
    <div class="hold-detail-row">
      <span class="hold-detail-label">尺寸</span>
      <span class="hold-detail-value">${(hold.size.width * 100).toFixed(0)} × ${(hold.size.height * 100).toFixed(0)} × ${(hold.size.depth * 100).toFixed(0)} cm</span>
    </div>
    <div class="hold-detail-row">
      <span class="hold-detail-label">所属线路</span>
      <span class="hold-detail-value">${inRoutes.length > 0 ? inRoutes.join(', ') : '无'}</span>
    </div>
  `;
}

function runValidation() {
  const session = stateManager.session;
  if (!session || !session.wall) {
    elements.validationResults.innerHTML = '<p class="empty-hint">加载数据后自动校验</p>';
    return;
  }
  
  const result = validateSession(session);
  const allIssues = result.getAll();
  
  if (allIssues.length === 0) {
    elements.validationResults.innerHTML = `
      <div class="validation-item info">
        <div class="validation-message">✓ 校验通过，未发现问题</div>
      </div>
    `;
    return;
  }
  
  elements.validationResults.innerHTML = allIssues.map(issue => `
    <div class="validation-item ${issue.type}">
      <div class="validation-message">${issue.message}</div>
      ${issue.context ? `<div class="validation-context">${formatValidationContext(issue.context)}</div>` : ''}
    </div>
  `).join('');
}

function renderReachabilityAnalysis(route) {
  const wall = stateManager.session?.wall;
  if (!wall) return;
  
  const analysis = analyzeRouteReachability(route, wall.holds);
  
  elements.reachabilityAnalysis.innerHTML = Object.entries(analysis).map(([key, result]) => {
    const hasIssues = result.issues?.length > 0;
    
    return `
      <div class="reachability-item">
        <div class="reachability-header">
          <span class="reachability-segment">${result.segment.label}</span>
          <span class="reachability-status ${hasIssues ? 'problem' : 'reachable'}">
            ${hasIssues ? '⚠ 有问题' : '✓ 可达'}
          </span>
        </div>
        ${hasIssues ? `
          <div class="reachability-issues">
            ${result.issues.slice(0, 3).map(issue => `<div>• ${issue}</div>`).join('')}
            ${result.issues.length > 3 ? `<div>... 还有 ${result.issues.length - 3} 个问题</div>` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

function addNewRoute() {
  const route = new Route({
    name: `新线路 ${(stateManager.session?.routes?.length || 0) + 1}`,
    difficulty: DifficultyLevel.V3,
    color: HoldColors.RED,
    colorName: 'RED',
    isKidsRoute: false
  });
  
  stateManager.addRoute(route);
  updateRouteList();
  selectRoute(route.id);
  updateStatus('已添加新线路，点击岩点添加到线路');
}

// ========== 导入导出 ==========

function showExportModal() {
  const session = stateManager.session;
  if (!session) {
    showErrorModal('导出失败', '请先加载或创建方案');
    return;
  }
  
  elements.modalTitle.textContent = '导出数据';
  elements.modalContent.innerHTML = `
    <div class="export-options">
      <div class="export-option" data-export-type="session">
        <div class="export-icon">📋</div>
        <div class="export-info">
          <h4>导出 Session JSON</h4>
          <p>包含墙面、岩点、所有线路的完整数据</p>
        </div>
      </div>
      <div class="export-option" data-export-type="markdown">
        <div class="export-icon">📝</div>
        <div class="export-info">
          <h4>导出定线说明 (Markdown)</h4>
          <p>线路详情、跨度分析、可达性报告</p>
        </div>
      </div>
      <div class="export-option" data-export-type="holds-csv">
        <div class="export-icon">📊</div>
        <div class="export-info">
          <h4>导出岩点清单 (CSV)</h4>
          <p>所有岩点的位置、类型、颜色等信息</p>
        </div>
      </div>
      <div class="export-option" data-export-type="routes-csv">
        <div class="export-icon">📈</div>
        <div class="export-info">
          <h4>导出线路统计 (CSV)</h4>
          <p>各线路的难度、岩点数、起步/结束点</p>
        </div>
      </div>
    </div>
  `;
  elements.modalFooter.innerHTML = `
    <button class="modal-btn secondary" id="modal-cancel">取消</button>
  `;
  
  // 绑定事件
  elements.modalContent.querySelectorAll('.export-option').forEach(option => {
    option.addEventListener('click', () => {
      const type = option.dataset.exportType;
      handleExport(type);
      hideModal();
    });
  });
  
  document.getElementById('modal-cancel')?.addEventListener('click', hideModal);
  
  showModal();
}

function handleExport(type) {
  const session = stateManager.session;
  if (!session) return;
  
  const timestamp = new Date().toISOString().slice(0, 10);
  
  try {
    switch (type) {
      case 'session':
        const sessionJson = exportSessionToJSON(session);
        downloadJSON(sessionJson, `bouldering-session-${timestamp}.json`);
        updateStatus('Session 已导出');
        break;
        
      case 'markdown':
        const markdown = exportRouteSetToMarkdown(session);
        downloadMarkdown(markdown, `route-set-${timestamp}.md`);
        updateStatus('定线说明已导出');
        break;
        
      case 'holds-csv':
        if (session.wall) {
          const holdsCsv = exportHoldsToCSV(session.wall, session.routes);
          downloadCSV(holdsCsv, `holds-${timestamp}.csv`);
          updateStatus('岩点清单已导出');
        }
        break;
        
      case 'routes-csv':
        const routesCsv = exportRoutesToCSV(session);
        downloadCSV(routesCsv, `routes-${timestamp}.csv`);
        updateStatus('线路统计已导出');
        break;
    }
  } catch (err) {
    showErrorModal('导出失败', err.message);
  }
}

function showSaveModal() {
  const session = stateManager.session;
  if (!session) {
    showErrorModal('保存失败', '请先创建方案');
    return;
  }
  
  elements.modalTitle.textContent = '保存方案';
  elements.modalContent.innerHTML = `
    <div class="form-group">
      <label>方案名称</label>
      <input type="text" id="save-session-name" class="form-input" value="${session.name || ''}" />
    </div>
    <div style="margin-top: 16px;">
      <p style="color: var(--text-secondary); font-size: 0.85rem;">
        方案将保存到浏览器本地存储中，同时也可以选择导出为 JSON 文件。
      </p>
    </div>
  `;
  elements.modalFooter.innerHTML = `
    <button class="modal-btn secondary" id="modal-cancel">取消</button>
    <button class="modal-btn primary" id="modal-save-confirm">保存</button>
  `;
  
  document.getElementById('modal-cancel')?.addEventListener('click', hideModal);
  document.getElementById('modal-save-confirm')?.addEventListener('click', () => {
    const name = document.getElementById('save-session-name')?.value || session.name;
    session.name = name;
    stateManager.saveToLocalStorage();
    hideModal();
    updateStatus(`方案已保存: ${name}`);
  });
  
  showModal();
}

function showErrorModal(title, message) {
  elements.modalTitle.textContent = title;
  elements.modalContent.innerHTML = `
    <div style="color: var(--error);">
      <p>${message}</p>
    </div>
  `;
  elements.modalFooter.innerHTML = `
    <button class="modal-btn primary" id="modal-ok">确定</button>
  `;
  
  document.getElementById('modal-ok')?.addEventListener('click', hideModal);
  showModal();
}

function showModal() {
  elements.modalOverlay.style.display = 'flex';
}

function hideModal() {
  elements.modalOverlay.style.display = 'none';
}

// ========== 辅助函数 ==========

function updateStatus(text) {
  elements.statusText.textContent = text;
  console.log('[Status]', text);
}

function updateUndoRedoButtons() {
  elements.btnUndo.disabled = !stateManager.canUndo;
  elements.btnRedo.disabled = !stateManager.canRedo;
}

function getHoldTypeLabel(type) {
  const labels = {
    jug: '大把手 (Jug)',
    crimp: '小抠点 (Crimp)',
    sloper: '斜坡点 (Sloper)',
    pocket: '指洞点 (Pocket)',
    pinch: '捏点 (Pinch)',
    foot: '脚点 (Foot)',
    volume: '造型岩点 (Volume)'
  };
  return labels[type] || type;
}

function formatValidationContext(context) {
  if (!context) return '';
  if (typeof context === 'string') return context;
  if (context.routes) {
    return `涉及线路: ${context.routes.map(r => r.routeName).join(', ')}`;
  }
  if (context.route) {
    return `线路: ${context.route.name}`;
  }
  return '';
}

// 启动应用
init();
