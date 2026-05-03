/**
 * 主入口文件
 * 整合所有模块，初始化游戏
 */

import { levelParser } from './modules/levelParser.js';
import { ruleEngine } from './modules/ruleEngine.js';
import { gameState } from './modules/gameState.js';
import { exporter } from './modules/exporter.js';
import { DragDropManager } from './modules/dragDrop.js';

// 关卡数据
import level1Data from './levels/level1.json' assert { type: 'json' };
import level2Data from './levels/level2.json' assert { type: 'json' };
import level3Data from './levels/level3.json' assert { type: 'json' };

// DOM 元素
const elements = {
  levelSelector: document.getElementById('levelSelector'),
  importLevelBtn: document.getElementById('importLevelBtn'),
  fileInput: document.getElementById('fileInput'),
  
  levelInfo: document.getElementById('levelInfo'),
  levelName: document.getElementById('levelName'),
  levelDescription: document.getElementById('levelDescription'),
  
  undoBtn: document.getElementById('undoBtn'),
  redoBtn: document.getElementById('redoBtn'),
  restartBtn: document.getElementById('restartBtn'),
  saveLayoutBtn: document.getElementById('saveLayoutBtn'),
  
  gameGrid: document.getElementById('gameGrid'),
  stallList: document.getElementById('stallList'),
  
  totalScore: document.getElementById('totalScore'),
  satisfactionScore: document.getElementById('satisfactionScore'),
  riskScore: document.getElementById('riskScore'),
  incomeScore: document.getElementById('incomeScore'),
  
  budgetText: document.getElementById('budgetText'),
  budgetProgress: document.getElementById('budgetProgress'),
  electricityText: document.getElementById('electricityText'),
  electricityProgress: document.getElementById('electricityProgress'),
  
  conflictList: document.getElementById('conflictList'),
  bonusList: document.getElementById('bonusList'),
  
  exportJSONBtn: document.getElementById('exportJSONBtn'),
  exportMarkdownBtn: document.getElementById('exportMarkdownBtn'),
  
  saveLayoutModal: document.getElementById('saveLayoutModal'),
  layoutNameInput: document.getElementById('layoutNameInput'),
  cancelSaveLayout: document.getElementById('cancelSaveLayout'),
  confirmSaveLayout: document.getElementById('confirmSaveLayout'),
  
  loadLayoutModal: document.getElementById('loadLayoutModal'),
  savedLayoutsList: document.getElementById('savedLayoutsList'),
  
  modalClose: document.querySelectorAll('.modal-close')
};

// 解析后的关卡
const levels = {
  level1: levelParser.parse(level1Data),
  level2: levelParser.parse(level2Data),
  level3: levelParser.parse(level3Data)
};

// 拖拽管理器
let dragDropManager = null;

// 当前评估结果
let currentEvaluation = null;

/**
 * 初始化应用
 */
function init() {
  // 初始化关卡选择器
  initLevelSelector();
  
  // 初始化事件监听
  initEventListeners();
  
  // 默认加载第一关
  loadLevel('level1');
}

/**
 * 初始化关卡选择器
 */
function initLevelSelector() {
  // 添加默认关卡
  Object.entries(levels).forEach(([id, level]) => {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = level.name;
    elements.levelSelector.appendChild(option);
  });
}

/**
 * 初始化事件监听
 */
function initEventListeners() {
  // 关卡选择
  elements.levelSelector.addEventListener('change', (e) => {
    if (e.target.value) {
      loadLevel(e.target.value);
    }
  });
  
  // 导入关卡
  elements.importLevelBtn.addEventListener('click', () => {
    elements.fileInput.click();
  });
  
  elements.fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const data = await exporter.importLevel(file);
        const parsedLevel = levelParser.parse(data);
        
        // 添加到关卡列表
        const customId = `custom_${Date.now()}`;
        levels[customId] = parsedLevel;
        
        // 添加到选择器
        const option = document.createElement('option');
        option.value = customId;
        option.textContent = `[导入] ${parsedLevel.name}`;
        elements.levelSelector.appendChild(option);
        elements.levelSelector.value = customId;
        
        // 加载新关卡
        loadLevel(customId);
        
        showToast('关卡导入成功！', 'success');
      } catch (error) {
        showToast(`导入失败: ${error.message}`, 'error');
      }
    }
    elements.fileInput.value = '';
  });
  
  // 撤销/重做
  elements.undoBtn.addEventListener('click', () => {
    if (gameState.canUndo()) {
      gameState.undo();
      updateUI();
    }
  });
  
  elements.redoBtn.addEventListener('click', () => {
    if (gameState.canRedo()) {
      gameState.redo();
      updateUI();
    }
  });
  
  // 重开
  elements.restartBtn.addEventListener('click', () => {
    gameState.restartLevel();
    updateUI();
    showToast('关卡已重置', 'info');
  });
  
  // 保存布局
  elements.saveLayoutBtn.addEventListener('click', () => {
    showSaveLayoutModal();
  });
  
  elements.cancelSaveLayout.addEventListener('click', () => {
    hideSaveLayoutModal();
  });
  
  elements.confirmSaveLayout.addEventListener('click', () => {
    const name = elements.layoutNameInput.value.trim();
    if (name) {
      gameState.saveLayout(name);
      hideSaveLayoutModal();
      elements.layoutNameInput.value = '';
      showToast('布局已保存！', 'success');
    } else {
      showToast('请输入布局名称', 'error');
    }
  });
  
  // 模态框关闭
  elements.modalClose.forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.modal').style.display = 'none';
    });
  });
  
  // 点击模态框外部关闭
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
      e.target.style.display = 'none';
    }
  });
  
  // 导出按钮
  elements.exportJSONBtn.addEventListener('click', () => {
    if (gameState.currentLevel && currentEvaluation) {
      exporter.exportAndDownloadJSON(
        gameState.currentLevel,
        gameState.placedStalls,
        currentEvaluation
      );
      showToast('JSON报告已导出！', 'success');
    } else {
      showToast('请先开始游戏', 'error');
    }
  });
  
  elements.exportMarkdownBtn.addEventListener('click', () => {
    if (gameState.currentLevel && currentEvaluation) {
      exporter.exportAndDownloadMarkdown(
        gameState.currentLevel,
        gameState.placedStalls,
        currentEvaluation
      );
      showToast('Markdown报告已导出！', 'success');
    } else {
      showToast('请先开始游戏', 'error');
    }
  });
}

/**
 * 加载关卡
 */
function loadLevel(levelId) {
  const level = levels[levelId];
  if (!level) {
    showToast('关卡不存在', 'error');
    return;
  }
  
  // 初始化游戏状态
  gameState.initLevel(level);
  
  // 初始化拖拽管理器
  if (!dragDropManager) {
    dragDropManager = new DragDropManager(gameState, ruleEngine);
    dragDropManager.init(
      document.body,
      elements.gameGrid,
      elements.stallList
    );
    dragDropManager.setCallback('onLayoutChange', updateUI);
  } else {
    dragDropManager.render();
  }
  
  // 更新关卡信息显示
  elements.levelInfo.style.display = 'block';
  elements.levelName.textContent = level.name;
  elements.levelDescription.textContent = level.description;
  
  // 更新选择器
  elements.levelSelector.value = levelId;
  
  // 更新UI
  updateUI();
  
  showToast(`已加载关卡: ${level.name}`, 'info');
}

/**
 * 更新UI
 */
function updateUI() {
  if (!gameState.currentLevel) return;
  
  // 重新渲染拖拽界面
  if (dragDropManager) {
    dragDropManager.render();
  }
  
  // 评估当前布局
  currentEvaluation = ruleEngine.evaluate(
    gameState.currentLevel,
    gameState.placedStalls
  );
  
  // 更新撤销/重做按钮状态
  elements.undoBtn.disabled = !gameState.canUndo();
  elements.redoBtn.disabled = !gameState.canRedo();
  
  // 更新评分显示
  updateScoreDisplay();
  
  // 更新资源显示
  updateResourceDisplay();
  
  // 更新冲突和加成列表
  updateConflictList();
  updateBonusList();
  
  // 检查是否是新最高分
  checkHighScore();
}

/**
 * 更新评分显示
 */
function updateScoreDisplay() {
  if (!currentEvaluation) return;
  
  elements.totalScore.textContent = currentEvaluation.score;
  elements.satisfactionScore.textContent = `${currentEvaluation.satisfaction.toFixed(0)}%`;
  elements.riskScore.textContent = `${currentEvaluation.risk.toFixed(0)}%`;
  elements.incomeScore.textContent = `¥${currentEvaluation.income}`;
  
  // 颜色变化
  if (currentEvaluation.satisfaction >= 75) {
    elements.satisfactionScore.style.color = '#4caf50';
  } else if (currentEvaluation.satisfaction >= 50) {
    elements.satisfactionScore.style.color = '#ff9800';
  } else {
    elements.satisfactionScore.style.color = '#f44336';
  }
  
  if (currentEvaluation.risk <= 30) {
    elements.riskScore.style.color = '#4caf50';
  } else if (currentEvaluation.risk <= 60) {
    elements.riskScore.style.color = '#ff9800';
  } else {
    elements.riskScore.style.color = '#f44336';
  }
}

/**
 * 更新资源显示
 */
function updateResourceDisplay() {
  if (!currentEvaluation) return;
  
  const budget = currentEvaluation.budget;
  const electricity = currentEvaluation.electricity;
  
  // 预算
  elements.budgetText.textContent = `${budget.used} / ${budget.total}`;
  const budgetPercent = Math.min(100, (budget.used / budget.total) * 100);
  elements.budgetProgress.style.width = `${budgetPercent}%`;
  
  if (budget.overrun) {
    elements.budgetProgress.className = 'progress-fill progress-red';
  } else {
    elements.budgetProgress.className = 'progress-fill progress-green';
  }
  
  // 电力
  elements.electricityText.textContent = `${electricity.used} / ${electricity.total}`;
  const electricityPercent = Math.min(100, (electricity.used / electricity.total) * 100);
  elements.electricityProgress.style.width = `${electricityPercent}%`;
  
  if (electricity.overload) {
    elements.electricityProgress.className = 'progress-fill progress-red';
  } else {
    elements.electricityProgress.className = 'progress-fill progress-blue';
  }
}

/**
 * 更新冲突列表
 */
function updateConflictList() {
  if (!currentEvaluation || currentEvaluation.conflicts.length === 0) {
    elements.conflictList.innerHTML = '<p class="empty-message">暂无冲突</p>';
    return;
  }
  
  let html = '';
  currentEvaluation.conflicts.forEach(conflict => {
    const severityClass = conflict.severity || '';
    html += `
      <div class="conflict-item ${severityClass}">
        <div class="conflict-message">${conflict.message}</div>
        <div class="conflict-penalty">惩罚: ${conflict.penalty} 分</div>
      </div>
    `;
  });
  
  elements.conflictList.innerHTML = html;
}

/**
 * 更新加成列表
 */
function updateBonusList() {
  if (!currentEvaluation || currentEvaluation.bonuses.length === 0) {
    elements.bonusList.innerHTML = '<p class="empty-message">暂未获得加成</p>';
    return;
  }
  
  let html = '';
  currentEvaluation.bonuses.forEach(bonus => {
    html += `
      <div class="bonus-item">
        <div class="bonus-message">${bonus.message}</div>
        <div class="bonus-amount">奖励: +${bonus.bonus} 分</div>
      </div>
    `;
  });
  
  elements.bonusList.innerHTML = html;
}

/**
 * 检查最高分
 */
function checkHighScore() {
  if (!gameState.currentLevel || !currentEvaluation) return;
  
  const currentScore = currentEvaluation.score;
  const levelId = gameState.currentLevel.id;
  const highScore = gameState.getHighScore(levelId);
  
  if (!highScore || currentScore > highScore.score) {
    // 自动保存最高分
    gameState.saveHighScore(levelId, currentScore, {
      placedStallsCount: gameState.placedStalls.length,
      evaluation: currentEvaluation
    });
  }
}

/**
 * 显示保存布局模态框
 */
function showSaveLayoutModal() {
  elements.saveLayoutModal.style.display = 'flex';
  elements.layoutNameInput.value = '';
  elements.layoutNameInput.focus();
}

/**
 * 隐藏保存布局模态框
 */
function hideSaveLayoutModal() {
  elements.saveLayoutModal.style.display = 'none';
}

/**
 * 显示提示信息
 */
function showToast(message, type = 'info') {
  // 创建临时提示
  const toast = document.createElement('div');
  toast.style.position = 'fixed';
  toast.style.top = '80px';
  toast.style.left = '50%';
  toast.style.transform = 'translateX(-50%)';
  toast.style.padding = '12px 24px';
  toast.style.borderRadius = '8px';
  toast.style.zIndex = '99999';
  toast.style.fontSize = '14px';
  toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
  toast.style.animation = 'slideIn 0.3s ease-out';
  
  if (type === 'error') {
    toast.style.backgroundColor = '#ffebee';
    toast.style.color = '#c62828';
    toast.style.border = '1px solid #ef9a9a';
  } else if (type === 'success') {
    toast.style.backgroundColor = '#e8f5e9';
    toast.style.color = '#2e7d32';
    toast.style.border = '1px solid #a5d6a7';
  } else {
    toast.style.backgroundColor = '#e3f2fd';
    toast.style.color = '#1565c0';
    toast.style.border = '1px solid #90caf9';
  }
  
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s, transform 0.3s';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(-10px)';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// 启动应用
document.addEventListener('DOMContentLoaded', init);

// 导出供调试
window.marketGame = {
  gameState,
  ruleEngine,
  levelParser,
  exporter,
  levels,
  currentEvaluation: () => currentEvaluation
};
