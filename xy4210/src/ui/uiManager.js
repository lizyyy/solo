/**
 * UI管理模块
 * 管理所有UI组件的渲染和交互
 */

import {
  UnitType,
  EventType,
  UnitStatus,
  EventStatus,
  GameStatus
} from '../types/index.js';

import {
  getUnitTypeName,
  getUnitStatusDescription,
  getUnitIcon
} from '../units/unitManager.js';

import {
  getDeckRemaining,
  getActiveEvents
} from '../state/gameState.js';

/**
 * 更新游戏信息显示
 * @param {Object} gameState - 游戏状态
 */
export function updateGameInfo(gameState) {
  const turnDisplay = document.getElementById('turn-display');
  const reputationDisplay = document.getElementById('reputation-display');
  const activeEventsDisplay = document.getElementById('active-events-display');
  
  if (turnDisplay) {
    turnDisplay.textContent = `回合: ${gameState.turn}`;
  }
  
  if (reputationDisplay) {
    reputationDisplay.textContent = `信誉: ${gameState.reputation}`;
    // 根据信誉值改变颜色
    if (gameState.reputation >= 70) {
      reputationDisplay.style.color = '#4caf50';
    } else if (gameState.reputation >= 40) {
      reputationDisplay.style.color = '#ff9800';
    } else {
      reputationDisplay.style.color = '#f44336';
    }
  }
  
  if (activeEventsDisplay) {
    const activeEvents = getActiveEvents(gameState);
    activeEventsDisplay.textContent = `当前事件: ${activeEvents.length}`;
  }
}

/**
 * 渲染单位列表
 * @param {Object} gameState - 游戏状态
 * @param {Function} onUnitClick - 单位点击回调
 */
export function renderUnitsList(gameState, onUnitClick) {
  const container = document.getElementById('units-list');
  if (!container) return;
  
  container.innerHTML = '';
  
  gameState.units.forEach(unit => {
    const unitElement = createUnitElement(unit, gameState.selectedUnitId);
    
    unitElement.addEventListener('click', () => {
      if (onUnitClick) {
        onUnitClick(unit);
      }
    });
    
    container.appendChild(unitElement);
  });
}

/**
 * 创建单位元素
 * @param {Object} unit - 单位对象
 * @param {string} selectedUnitId - 选中的单位ID
 * @returns {HTMLElement} 单位元素
 */
function createUnitElement(unit, selectedUnitId) {
  const element = document.createElement('div');
  element.className = 'unit-item';
  
  if (unit.id === selectedUnitId) {
    element.classList.add('selected');
  }
  
  const typeName = getUnitTypeName(unit.type);
  const statusDescription = getUnitStatusDescription(unit);
  const icon = getUnitIcon(unit.type);
  
  element.innerHTML = `
    <div class="unit-name">
      <span>${icon}</span>
      <span>${typeName}</span>
    </div>
    <div class="unit-status">
      状态: ${statusDescription}
    </div>
    <div class="unit-status">
      位置: (${unit.position.x}, ${unit.position.y})
    </div>
  `;
  
  return element;
}

/**
 * 渲染事件列表
 * @param {Object} gameState - 游戏状态
 * @param {Function} onEventClick - 事件点击回调
 */
export function renderEventsList(gameState, onEventClick) {
  const container = document.getElementById('events-list');
  if (!container) return;
  
  container.innerHTML = '';
  
  const activeEvents = gameState.events.filter(e => e.status === EventStatus.ACTIVE);
  
  if (activeEvents.length === 0) {
    const emptyElement = document.createElement('div');
    emptyElement.textContent = '暂无活跃事件';
    emptyElement.style.color = '#888';
    emptyElement.style.fontStyle = 'italic';
    container.appendChild(emptyElement);
    return;
  }
  
  // 按剩余时间排序
  activeEvents.sort((a, b) => a.timeRemaining - b.timeRemaining);
  
  activeEvents.forEach(event => {
    const eventElement = createEventElement(event);
    
    eventElement.addEventListener('click', () => {
      if (onEventClick) {
        onEventClick(event);
      }
    });
    
    container.appendChild(eventElement);
  });
}

/**
 * 创建事件元素
 * @param {Object} event - 事件对象
 * @returns {HTMLElement} 事件元素
 */
function createEventElement(event) {
  const element = document.createElement('div');
  element.className = 'event-item';
  
  // 紧急事件标记
  if (event.timeRemaining <= 2) {
    element.classList.add('urgent');
  }
  
  const eventTypeName = getEventTypeName(event.type);
  const eventIcon = getEventIcon(event.type);
  const isAssigned = event.assignedUnitId !== null;
  
  element.innerHTML = `
    <div class="event-type">
      <span>${eventIcon}</span>
      <span>${eventTypeName}</span>
    </div>
    <div class="event-time">
      剩余: ${event.timeRemaining} 回合
    </div>
    <div style="font-size: 0.8rem; color: #888; margin-top: 5px;">
      位置: (${event.position.x}, ${event.position.y})
      ${isAssigned ? ' | 已分配单位' : ' | 待处理'}
    </div>
  `;
  
  return element;
}

/**
 * 更新牌堆显示
 * @param {Object} gameState - 游戏状态
 */
export function updateDeckDisplay(gameState) {
  const deckCount = document.getElementById('deck-count');
  if (deckCount) {
    deckCount.textContent = getDeckRemaining(gameState);
  }
}

/**
 * 渲染游戏日志
 * @param {Object} gameState - 游戏状态
 */
export function renderGameLog(gameState) {
  const container = document.getElementById('game-log');
  if (!container) return;
  
  container.innerHTML = '';
  
  // 显示最近的20条日志
  const recentLogs = gameState.log.slice(-20);
  
  recentLogs.forEach(logEntry => {
    const logElement = document.createElement('div');
    logElement.className = `log-entry log-${logEntry.type}`;
    logElement.textContent = `[回合${logEntry.turn}] ${logEntry.message}`;
    container.appendChild(logElement);
  });
  
  // 滚动到底部
  container.scrollTop = container.scrollHeight;
}

/**
 * 获取事件类型名称
 * @param {string} eventType - 事件类型
 * @returns {string} 事件名称
 */
function getEventTypeName(eventType) {
  const typeNames = {
    [EventType.INJURY]: '受伤事件',
    [EventType.POWER]: '断电事件',
    [EventType.BLOCKAGE]: '堵塞事件',
    [EventType.SHORTAGE]: '物资短缺'
  };
  return typeNames[eventType] || eventType;
}

/**
 * 获取事件图标
 * @param {string} eventType - 事件类型
 * @returns {string} 图标
 */
function getEventIcon(eventType) {
  const icons = {
    [EventType.INJURY]: '🩸',
    [EventType.POWER]: '⚡',
    [EventType.BLOCKAGE]: '🚧',
    [EventType.SHORTAGE]: '📦'
  };
  return icons[eventType] || '❓';
}

/**
 * 显示游戏结束模态框
 * @param {Object} gameState - 游戏状态
 * @param {Function} onPlayAgain - 再玩一次回调
 */
export function showGameOverModal(gameState, onPlayAgain) {
  const modal = document.getElementById('game-over-modal');
  const title = document.getElementById('game-result-title');
  const message = document.getElementById('game-result-message');
  const stats = document.getElementById('game-stats');
  const playAgainBtn = document.getElementById('play-again-btn');
  
  if (!modal) return;
  
  // 计算统计数据
  const resolvedEvents = gameState.events.filter(e => e.status === EventStatus.RESOLVED).length;
  const expiredEvents = gameState.events.filter(e => e.status === EventStatus.EXPIRED).length;
  
  if (gameState.status === GameStatus.WON) {
    title.textContent = '🎉 游戏胜利！';
    message.textContent = '恭喜你成功完成了救援任务！城市的安全因为你的努力而得到保障。';
    title.style.color = '#4caf50';
  } else {
    title.textContent = '😢 游戏失败';
    message.textContent = '很遗憾，救援任务失败了。请重新尝试，合理调度你的单位！';
    title.style.color = '#f44336';
  }
  
  if (stats) {
    stats.innerHTML = `
      <div><strong>最终回合:</strong> ${gameState.turn}</div>
      <div><strong>最终信誉:</strong> ${gameState.reputation}</div>
      <div><strong>已解决事件:</strong> ${resolvedEvents}</div>
      <div><strong>超时事件:</strong> ${expiredEvents}</div>
    `;
  }
  
  // 添加再玩一次事件
  if (playAgainBtn) {
    // 移除旧的事件监听器
    const newBtn = playAgainBtn.cloneNode(true);
    playAgainBtn.parentNode.replaceChild(newBtn, playAgainBtn);
    
    newBtn.addEventListener('click', () => {
      hideGameOverModal();
      if (onPlayAgain) {
        onPlayAgain();
      }
    });
  }
  
  modal.classList.remove('hidden');
}

/**
 * 隐藏游戏结束模态框
 */
export function hideGameOverModal() {
  const modal = document.getElementById('game-over-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

/**
 * 显示回放模态框
 * @param {Object} replayController - 回放控制器
 * @param {Function} onClose - 关闭回调
 */
export function showReplayModal(replayController, onClose) {
  const modal = document.getElementById('replay-modal');
  if (!modal) return;
  
  modal.classList.remove('hidden');
  
  // 设置回放控制事件
  setupReplayControls(replayController);
  
  // 关闭按钮
  const closeBtn = document.getElementById('close-replay-btn');
  if (closeBtn) {
    const newBtn = closeBtn.cloneNode(true);
    closeBtn.parentNode.replaceChild(newBtn, closeBtn);
    
    newBtn.addEventListener('click', () => {
      replayController.destroy();
      hideReplayModal();
      if (onClose) {
        onClose();
      }
    });
  }
}

/**
 * 设置回放控制
 * @param {Object} replayController - 回放控制器
 */
function setupReplayControls(replayController) {
  const startBtn = document.getElementById('replay-start-btn');
  const pauseBtn = document.getElementById('replay-pause-btn');
  const nextBtn = document.getElementById('replay-next-btn');
  const stepDisplay = document.getElementById('replay-step');
  
  // 步骤变化回调
  replayController.setOnStepChange((step, index, total) => {
    if (stepDisplay) {
      stepDisplay.textContent = `步骤: ${index + 1}/${total}`;
    }
    
    // 渲染回放地图和日志
    if (step) {
      renderReplayMap(step.state);
      renderReplayLog(step);
    }
  });
  
  // 开始按钮
  if (startBtn) {
    const newBtn = startBtn.cloneNode(true);
    startBtn.parentNode.replaceChild(newBtn, startBtn);
    
    newBtn.addEventListener('click', () => {
      replayController.play();
    });
  }
  
  // 暂停按钮
  if (pauseBtn) {
    const newBtn = pauseBtn.cloneNode(true);
    pauseBtn.parentNode.replaceChild(newBtn, pauseBtn);
    
    newBtn.addEventListener('click', () => {
      replayController.pause();
    });
  }
  
  // 下一步按钮
  if (nextBtn) {
    const newBtn = nextBtn.cloneNode(true);
    nextBtn.parentNode.replaceChild(newBtn, nextBtn);
    
    newBtn.addEventListener('click', () => {
      replayController.next();
    });
  }
  
  // 初始显示
  const totalSteps = replayController.getTotalSteps();
  if (stepDisplay && totalSteps > 0) {
    stepDisplay.textContent = `步骤: 0/${totalSteps}`;
  }
}

/**
 * 渲染回放地图
 * @param {Object} gameState - 游戏状态
 */
function renderReplayMap(gameState) {
  const container = document.getElementById('replay-map');
  if (!container) return;
  
  // 简单渲染（这里可以复用地图渲染逻辑）
  container.innerHTML = '';
  
  const { map, units, events, config } = gameState;
  
  container.style.gridTemplateColumns = `repeat(${config.mapWidth}, 40px)`;
  container.style.gridTemplateRows = `repeat(${config.mapHeight}, 40px)`;
  
  for (let y = 0; y < config.mapHeight; y++) {
    for (let x = 0; x < config.mapWidth; x++) {
      const cell = map[y][x];
      const cellElement = document.createElement('div');
      cellElement.className = 'grid-cell';
      cellElement.style.width = '40px';
      cellElement.style.height = '40px';
      cellElement.style.fontSize = '1.2rem';
      
      // 设置单元格类型
      if (cell.type === 'building') {
        cellElement.classList.add('cell-building');
      } else if (cell.type === 'blocked' || cell.isBlocked) {
        cellElement.classList.add('cell-blocked');
      } else {
        cellElement.classList.add('cell-road');
      }
      
      // 检查单位
      const unit = units.find(u => u.position.x === x && u.position.y === y);
      if (unit) {
        cellElement.classList.add(`unit-${unit.type}`);
      }
      
      // 检查事件
      const event = events.find(e => 
        e.position.x === x && 
        e.position.y === y && 
        e.status === EventStatus.ACTIVE
      );
      if (event) {
        cellElement.classList.add(`event-${event.type}`);
      }
      
      container.appendChild(cellElement);
    }
  }
}

/**
 * 渲染回放日志
 * @param {Object} step - 回放步骤
 */
function renderReplayLog(step) {
  const container = document.getElementById('replay-log');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (step.action) {
    const actionElement = document.createElement('div');
    actionElement.className = 'log-entry log-action';
    actionElement.textContent = `[动作] ${step.action}`;
    container.appendChild(actionElement);
  }
  
  if (step.state && step.state.log) {
    const recentLogs = step.state.log.slice(-10);
    recentLogs.forEach(logEntry => {
      const logElement = document.createElement('div');
      logElement.className = `log-entry log-${logEntry.type}`;
      logElement.textContent = `[回合${logEntry.turn}] ${logEntry.message}`;
      container.appendChild(logElement);
    });
  }
}

/**
 * 隐藏回放模态框
 */
export function hideReplayModal() {
  const modal = document.getElementById('replay-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

/**
 * 更新所有UI
 * @param {Object} gameState - 游戏状态
 * @param {Object} options - 选项
 */
export function updateAllUI(gameState, options = {}) {
  const { onUnitClick, onEventClick } = options;
  
  updateGameInfo(gameState);
  renderUnitsList(gameState, onUnitClick);
  renderEventsList(gameState, onEventClick);
  updateDeckDisplay(gameState);
  renderGameLog(gameState);
}
