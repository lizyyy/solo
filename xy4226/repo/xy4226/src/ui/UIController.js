class UIController {
  constructor(simulator) {
    this.simulator = simulator;
    this.container = document.getElementById('ui-container');
    
    this.notificationTimeout = null;
    this.violationTimeout = null;
    
    this.createUI();
    this.setupEventListeners();
  }

  createUI() {
    this.createTopBar();
    this.createControlPanel();
    this.createNotificationArea();
    this.createViolationArea();
    this.createResultModal();
    this.createPathEditor();
  }

  createTopBar() {
    const topBar = document.createElement('div');
    topBar.id = 'top-bar';
    topBar.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 60px;
      background: linear-gradient(180deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 100%);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
      color: white;
      font-size: 14px;
      z-index: 100;
    `;

    const leftSection = document.createElement('div');
    leftSection.style.cssText = 'display: flex; align-items: center; gap: 20px;';

    const levelInfo = document.createElement('div');
    levelInfo.id = 'level-info';
    levelInfo.innerHTML = '<strong>关卡:</strong> <span id="level-name">加载中...</span>';
    leftSection.appendChild(levelInfo);

    const timeDisplay = document.createElement('div');
    timeDisplay.id = 'time-display';
    timeDisplay.innerHTML = '<strong>时间:</strong> <span id="simulation-time">00:00.00</span>';
    leftSection.appendChild(timeDisplay);

    const speedDisplay = document.createElement('div');
    speedDisplay.id = 'speed-display';
    speedDisplay.innerHTML = '<strong>速度:</strong> <span id="current-speed">1.0</span>x';
    leftSection.appendChild(speedDisplay);

    const rightSection = document.createElement('div');
    rightSection.style.cssText = 'display: flex; align-items: center; gap: 20px;';

    const scoreDisplay = document.createElement('div');
    scoreDisplay.id = 'score-display';
    scoreDisplay.innerHTML = '<strong>分数:</strong> <span id="current-score">100</span>';
    scoreDisplay.style.cssText = 'font-size: 18px; font-weight: bold; color: #4CAF50;';
    rightSection.appendChild(scoreDisplay);

    topBar.appendChild(leftSection);
    topBar.appendChild(rightSection);

    this.container.appendChild(topBar);
  }

  createControlPanel() {
    const controlPanel = document.createElement('div');
    controlPanel.id = 'control-panel';
    controlPanel.style.cssText = `
      position: absolute;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 10px;
      background: rgba(0,0,0,0.8);
      padding: 15px 25px;
      border-radius: 50px;
      z-index: 100;
    `;

    const buttonStyles = `
      padding: 12px 24px;
      border: none;
      border-radius: 25px;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.3s ease;
    `;

    const pauseBtn = document.createElement('button');
    pauseBtn.id = 'pause-btn';
    pauseBtn.textContent = '暂停';
    pauseBtn.style.cssText = buttonStyles + 'background: #FF9800; color: white;';
    pauseBtn.onclick = () => this.simulator.pauseSimulation();
    controlPanel.appendChild(pauseBtn);

    const speedControls = document.createElement('div');
    speedControls.style.cssText = 'display: flex; gap: 5px; align-items: center;';

    const speeds = [0.5, 1.0, 2.0, 4.0];
    speeds.forEach(speed => {
      const speedBtn = document.createElement('button');
      speedBtn.textContent = `${speed}x';
      speedBtn.className = 'speed-btn';
      speedBtn.dataset.speed = speed;
      speedBtn.style.cssText = buttonStyles + `
        background: ${speed === 1.0 ? '#2196F3' : '#555'};
        color: white;
        padding: 10px 15px;
      `;
      speedBtn.onclick = () => {
        this.simulator.setSpeedMultiplier(speed);
        document.querySelectorAll('.speed-btn').forEach(btn => {
          btn.style.background = btn.dataset.speed == speed ? '#2196F3' : '#555';
        });
      };
      speedControls.appendChild(speedBtn);
    });

    controlPanel.appendChild(speedControls);

    const undoBtn = document.createElement('button');
    undoBtn.id = 'undo-btn';
    undoBtn.textContent = '撤销';
    undoBtn.style.cssText = buttonStyles + 'background: #9C27B0; color: white;';
    undoBtn.onclick = () => this.simulator.undoLastAction();
    controlPanel.appendChild(undoBtn);

    const saveBtn = document.createElement('button');
    saveBtn.id = 'save-btn';
    saveBtn.textContent = '保存';
    saveBtn.style.cssText = buttonStyles + 'background: #4CAF50; color: white;';
    saveBtn.onclick = () => this.simulator.saveProgress();
    controlPanel.appendChild(saveBtn);

    const loadBtn = document.createElement('button');
    loadBtn.id = 'load-btn';
    loadBtn.textContent = '加载';
    loadBtn.style.cssText = buttonStyles + 'background: #00BCD4; color: white;';
    loadBtn.onclick = () => this.simulator.loadProgress();
    controlPanel.appendChild(loadBtn);

    this.container.appendChild(controlPanel);
  }

  createNotificationArea() {
    const notificationArea = document.createElement('div');
    notificationArea.id = 'notification-area';
    notificationArea.style.cssText = `
      position: absolute;
      top: 80px;
      right: 20px;
      width: 300px;
      z-index: 100;
    `;

    const notification = document.createElement('div');
    notification.id = 'notification';
    notification.style.cssText = `
      background: rgba(76, 175, 80, 0.9);
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      margin-bottom: 10px;
      display: none;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      animation: slideIn 0.3s ease;
    `;
    notification.innerHTML = '<div id="notification-text"></div>';

    notificationArea.appendChild(notification);
    this.container.appendChild(notificationArea);
  }

  createViolationArea() {
    const violationArea = document.createElement('div');
    violationArea.id = 'violation-area';
    violationArea.style.cssText = `
      position: absolute;
      top: 80px;
      left: 20px;
      width: 350px;
      z-index: 100;
    `;

    const violation = document.createElement('div');
    violation.id = 'violation-display';
    violation.style.cssText = `
      background: rgba(244, 67, 54, 0.9);
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      margin-bottom: 10px;
      display: none;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    violation.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 5px;">⚠️ 违规警告</div>
      <div id="violation-text"></div>
    `;

    violationArea.appendChild(violation);
    this.container.appendChild(violationArea);
  }

  createResultModal() {
    const resultModal = document.createElement('div');
    resultModal.id = 'result-modal';
    resultModal.className = 'hidden';
    resultModal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.8);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    `;

    const resultContent = document.createElement('div');
    resultContent.style.cssText = `
      background: white;
      padding: 40px;
      border-radius: 20px;
      max-width: 500px;
      width: 90%;
      text-align: center;
    `;

    resultContent.innerHTML = `
      <h2 style="margin-bottom: 30px; font-size: 28px; color: #333;">训练完成!</h2>
      <div id="final-score-display" style="font-size: 72px; font-weight: bold; margin: 20px 0;"></div>
      <div id="final-grade" style="font-size: 36px; margin: 10px 0;"></div>
      <div id="result-details" style="margin: 30px 0; text-align: left; background: #f5f5f5; padding: 20px; border-radius: 10px;"></div>
      <div style="display: flex; gap: 15px; justify-content: center; margin-top: 30px;">
        <button id="restart-btn" style="padding: 15px 30px; background: #2196F3; color: white; border: none; border-radius: 25px; font-size: 16px; cursor: pointer;">重新开始</button>
        <button id="export-result-btn" style="padding: 15px 30px; background: #4CAF50; color: white; border: none; border-radius: 25px; font-size: 16px; cursor: pointer;">导出成绩</button>
      </div>
    `;

    resultModal.appendChild(resultContent);
    this.container.appendChild(resultModal);
  }

  createPathEditor() {
    const pathEditor = document.createElement('div');
    pathEditor.id = 'path-editor';
    pathEditor.style.cssText = `
      position: absolute;
      bottom: 100px;
      right: 20px;
      width: 300px;
      background: rgba(0,0,0,0.8);
      padding: 20px;
      border-radius: 15px;
      color: white;
      z-index: 100;
    `;

    pathEditor.innerHTML = `
      <h3 style="margin: 0 0 15px 0; font-size: 16px;">路线规划</h3>
      <div id="path-list" style="max-height: 200px; overflow-y: auto; margin-bottom: 15px;">
        <div style="color: #aaa; text-align: center; padding: 20px;">
          点击场景设置路径点
        </div>
      </div>
      <div style="display: flex; gap: 10px;">
        <button id="clear-path-btn" style="flex: 1; padding: 10px; background: #f44336; color: white; border: none; border-radius: 5px; cursor: pointer;">清除路径</button>
        <button id="execute-path-btn" style="flex: 1; padding: 10px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer;">执行路径</button>
      </div>
    `;

    this.container.appendChild(pathEditor);

    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  setupEventListeners() {
    document.getElementById('restart-btn').onclick = () => {
      this.hideResultModal();
      location.reload();
    };

    document.getElementById('export-result-btn').onclick = () => {
      const result = this.lastResult;
      if (result) {
        this.simulator.exportResult(result);
      }
    };
  }

  updateLevelInfo(level) {
    const levelName = document.getElementById('level-name');
    if (levelName) {
      levelName.textContent = level.name || '未知关卡';
    }
  }

  updateSimulationTime(timeInSeconds) {
    const timeDisplay = document.getElementById('simulation-time');
    if (timeDisplay) {
      const totalSeconds = Math.floor(timeInSeconds);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      const milliseconds = Math.floor((timeInSeconds % 1) * 100);
      timeDisplay.textContent = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
    }
  }

  updateSpeedDisplay(multiplier) {
    const speedDisplay = document.getElementById('current-speed');
    if (speedDisplay) {
      speedDisplay.textContent = multiplier.toFixed(1);
    }
  }

  updateScore(score) {
    const scoreDisplay = document.getElementById('current-score');
    if (scoreDisplay) {
      scoreDisplay.textContent = score;
      
      if (score >= 80) {
        scoreDisplay.style.color = '#4CAF50';
      } else if (score >= 60) {
        scoreDisplay.style.color = '#FFC107';
      } else {
        scoreDisplay.style.color = '#F44336';
      }
    }
  }

  updatePauseButton(isPaused) {
    const pauseBtn = document.getElementById('pause-btn');
    if (pauseBtn) {
      pauseBtn.textContent = isPaused ? '继续' : '暂停';
      pauseBtn.style.background = isPaused ? '#4CAF50' : '#FF9800';
    }
  }

  showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    const notificationText = document.getElementById('notification-text');
    
    if (!notification || !notificationText) return;

    notificationText.textContent = message;
    
    const colors = {
      success: 'rgba(76, 175, 80, 0.9)',
      warning: 'rgba(255, 152, 0, 0.9)',
      error: 'rgba(244, 67, 54, 0.9)',
      info: 'rgba(33, 150, 243, 0.9)'
    };
    
    notification.style.background = colors[type] || colors.success;
    notification.style.display = 'block';

    if (this.notificationTimeout) {
      clearTimeout(this.notificationTimeout);
    }

    this.notificationTimeout = setTimeout(() => {
      notification.style.display = 'none';
    }, 3000);
  }

  showViolations(violations) {
    if (!violations || violations.length === 0) return;

    const violationDisplay = document.getElementById('violation-display');
    const violationText = document.getElementById('violation-text');

    if (!violationDisplay || !violationText) return;

    const messages = violations.map(v => v.message).join('; ');
    violationText.textContent = messages;

    violationDisplay.style.display = 'block';

    if (this.violationTimeout) {
      clearTimeout(this.violationTimeout);
    }

    this.violationTimeout = setTimeout(() => {
      violationDisplay.style.display = 'none';
    }, 3000);
  }

  showResult(result) {
    this.lastResult = result;

    const resultModal = document.getElementById('result-modal');
    const finalScoreDisplay = document.getElementById('final-score-display');
    const finalGrade = document.getElementById('final-grade');
    const resultDetails = document.getElementById('result-details');

    if (!resultModal) return;

    if (finalScoreDisplay) {
      finalScoreDisplay.textContent = result.score;
      finalScoreDisplay.style.color = result.score >= 60 ? '#4CAF50' : '#F44336';
    }

    if (finalGrade) {
      const grade = this.getGradeLabel(result.score);
      finalGrade.textContent = grade.label;
      finalGrade.style.color = grade.color;
    }

    if (resultDetails) {
      const minutes = Math.floor(result.elapsedTime / 60);
      const seconds = Math.floor(result.elapsedTime % 60);

      resultDetails.innerHTML = `
        <div style="margin: 10px 0; display: flex; justify-content: space-between;">
          <span>用时:</span>
          <strong>${minutes}分${seconds}秒</strong>
        </div>
        <div style="margin: 10px 0; display: flex; justify-content: space-between;">
          <span>完成任务:</span>
          <strong>${result.completedTasks}/${result.totalTasks}</strong>
        </div>
        <div style="margin: 10px 0; display: flex; justify-content: space-between;">
          <span>违规次数:</span>
          <strong style="color: #F44336;">${result.violations.length}</strong>
        </div>
      `;
    }

    resultModal.style.display = 'flex';
  }

  hideResultModal() {
    const resultModal = document.getElementById('result-modal');
    if (resultModal) {
      resultModal.style.display = 'none';
    }
  }

  getGradeLabel(score) {
    if (score >= 90) return { label: '优秀', color: '#4CAF50' };
    if (score >= 80) return { label: '良好', color: '#8BC34A' };
    if (score >= 70) return { label: '中等', color: '#CDDC39' };
    if (score >= 60) return { label: '及格', color: '#FFC107' };
    return { label: '不及格', color: '#F44336' };
  }
}

export default UIController;
