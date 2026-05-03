/**
 * UI交互控制模块
 * 负责处理所有用户界面交互，包括渲染、拖拽、事件监听等
 */

import { levelLoader } from './levelLoader.js';
import { gameState } from './gameState.js';

export const uiController = {
  // DOM元素引用
  _elements: {},
  
  // 当前拖拽的患者ID
  _draggedPatientId: null,
  
  // 反馈信息显示超时
  _feedbackTimeout: null,

  /**
   * 初始化UI控制器
   */
  init() {
    // 获取所有DOM元素
    this._getElements();
    
    // 绑定事件监听
    this._bindEvents();
    
    // 初始化UI显示
    this._updateUI();
    
    // 加载关卡列表
    this._loadLevelList();
  },

  /**
   * 获取所有需要的DOM元素
   */
  _getElements() {
    // 游戏控制按钮
    this._elements.startBtn = document.getElementById('start-btn');
    this._elements.pauseBtn = document.getElementById('pause-btn');
    this._elements.levelSelectBtn = document.getElementById('level-select-btn');
    this._elements.historyBtn = document.getElementById('history-btn');
    
    // 游戏信息显示
    this._elements.timeDisplay = document.getElementById('time');
    this._elements.scoreDisplay = document.getElementById('score');
    this._elements.comboDisplay = document.getElementById('combo');
    
    // 患者队列
    this._elements.queueContainer = document.getElementById('queue-container');
    
    // 分诊区域
    this._elements.triageZones = {
      red: document.getElementById('red-zone'),
      yellow: document.getElementById('yellow-zone'),
      green: document.getElementById('green-zone'),
      black: document.getElementById('black-zone')
    };
    
    this._elements.zonePatients = {
      red: document.getElementById('red-patients'),
      yellow: document.getElementById('yellow-patients'),
      green: document.getElementById('green-patients'),
      black: document.getElementById('black-patients')
    };
    
    // 反馈区域
    this._elements.feedback = document.getElementById('feedback');
    
    // 弹窗
    this._elements.levelModal = document.getElementById('level-modal');
    this._elements.historyModal = document.getElementById('history-modal');
    this._elements.gameOverModal = document.getElementById('game-over-modal');
    this._elements.pauseModal = document.getElementById('pause-modal');
    
    // 弹窗内容
    this._elements.levelList = document.getElementById('level-list');
    this._elements.historyList = document.getElementById('history-list');
    this._elements.gameResult = document.getElementById('game-result');
    this._elements.pauseSummary = document.getElementById('pause-summary');
    
    // 弹窗按钮
    this._elements.closeLevelModal = document.getElementById('close-level-modal');
    this._elements.closeHistoryModal = document.getElementById('close-history-modal');
    this._elements.closeGameOver = document.getElementById('close-game-over');
    this._elements.exportReport = document.getElementById('export-report');
    this._elements.replayBtn = document.getElementById('replay-btn');
    this._elements.resumeBtn = document.getElementById('resume-btn');
    this._elements.endGameBtn = document.getElementById('end-game-btn');
  },

  /**
   * 绑定所有事件监听
   */
  _bindEvents() {
    // 游戏控制按钮
    if (this._elements.startBtn) {
      this._elements.startBtn.addEventListener('click', () => this._handleStartGame());
    }
    
    if (this._elements.pauseBtn) {
      this._elements.pauseBtn.addEventListener('click', () => this._handlePauseGame());
    }
    
    if (this._elements.levelSelectBtn) {
      this._elements.levelSelectBtn.addEventListener('click', () => this._showLevelModal());
    }
    
    if (this._elements.historyBtn) {
      this._elements.historyBtn.addEventListener('click', () => this._showHistoryModal());
    }
    
    // 弹窗关闭按钮
    if (this._elements.closeLevelModal) {
      this._elements.closeLevelModal.addEventListener('click', () => this._hideLevelModal());
    }
    
    if (this._elements.closeHistoryModal) {
      this._elements.closeHistoryModal.addEventListener('click', () => this._hideHistoryModal());
    }
    
    if (this._elements.closeGameOver) {
      this._elements.closeGameOver.addEventListener('click', () => this._hideGameOverModal());
    }
    
    if (this._elements.replayBtn) {
      this._elements.replayBtn.addEventListener('click', () => this._handleReplay());
    }
    
    if (this._elements.resumeBtn) {
      this._elements.resumeBtn.addEventListener('click', () => this._handleResumeGame());
    }
    
    if (this._elements.endGameBtn) {
      this._elements.endGameBtn.addEventListener('click', () => this._handleEndGame());
    }
    
    // 分诊区域拖拽事件
    Object.values(this._elements.triageZones).forEach(zone => {
      if (zone) {
        zone.addEventListener('dragover', (e) => this._handleDragOver(e));
        zone.addEventListener('dragenter', (e) => this._handleDragEnter(e));
        zone.addEventListener('dragleave', (e) => this._handleDragLeave(e));
        zone.addEventListener('drop', (e) => this._handleDrop(e));
      }
    });
    
    // 点击弹窗外部关闭
    document.addEventListener('click', (e) => {
      if (e.target === this._elements.levelModal) {
        this._hideLevelModal();
      }
      if (e.target === this._elements.historyModal) {
        this._hideHistoryModal();
      }
      if (e.target === this._elements.gameOverModal) {
        this._hideGameOverModal();
      }
    });
  },

  /**
   * 更新UI显示
   */
  _updateUI() {
    // 更新游戏信息
    this._updateTimeDisplay();
    this._updateScoreDisplay();
    this._updateComboDisplay();
    
    // 更新按钮状态
    this._updateButtonStates();
  },

  /**
   * 更新时间显示
   */
  _updateTimeDisplay() {
    if (this._elements.timeDisplay) {
      const remainingTime = gameState.getRemainingTime();
      this._elements.timeDisplay.textContent = levelLoader.formatTime(remainingTime);
      
      // 时间不足时改变颜色
      if (remainingTime <= 30) {
        this._elements.timeDisplay.classList.add('time-warning');
      } else {
        this._elements.timeDisplay.classList.remove('time-warning');
      }
    }
  },

  /**
   * 更新分数显示
   */
  _updateScoreDisplay() {
    if (this._elements.scoreDisplay) {
      this._elements.scoreDisplay.textContent = gameState.getScore();
    }
  },

  /**
   * 更新连击显示
   */
  _updateComboDisplay() {
    if (this._elements.comboDisplay) {
      this._elements.comboDisplay.textContent = gameState.getComboCount();
    }
  },

  /**
   * 更新按钮状态
   */
  _updateButtonStates() {
    const status = gameState.getStatus();
    const GameStatus = gameState.getGameStatuses();
    
    if (this._elements.startBtn) {
      this._elements.startBtn.disabled = status === GameStatus.PLAYING;
    }
    
    if (this._elements.pauseBtn) {
      this._elements.pauseBtn.disabled = status !== GameStatus.PLAYING;
      this._elements.pauseBtn.textContent = status === GameStatus.PAUSED ? '继续' : '暂停';
    }
    
    if (this._elements.levelSelectBtn) {
      this._elements.levelSelectBtn.disabled = status === GameStatus.PLAYING || status === GameStatus.PAUSED;
    }
  },

  /**
   * 渲染患者队列
   */
  renderPatientQueue() {
    if (!this._elements.queueContainer) return;
    
    // 清空现有内容
    this._elements.queueContainer.innerHTML = '';
    
    const patients = gameState.getPatientQueue();
    
    patients.forEach((patient, index) => {
      const patientCard = this._createPatientCard(patient, index === 0);
      this._elements.queueContainer.appendChild(patientCard);
    });
  },

  /**
   * 创建患者卡片
   * @param {Object} patient - 患者信息
   * @param {boolean} isActive - 是否为当前活动患者
   * @returns {HTMLElement} 患者卡片DOM元素
   */
  _createPatientCard(patient, isActive) {
    const card = document.createElement('div');
    card.className = `patient-card ${isActive ? 'active' : ''}`;
    card.dataset.patientId = patient.id;
    card.draggable = isActive; // 只有第一个患者可以拖拽
    
    // 患者基本信息
    const basicInfo = document.createElement('div');
    basicInfo.className = 'patient-basic-info';
    basicInfo.innerHTML = `
      <div class="patient-name">${patient.name}</div>
      <div class="patient-details">${patient.age}岁 / ${patient.gender}</div>
    `;
    
    // 主诉
    const complaint = document.createElement('div');
    complaint.className = 'patient-complaint';
    complaint.innerHTML = `<strong>主诉：</strong>${patient.chiefComplaint}`;
    
    // 生命体征
    const vitalSigns = document.createElement('div');
    vitalSigns.className = 'patient-vital-signs';
    vitalSigns.innerHTML = `
      <div class="vital-sign">
        <span class="vital-label">体温：</span>
        <span class="vital-value">${patient.vitalSigns.temperature}℃</span>
      </div>
      <div class="vital-sign">
        <span class="vital-label">脉搏：</span>
        <span class="vital-value">${patient.vitalSigns.pulse}次/分</span>
      </div>
      <div class="vital-sign">
        <span class="vital-label">呼吸：</span>
        <span class="vital-value">${patient.vitalSigns.respiration}次/分</span>
      </div>
      <div class="vital-sign">
        <span class="vital-label">血压：</span>
        <span class="vital-value">${patient.vitalSigns.bloodPressure.systolic}/${patient.vitalSigns.bloodPressure.diastolic}mmHg</span>
      </div>
      <div class="vital-sign">
        <span class="vital-label">血氧：</span>
        <span class="vital-value">${patient.vitalSigns.oxygenSaturation}%</span>
      </div>
    `;
    
    // 过敏史
    if (patient.allergies && patient.allergies.length > 0) {
      const allergies = document.createElement('div');
      allergies.className = 'patient-allergies';
      allergies.innerHTML = `<strong>过敏史：</strong>${patient.allergies.join('、')}`;
      card.appendChild(allergies);
    }
    
    // 组装卡片
    card.appendChild(basicInfo);
    card.appendChild(complaint);
    card.appendChild(vitalSigns);
    
    // 添加拖拽事件
    if (isActive) {
      card.addEventListener('dragstart', (e) => this._handleDragStart(e, patient.id));
      card.addEventListener('dragend', (e) => this._handleDragEnd(e));
    }
    
    return card;
  },

  /**
   * 处理拖拽开始
   * @param {Event} e - 拖拽事件
   * @param {string} patientId - 患者ID
   */
  _handleDragStart(e, patientId) {
    this._draggedPatientId = patientId;
    e.dataTransfer.effectAllowed = 'move';
    e.target.classList.add('dragging');
  },

  /**
   * 处理拖拽结束
   * @param {Event} e - 拖拽事件
   */
  _handleDragEnd(e) {
    e.target.classList.remove('dragging');
    
    // 移除所有区域的高亮
    Object.values(this._elements.triageZones).forEach(zone => {
      if (zone) {
        zone.classList.remove('drag-over');
      }
    });
  },

  /**
   * 处理拖拽经过
   * @param {Event} e - 拖拽事件
   */
  _handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  },

  /**
   * 处理拖拽进入
   * @param {Event} e - 拖拽事件
   */
  _handleDragEnter(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  },

  /**
   * 处理拖拽离开
   * @param {Event} e - 拖拽事件
   */
  _handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
  },

  /**
   * 处理放置
   * @param {Event} e - 拖拽事件
   */
  _handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    
    if (!this._draggedPatientId) return;
    
    const zone = e.currentTarget.dataset.zone;
    if (!zone) return;
    
    // 触发患者分诊处理
    this._processPatientTriage(this._draggedPatientId, zone);
    
    this._draggedPatientId = null;
  },

  /**
   * 处理患者分诊
   * @param {string} patientId - 患者ID
   * @param {string} selectedZone - 选择的分诊区域
   */
  async _processPatientTriage(patientId, selectedZone) {
    // 获取患者信息
    const patients = gameState.getPatientQueue();
    const patient = patients.find(p => p.id === patientId);
    
    if (!patient) return;
    
    try {
      // 动态导入triageRules模块
      const { triageRules } = await import('./triageRules.js');
      
      // 验证分诊
      const validationResult = triageRules.validateTriage(patient, selectedZone);
      
      // 计算得分
      const currentCombo = gameState.getComboCount();
      const scoreResult = triageRules.calculateScore(validationResult, currentCombo);
      
      // 更新游戏状态
      gameState.processPatient(patientId, selectedZone, validationResult, scoreResult.scoreChange);
      gameState.updateCombo(scoreResult.newCombo);
      
      // 显示反馈
      this._showFeedback(validationResult, scoreResult.scoreChange);
      
      // 更新UI
      this.renderPatientQueue();
      this._updateUI();
      
    } catch (error) {
      console.error('处理患者分诊失败:', error);
      this._showErrorMessage('处理分诊失败，请重试');
    }
  },

  /**
   * 显示反馈信息
   * @param {Object} validationResult - 验证结果
   * @param {number} scoreChange - 分数变化
   */
  _showFeedback(validationResult, scoreChange) {
    if (!this._elements.feedback) return;
    
    // 清除之前的超时
    if (this._feedbackTimeout) {
      clearTimeout(this._feedbackTimeout);
    }
    
    // 创建反馈内容
    let feedbackHTML = '';
    
    if (validationResult.isCorrect) {
      feedbackHTML += `<div class="feedback-success">
        <strong>✓ 分诊正确！</strong>
        <span class="score-change positive">+${scoreChange}分</span>
      </div>`;
    } else {
      feedbackHTML += `<div class="feedback-error">
        <strong>✗ 分诊错误</strong>
        <span class="score-change negative">${scoreChange}分</span>
      </div>`;
      feedbackHTML += `<div class="feedback-details">${validationResult.errorMessage}</div>`;
    }
    
    // 显示风险提示
    if (validationResult.riskHints && validationResult.riskHints.length > 0) {
      feedbackHTML += '<div class="feedback-warnings">';
      validationResult.riskHints.forEach(hint => {
        feedbackHTML += `<div class="warning-item">${hint}</div>`;
      });
      feedbackHTML += '</div>';
    }
    
    // 显示其他提示
    if (validationResult.warnings && validationResult.warnings.length > 0) {
      feedbackHTML += '<div class="feedback-hints">';
      validationResult.warnings.forEach(hint => {
        feedbackHTML += `<div class="hint-item">${hint}</div>`;
      });
      feedbackHTML += '</div>';
    }
    
    this._elements.feedback.innerHTML = feedbackHTML;
    this._elements.feedback.classList.add('show');
    
    // 3秒后自动隐藏
    this._feedbackTimeout = setTimeout(() => {
      this._elements.feedback.classList.remove('show');
    }, 3000);
  },

  /**
   * 显示错误消息
   * @param {string} message - 错误消息
   */
  _showErrorMessage(message) {
    if (!this._elements.feedback) return;
    
    this._elements.feedback.innerHTML = `<div class="feedback-error">
      <strong>错误：</strong>${message}
    </div>`;
    this._elements.feedback.classList.add('show');
    
    setTimeout(() => {
      this._elements.feedback.classList.remove('show');
    }, 3000);
  },

  /**
   * 加载关卡列表
   */
  _loadLevelList() {
    if (!this._elements.levelList) return;
    
    const levels = levelLoader.getAvailableLevels();
    
    this._elements.levelList.innerHTML = '';
    
    levels.forEach(level => {
      const levelItem = document.createElement('div');
      levelItem.className = 'level-item';
      levelItem.innerHTML = `
        <div class="level-name">${level.name}</div>
        <div class="level-description">${level.description}</div>
        <div class="level-meta">
          <span class="level-difficulty">难度：${level.difficulty}</span>
          <span class="level-time">预计时间：${level.estimatedTime}</span>
        </div>
      `;
      
      levelItem.addEventListener('click', () => this._selectLevel(level.id));
      this._elements.levelList.appendChild(levelItem);
    });
  },

  /**
   * 选择关卡
   * @param {string} levelId - 关卡ID
   */
  async _selectLevel(levelId) {
    try {
      const levelData = await levelLoader.loadLevel(levelId);
      
      // 隐藏关卡选择弹窗
      this._hideLevelModal();
      
      // 开始游戏
      gameState.startGame(levelId, levelData);
      
      // 更新UI
      this.renderPatientQueue();
      this._updateUI();
      
    } catch (error) {
      console.error('加载关卡失败:', error);
      this._showErrorMessage('加载关卡失败：' + error.message);
    }
  },

  /**
   * 处理开始游戏
   */
  _handleStartGame() {
    const status = gameState.getStatus();
    const GameStatus = gameState.getGameStatuses();
    
    if (status === GameStatus.PAUSED) {
      gameState.resumeGame();
      this._updateUI();
    } else {
      // 显示关卡选择
      this._showLevelModal();
    }
  },

  /**
   * 处理暂停游戏
   */
  _handlePauseGame() {
    const status = gameState.getStatus();
    const GameStatus = gameState.getGameStatuses();
    
    if (status === GameStatus.PLAYING) {
      gameState.pauseGame();
      this._showPauseModal();
    } else if (status === GameStatus.PAUSED) {
      gameState.resumeGame();
      this._hidePauseModal();
    }
    
    this._updateUI();
  },

  /**
   * 处理恢复游戏
   */
  _handleResumeGame() {
    gameState.resumeGame();
    this._hidePauseModal();
    this._updateUI();
  },

  /**
   * 处理结束游戏
   */
  _handleEndGame() {
    gameState.endGame();
    this._hidePauseModal();
    this._showGameOverModal();
  },

  /**
   * 处理重新开始
   */
  _handleReplay() {
    this._hideGameOverModal();
    this._showLevelModal();
  },

  /**
   * 显示关卡选择弹窗
   */
  _showLevelModal() {
    if (this._elements.levelModal) {
      this._elements.levelModal.classList.add('show');
    }
  },

  /**
   * 隐藏关卡选择弹窗
   */
  _hideLevelModal() {
    if (this._elements.levelModal) {
      this._elements.levelModal.classList.remove('show');
    }
  },

  /**
   * 显示历史记录弹窗
   */
  _showHistoryModal() {
    if (!this._elements.historyModal || !this._elements.historyList) return;
    
    // 加载历史记录
    const history = gameState.getGameHistory();
    
    this._elements.historyList.innerHTML = '';
    
    if (history.length === 0) {
      this._elements.historyList.innerHTML = '<div class="no-history">暂无历史记录</div>';
    } else {
      history.forEach((record, index) => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        
        const playedDate = new Date(record.playedAt);
        const formattedDate = playedDate.toLocaleString('zh-CN');
        
        historyItem.innerHTML = `
          <div class="history-header">
            <span class="history-level">${record.levelName}</span>
            <span class="history-date">${formattedDate}</span>
          </div>
          <div class="history-stats">
            <span class="history-score">分数：${record.score}</span>
            <span class="history-accuracy">准确率：${record.accuracy}%</span>
            <span class="history-time">用时：${levelLoader.formatTime(record.timeUsed)}</span>
          </div>
        `;
        
        this._elements.historyList.appendChild(historyItem);
      });
    }
    
    this._elements.historyModal.classList.add('show');
  },

  /**
   * 隐藏历史记录弹窗
   */
  _hideHistoryModal() {
    if (this._elements.historyModal) {
      this._elements.historyModal.classList.remove('show');
    }
  },

  /**
   * 显示游戏结束弹窗
   */
  _showGameOverModal() {
    if (!this._elements.gameOverModal || !this._elements.gameResult) return;
    
    const summary = gameState.getGameSummary();
    
    let resultHTML = `
      <div class="result-summary">
        <div class="result-item">
          <span class="result-label">总分：</span>
          <span class="result-value">${summary.score}</span>
        </div>
        <div class="result-item">
          <span class="result-label">准确率：</span>
          <span class="result-value">${summary.accuracy}%</span>
        </div>
        <div class="result-item">
          <span class="result-label">最高连击：</span>
          <span class="result-value">${summary.maxCombo}</span>
        </div>
        <div class="result-item">
          <span class="result-label">用时：</span>
          <span class="result-value">${levelLoader.formatTime(summary.timeUsed)}</span>
        </div>
      </div>
    `;
    
    // 详细统计
    resultHTML += `
      <div class="result-details">
        <h3>详细统计</h3>
        <div class="stats-grid">
          <div class="stat-card red-zone">
            <div class="stat-title">红区</div>
            <div class="stat-value">${summary.patientsByZone.red.length}人</div>
          </div>
          <div class="stat-card yellow-zone">
            <div class="stat-title">黄区</div>
            <div class="stat-value">${summary.patientsByZone.yellow.length}人</div>
          </div>
          <div class="stat-card green-zone">
            <div class="stat-title">绿区</div>
            <div class="stat-value">${summary.patientsByZone.green.length}人</div>
          </div>
          <div class="stat-card black-zone">
            <div class="stat-title">黑区</div>
            <div class="stat-value">${summary.patientsByZone.black.length}人</div>
          </div>
        </div>
      </div>
    `;
    
    // 错误案例（如果有）
    const incorrectPatients = summary.processedPatients.filter(p => !p.isCorrect);
    if (incorrectPatients.length > 0) {
      resultHTML += `
        <div class="result-errors">
          <h3>错误案例分析</h3>
          <div class="error-list">
      `;
      
      incorrectPatients.forEach(patient => {
        const zoneNames = {
          red: '红区',
          yellow: '黄区',
          green: '绿区',
          black: '黑区'
        };
        
        resultHTML += `
          <div class="error-item">
            <div class="error-patient">
              <strong>${patient.name}</strong> (${patient.age}岁/${patient.gender})
            </div>
            <div class="error-complaint">主诉：${patient.chiefComplaint}</div>
            <div class="error-details">
              你的选择：<span class="selected-zone">${zoneNames[patient.selectedZone]}</span>
              正确答案：<span class="correct-zone">${zoneNames[patient.correctZone]}</span>
            </div>
            <div class="error-reason">${patient.errorMessage}</div>
          </div>
        `;
      });
      
      resultHTML += `
          </div>
        </div>
      `;
    }
    
    this._elements.gameResult.innerHTML = resultHTML;
    this._elements.gameOverModal.classList.add('show');
  },

  /**
   * 隐藏游戏结束弹窗
   */
  _hideGameOverModal() {
    if (this._elements.gameOverModal) {
      this._elements.gameOverModal.classList.remove('show');
    }
  },

  /**
   * 显示暂停弹窗
   */
  _showPauseModal() {
    if (!this._elements.pauseModal || !this._elements.pauseSummary) return;
    
    const summary = gameState.getGameSummary();
    
    let summaryHTML = `
      <div class="pause-stats">
        <div class="pause-stat">
          <span class="pause-label">当前分数：</span>
          <span class="pause-value">${summary.score}</span>
        </div>
        <div class="pause-stat">
          <span class="pause-label">当前连击：</span>
          <span class="pause-value">${gameState.getComboCount()}</span>
        </div>
        <div class="pause-stat">
          <span class="pause-label">剩余时间：</span>
          <span class="pause-value">${levelLoader.formatTime(summary.timeLimit - summary.timeUsed)}</span>
        </div>
        <div class="pause-stat">
          <span class="pause-label">已处理：</span>
          <span class="pause-value">${summary.totalProcessed}/${summary.totalPatients}人</span>
        </div>
      </div>
    `;
    
    // 显示当前准确率
    if (summary.totalProcessed > 0) {
      summaryHTML += `
        <div class="pause-accuracy">
          目前准确率：${summary.accuracy}%
        </div>
      `;
    }
    
    this._elements.pauseSummary.innerHTML = summaryHTML;
    this._elements.pauseModal.classList.add('show');
  },

  /**
   * 隐藏暂停弹窗
   */
  _hidePauseModal() {
    if (this._elements.pauseModal) {
      this._elements.pauseModal.classList.remove('show');
    }
  },

  /**
   * 注册游戏状态事件监听
   */
  registerGameEvents() {
    // 时间更新事件
    gameState.on('onTimeUpdate', () => {
      this._updateTimeDisplay();
    });
    
    // 分数更新事件
    gameState.on('onScoreUpdate', () => {
      this._updateScoreDisplay();
    });
    
    // 连击更新事件
    gameState.on('onComboUpdate', () => {
      this._updateComboDisplay();
    });
    
    // 游戏状态变化事件
    gameState.on('onGameStatusChange', () => {
      this._updateButtonStates();
    });
    
    // 游戏结束事件
    gameState.on('onGameEnd', () => {
      this._showGameOverModal();
    });
  }
};

export default uiController;
