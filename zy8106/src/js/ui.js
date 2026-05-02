import { TASK_TYPE_INFO, PRIORITY_LEVELS, TASK_TYPES } from './constants.js';

class UI {
  constructor() {
    this.elements = {};
    this.draggedTask = null;
    this.callbacks = {};
  }

  init() {
    this.cacheElements();
    this.bindEvents();
  }

  cacheElements() {
    this.elements = {
      currentLevel: document.getElementById('current-level'),
      currentScore: document.getElementById('current-score'),
      batteryStatus: document.getElementById('battery-status'),
      batteryIndicator: document.getElementById('battery-indicator'),
      
      undoBtn: document.getElementById('undo-btn'),
      redoBtn: document.getElementById('redo-btn'),
      saveBtn: document.getElementById('save-btn'),
      loadBtn: document.getElementById('load-btn'),
      restartBtn: document.getElementById('restart-btn'),
      levelsBtn: document.getElementById('levels-btn'),
      
      taskList: document.getElementById('task-list'),
      schedulerGrid: document.getElementById('scheduler-grid'),
      channelCount: document.getElementById('channel-count'),
      slotCount: document.getElementById('slot-count'),
      
      interferenceStatus: document.getElementById('interference-status'),
      priorityList: document.getElementById('priority-list'),
      coverageStatus: document.getElementById('coverage-status'),
      
      submitBtn: document.getElementById('submit-btn'),
      clearBtn: document.getElementById('clear-btn'),
      leaderboardBtn: document.getElementById('leaderboard-btn'),
      
      levelsModal: document.getElementById('levels-modal'),
      levelsList: document.getElementById('levels-list'),
      closeLevelsBtn: document.getElementById('close-levels-btn'),
      
      leaderboardModal: document.getElementById('leaderboard-modal'),
      leaderboardContent: document.getElementById('leaderboard-content'),
      closeLeaderboardBtn: document.getElementById('close-leaderboard-btn'),
      
      reportModal: document.getElementById('report-modal'),
      reportContent: document.getElementById('report-content'),
      closeReportBtn: document.getElementById('close-report-btn'),
      nextLevelBtn: document.getElementById('next-level-btn'),
      
      saveModal: document.getElementById('save-modal'),
      closeSaveBtn: document.getElementById('close-save-btn'),
      
      loadModal: document.getElementById('load-modal'),
      saveList: document.getElementById('save-list'),
      closeLoadBtn: document.getElementById('close-load-btn'),
      
      welcomeModal: document.getElementById('welcome-modal'),
      startGameBtn: document.getElementById('start-game-btn')
    };
  }

  bindEvents() {
    this.elements.undoBtn.addEventListener('click', () => this.trigger('undo'));
    this.elements.redoBtn.addEventListener('click', () => this.trigger('redo'));
    this.elements.saveBtn.addEventListener('click', () => this.trigger('save'));
    this.elements.loadBtn.addEventListener('click', () => this.trigger('load'));
    this.elements.restartBtn.addEventListener('click', () => this.trigger('restart'));
    this.elements.levelsBtn.addEventListener('click', () => this.trigger('showLevels'));
    
    this.elements.submitBtn.addEventListener('click', () => this.trigger('submit'));
    this.elements.clearBtn.addEventListener('click', () => this.trigger('clear'));
    this.elements.leaderboardBtn.addEventListener('click', () => this.trigger('showLeaderboard'));
    
    this.elements.closeLevelsBtn.addEventListener('click', () => this.hideModal('levels'));
    this.elements.closeLeaderboardBtn.addEventListener('click', () => this.hideModal('leaderboard'));
    this.elements.closeReportBtn.addEventListener('click', () => this.hideModal('report'));
    this.elements.nextLevelBtn.addEventListener('click', () => this.trigger('nextLevel'));
    this.elements.closeSaveBtn.addEventListener('click', () => this.hideModal('save'));
    this.elements.closeLoadBtn.addEventListener('click', () => this.hideModal('load'));
    
    this.elements.startGameBtn.addEventListener('click', () => {
      this.hideModal('welcome');
      this.trigger('startGame');
    });
    
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          e.preventDefault();
          this.trigger('undo');
        } else if (e.key === 'y' || (e.shiftKey && e.key === 'z')) {
          e.preventDefault();
          this.trigger('redo');
        } else if (e.key === 's') {
          e.preventDefault();
          this.trigger('save');
        }
      }
    });
    
    ['levels', 'leaderboard', 'report', 'save', 'load'].forEach(modalType => {
      const modalEl = this.elements[`${modalType}Modal`];
      if (modalEl) {
        modalEl.addEventListener('click', (e) => {
          if (e.target === modalEl) {
            this.hideModal(modalType);
          }
        });
      }
    });
  }

  on(event, callback) {
    if (!this.callbacks[event]) {
      this.callbacks[event] = [];
    }
    this.callbacks[event].push(callback);
  }

  trigger(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(callback => callback(data));
    }
  }

  updateHeader(state, level) {
    if (level) {
      this.elements.currentLevel.textContent = `关卡: ${level.name}`;
      this.elements.channelCount.textContent = state.channels;
      this.elements.slotCount.textContent = state.slots;
    }
    this.elements.currentScore.textContent = `分数: ${state.score}`;
    this.elements.batteryStatus.textContent = `电量: ${Math.round(state.battery)}%`;
    this.updateBatteryIndicator(state.battery);
    this.updateUndoRedoButtons(state.canUndo, state.canRedo);
  }

  updateBatteryIndicator(battery) {
    const batteryBar = this.elements.batteryIndicator.querySelector('.battery-bar');
    if (batteryBar) {
      batteryBar.style.width = `${Math.max(0, battery)}%`;
      batteryBar.classList.remove('low', 'medium');
      
      if (battery < 20) {
        batteryBar.classList.add('low');
      } else if (battery < 50) {
        batteryBar.classList.add('medium');
      }
    }
  }

  updateUndoRedoButtons(canUndo, canRedo) {
    this.elements.undoBtn.disabled = !canUndo;
    this.elements.redoBtn.disabled = !canRedo;
  }

  renderTaskList(tasks) {
    this.elements.taskList.innerHTML = '';
    
    const unscheduledTasks = tasks.filter(t => !t.scheduled);
    const sortedTasks = [...unscheduledTasks].sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
    
    sortedTasks.forEach(task => {
      const taskCard = this.createTaskCard(task);
      this.elements.taskList.appendChild(taskCard);
    });
  }

  createTaskCard(task) {
    const taskInfo = TASK_TYPE_INFO[task.type];
    const card = document.createElement('div');
    card.className = `task-card ${task.type}`;
    card.dataset.taskId = task.id;
    card.draggable = true;
    
    const priorityClass = `priority-${task.priority}`;
    const priorityLabel = {
      [PRIORITY_LEVELS.HIGH]: '高',
      [PRIORITY_LEVELS.MEDIUM]: '中',
      [PRIORITY_LEVELS.LOW]: '低'
    }[task.priority];
    
    card.innerHTML = `
      <div class="task-priority ${priorityClass}">${priorityLabel}优先级</div>
      <div class="task-icon">${taskInfo.icon}</div>
      <div class="task-name">${task.name}</div>
      <div class="task-details">
        ${task.description}<br>
        功耗: ${task.powerConsumption}% | 覆盖: ${task.coverageRadius}单位
      </div>
    `;
    
    card.addEventListener('dragstart', (e) => this.handleDragStart(e, task));
    card.addEventListener('dragend', (e) => this.handleDragEnd(e));
    
    return card;
  }

  renderSchedulerGrid(state) {
    const { channels, slots, schedule, tasks } = state;
    const grid = this.elements.schedulerGrid;
    
    grid.innerHTML = '';
    grid.style.gridTemplateColumns = `repeat(${channels + 1}, 1fr)`;
    
    const corner = document.createElement('div');
    corner.className = 'grid-cell cell-header';
    grid.appendChild(corner);
    
    for (let c = 0; c < channels; c++) {
      const header = document.createElement('div');
      header.className = 'grid-cell cell-header';
      header.textContent = `频道 ${c + 1}`;
      grid.appendChild(header);
    }
    
    for (let s = 0; s < slots; s++) {
      const slotHeader = document.createElement('div');
      slotHeader.className = 'grid-cell slot-header';
      slotHeader.textContent = `时隙 ${s + 1}`;
      grid.appendChild(slotHeader);
      
      for (let c = 0; c < channels; c++) {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.dataset.channel = c;
        cell.dataset.slot = s;
        
        const scheduleKey = `${c}-${s}`;
        const taskId = schedule[scheduleKey];
        
        if (taskId) {
          const task = tasks.find(t => t.id === taskId);
          if (task) {
            cell.classList.add('occupied');
            const taskInfo = TASK_TYPE_INFO[task.type];
            
            cell.innerHTML = `
              <div class="slot-task" data-task-id="${task.id}">
                <span class="slot-icon">${taskInfo.icon}</span>
                <span class="slot-name">${task.name.substring(0, 6)}</span>
              </div>
            `;
            
            const slotTask = cell.querySelector('.slot-task');
            slotTask.addEventListener('click', (e) => {
              e.stopPropagation();
              this.trigger('removeTask', { taskId, channel: c, slot: s });
            });
            
            slotTask.addEventListener('dragstart', (e) => this.handleDragStart(e, task));
            slotTask.addEventListener('dragend', (e) => this.handleDragEnd(e));
            slotTask.draggable = true;
          }
        }
        
        cell.addEventListener('dragover', (e) => this.handleDragOver(e));
        cell.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        cell.addEventListener('drop', (e) => this.handleDrop(e, c, s));
        
        grid.appendChild(cell);
      }
    }
  }

  handleDragStart(e, task) {
    this.draggedTask = task;
    e.target.classList.add('dragging');
    
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', task.id);
    }
  }

  handleDragEnd(e) {
    e.target.classList.remove('dragging');
    this.draggedTask = null;
    
    document.querySelectorAll('.grid-cell.drag-over').forEach(cell => {
      cell.classList.remove('drag-over');
    });
  }

  handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  }

  handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
  }

  handleDrop(e, channel, slot) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    
    if (this.draggedTask) {
      this.trigger('dropTask', {
        task: this.draggedTask,
        channel,
        slot
      });
    }
  }

  updateStatusPanel(validation, batteryCheck, coverageCheck) {
    const interferenceEl = this.elements.interferenceStatus;
    
    if (validation.conflicts.length > 0) {
      interferenceEl.className = 'status-indicator error';
      interferenceEl.innerHTML = `
        <span class="status-icon">❌</span>
        <span>存在 ${validation.conflicts.length} 处干扰</span>
      `;
    } else if (validation.warnings.length > 0) {
      interferenceEl.className = 'status-indicator warning';
      interferenceEl.innerHTML = `
        <span class="status-icon">⚠️</span>
        <span>${validation.warnings[0]}</span>
      `;
    } else {
      interferenceEl.className = 'status-indicator';
      interferenceEl.innerHTML = `
        <span class="status-icon">✅</span>
        <span>无干扰</span>
      `;
    }
  }

  updatePriorityList(tasks) {
    const list = this.elements.priorityList;
    list.innerHTML = '';
    
    const priorityOrder = [PRIORITY_LEVELS.HIGH, PRIORITY_LEVELS.MEDIUM, PRIORITY_LEVELS.LOW];
    const priorityLabels = {
      [PRIORITY_LEVELS.HIGH]: '高优先级',
      [PRIORITY_LEVELS.MEDIUM]: '中优先级',
      [PRIORITY_LEVELS.LOW]: '低优先级'
    };
    
    priorityOrder.forEach(priority => {
      const tasksOfPriority = tasks.filter(t => t.priority === priority);
      if (tasksOfPriority.length > 0) {
        const unscheduled = tasksOfPriority.filter(t => !t.scheduled).length;
        const total = tasksOfPriority.length;
        
        const item = document.createElement('div');
        item.className = 'priority-item';
        item.innerHTML = `
          <span>${priorityLabels[priority]}</span>
          <span>${total - unscheduled}/${total}</span>
        `;
        list.appendChild(item);
      }
    });
  }

  updateCoverageStatus(tasks) {
    const status = this.elements.coverageStatus;
    status.innerHTML = '';
    
    const stations = tasks.filter(t => t.type === TASK_TYPES.STATION && t.scheduled);
    
    stations.forEach(station => {
      const item = document.createElement('div');
      item.className = 'coverage-item';
      item.innerHTML = `
        <span>${TASK_TYPE_INFO[TASK_TYPES.STATION].icon} ${station.name}</span>
        <span class="coverage-distance">覆盖: ${station.coverageRadius}单位</span>
      `;
      status.appendChild(item);
    });
    
    if (stations.length === 0) {
      const item = document.createElement('div');
      item.className = 'coverage-item';
      item.innerHTML = '<span style="color: #909090;">暂无活动基站</span>';
      status.appendChild(item);
    }
  }

  showModal(type) {
    const modalEl = this.elements[`${type}Modal`];
    if (modalEl) {
      modalEl.classList.remove('hidden');
    }
  }

  hideModal(type) {
    const modalEl = this.elements[`${type}Modal`];
    if (modalEl) {
      modalEl.classList.add('hidden');
    }
  }

  renderLevelsList(levels, currentLevelId) {
    this.elements.levelsList.innerHTML = '';
    
    levels.forEach(level => {
      const item = document.createElement('div');
      item.className = `level-item ${level.id === currentLevelId ? 'current' : ''}`;
      item.innerHTML = `
        <div class="level-info">
          <div class="level-name">${level.name}</div>
          <div class="level-desc">${level.description}</div>
          <div class="level-desc">任务数: ${level.taskCount} | 频道: ${level.channels} | 时隙: ${level.slots}</div>
        </div>
        ${level.id === currentLevelId ? '<span style="color: #4a9eff;">当前</span>' : ''}
      `;
      
      item.addEventListener('click', () => {
        this.trigger('selectLevel', level.id);
        this.hideModal('levels');
      });
      
      this.elements.levelsList.appendChild(item);
    });
    
    this.showModal('levels');
  }

  renderLeaderboard(levelScores, overallRanking, currentLevelId) {
    let html = '';
    
    if (levelScores && levelScores.length > 0) {
      html += `
        <div class="leaderboard-section">
          <h3>当前关卡排名</h3>
          <table class="leaderboard-table">
            <thead>
              <tr><th>排名</th><th>玩家</th><th>分数</th><th>时间</th></tr>
            </thead>
            <tbody>
              ${levelScores.map(score => `
                <tr>
                  <td class="rank-${score.rank}">#${score.rank}</td>
                  <td>${score.playerName}</td>
                  <td>${score.score}</td>
                  <td>${score.formattedTime}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } else {
      html += `
        <div class="leaderboard-section">
          <h3>当前关卡排名</h3>
          <p style="color: #909090; text-align: center; padding: 1rem;">暂无记录</p>
        </div>
      `;
    }
    
    if (overallRanking && overallRanking.length > 0) {
      html += `
        <div class="leaderboard-section">
          <h3>总排名</h3>
          <table class="leaderboard-table">
            <thead>
              <tr><th>排名</th><th>玩家</th><th>总分</th><th>关卡数</th></tr>
            </thead>
            <tbody>
              ${overallRanking.slice(0, 10).map(player => `
                <tr>
                  <td class="rank-${player.rank}">#${player.rank}</td>
                  <td>${player.playerName}</td>
                  <td>${player.totalScore}</td>
                  <td>${player.levelsCompleted}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }
    
    this.elements.leaderboardContent.innerHTML = html;
    this.showModal('leaderboard');
  }

  renderReport(report, level) {
    const { score, scoreDetails, validation, stats, optimizations } = report;
    
    let html = `
      <div class="report-section">
        <h3>最终得分</h3>
        <div style="text-align: center; font-size: 3rem; font-weight: bold; color: ${score >= 500 ? '#63ff96' : score >= 300 ? '#ffc863' : '#ff6363'};">
          ${score}
        </div>
      </div>
      
      <div class="report-section">
        <h3>统计信息</h3>
        <div class="report-stats">
          <div class="stat-item">
            <span class="stat-label">调度任务</span>
            <span class="stat-value ${stats.scheduledTasks === stats.totalTasks ? 'good' : 'warning'}">
              ${stats.scheduledTasks}/${stats.totalTasks}
            </span>
          </div>
          <div class="stat-item">
            <span class="stat-label">资源利用率</span>
            <span class="stat-value ${stats.utilizationRate >= 70 ? 'good' : stats.utilizationRate >= 40 ? 'warning' : 'bad'}">
              ${stats.utilizationRate}%
            </span>
          </div>
          <div class="stat-item">
            <span class="stat-label">剩余电量</span>
            <span class="stat-value ${stats.remainingBattery >= 50 ? 'good' : stats.remainingBattery >= 20 ? 'warning' : 'bad'}">
              ${Math.max(0, stats.remainingBattery)}%
            </span>
          </div>
          <div class="stat-item">
            <span class="stat-label">干扰数量</span>
            <span class="stat-value ${validation.conflicts.length === 0 ? 'good' : 'bad'}">
              ${validation.conflicts.length}
            </span>
          </div>
        </div>
      </div>
    `;
    
    if (scoreDetails && scoreDetails.length > 0) {
      html += `
        <div class="report-section">
          <h3>得分明细</h3>
          <table class="leaderboard-table">
            <thead>
              <tr><th>类别</th><th>得分</th><th>说明</th></tr>
            </thead>
            <tbody>
              ${scoreDetails.map(detail => `
                <tr>
                  <td>${detail.category}</td>
                  <td style="color: ${detail.points >= 0 ? '#63ff96' : '#ff6363'};">${detail.points > 0 ? '+' : ''}${detail.points}</td>
                  <td>${detail.description}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }
    
    if (validation.conflicts && validation.conflicts.length > 0) {
      html += `
        <div class="report-section">
          <h3>冲突记录</h3>
          <ul class="conflict-list">
            ${validation.conflicts.map(c => `<li>${c.message}</li>`).join('')}
          </ul>
        </div>
      `;
    }
    
    if (optimizations && optimizations.length > 0) {
      html += `
        <div class="report-section">
          <h3>优化建议</h3>
          <ul class="optimization-list">
            ${optimizations.map(o => `<li>${o.message}</li>`).join('')}
          </ul>
        </div>
      `;
    }
    
    this.elements.reportContent.innerHTML = html;
    this.showModal('report');
  }

  renderSaveList(saves) {
    this.elements.saveList.innerHTML = '';
    
    if (saves.length === 0) {
      const item = document.createElement('div');
      item.className = 'save-item';
      item.innerHTML = '<span style="color: #909090;">暂无存档</span>';
      this.elements.saveList.appendChild(item);
    } else {
      saves.forEach(save => {
        const item = document.createElement('div');
        item.className = 'save-item';
        item.innerHTML = `
          <div class="save-info">
            <div class="level-name">关卡: ${save.levelId}</div>
            <div class="level-desc">保存时间: ${save.metadata?.savedAt || formatTime(save.timestamp)}</div>
            ${save.metadata?.recovered ? '<div style="color: #ffc863;">已从损坏存档恢复</div>' : ''}
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button class="load-btn" style="padding: 0.5rem 1rem; background: rgba(74, 158, 255, 0.3); border: none; border-radius: 4px; color: #4a9eff; cursor: pointer;">
              读取
            </button>
            <button class="delete-btn" style="padding: 0.5rem 1rem; background: rgba(255, 99, 99, 0.3); border: none; border-radius: 4px; color: #ff6363; cursor: pointer;">
              删除
            </button>
          </div>
        `;
        
        item.querySelector('.load-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          this.trigger('loadSave', save.id);
          this.hideModal('load');
        });
        
        item.querySelector('.delete-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          this.trigger('deleteSave', save.id);
        });
        
        this.elements.saveList.appendChild(item);
      });
    }
    
    this.showModal('load');
  }

  showSaveSuccess() {
    this.showModal('save');
    setTimeout(() => this.hideModal('save'), 2000);
  }

  updateConflicts(conflicts) {
    document.querySelectorAll('.grid-cell.conflict').forEach(cell => {
      cell.classList.remove('conflict');
    });
    
    conflicts.forEach(conflict => {
      if (conflict.type === 'same_channel_interference') {
        const cells = document.querySelectorAll(
          `.grid-cell[data-channel="${conflict.channel}"][data-slot="${conflict.slot}"]`
        );
        cells.forEach(cell => cell.classList.add('conflict'));
      } else if (conflict.type === 'proximity_interference') {
        conflict.slots.forEach(slot => {
          const cells = document.querySelectorAll(
            `.grid-cell[data-channel="${conflict.channel}"][data-slot="${slot}"]`
          );
          cells.forEach(cell => cell.classList.add('conflict'));
        });
      }
    });
  }

  showMessage(message, type = 'info') {
    const messageEl = document.createElement('div');
    messageEl.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 1rem 2rem;
      border-radius: 8px;
      z-index: 2000;
      animation: slideDown 0.3s ease;
      font-weight: 500;
    `;
    
    const colors = {
      info: 'background: rgba(74, 158, 255, 0.9); color: white;',
      success: 'background: rgba(99, 255, 150, 0.9); color: #1a1a2e;',
      warning: 'background: rgba(255, 200, 99, 0.9); color: #1a1a2e;',
      error: 'background: rgba(255, 99, 99, 0.9); color: white;'
    };
    
    messageEl.style.cssText += colors[type] || colors.info;
    messageEl.textContent = message;
    
    document.body.appendChild(messageEl);
    
    setTimeout(() => {
      messageEl.style.opacity = '0';
      messageEl.style.transition = 'opacity 0.3s ease';
      setTimeout(() => messageEl.remove(), 300);
    }, 3000);
  }
}

export const ui = new UI();
export default UI;
