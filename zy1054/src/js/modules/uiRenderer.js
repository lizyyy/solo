/**
 * UI渲染模块
 * 负责渲染游戏的各种界面
 */

export class UIRenderer {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`容器元素 ${containerId} 未找到`);
    }
  }

  /**
   * 渲染开始菜单
   * @param {Function} onStart 开始游戏回调
   * @param {Function} onImport 导入关卡回调
   */
  renderStartMenu(onStart, onImport) {
    const html = `
      <div class="start-menu">
        <h1>夜市出餐手忙脚乱</h1>
        <div class="menu-buttons">
          <button id="startGameBtn">开始游戏</button>
          <button id="importLevelBtn" class="secondary">导入关卡</button>
        </div>
        <div id="importSection" style="display: none; margin-top: 20px;">
          <div class="import-export">
            <h3>导入关卡数据</h3>
            <textarea id="importData" placeholder="粘贴关卡JSON数据..."></textarea>
            <div style="display: flex; gap: 10px;">
              <button id="confirmImportBtn" class="success">确认导入</button>
              <button id="cancelImportBtn" class="danger">取消</button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    this.container.innerHTML = html;
    
    // 绑定事件
    document.getElementById('startGameBtn').addEventListener('click', onStart);
    
    document.getElementById('importLevelBtn').addEventListener('click', () => {
      document.getElementById('importSection').style.display = 'block';
    });
    
    document.getElementById('cancelImportBtn').addEventListener('click', () => {
      document.getElementById('importSection').style.display = 'none';
      document.getElementById('importData').value = '';
    });
    
    document.getElementById('confirmImportBtn').addEventListener('click', () => {
      const data = document.getElementById('importData').value;
      if (data && onImport) {
        onImport(data);
      }
    });
  }

  /**
   * 渲染关卡选择界面
   * @param {Array} levels 关卡列表
   * @param {Object} saveData 存档数据
   * @param {Function} onSelectLevel 选择关卡回调
   * @param {Function} onBack 返回回调
   * @param {Function} onExport 导出关卡回调
   */
  renderLevelSelect(levels, saveData, onSelectLevel, onBack, onExport) {
    let levelsHtml = '';
    
    levels.forEach(level => {
      const isUnlocked = saveData.unlockedLevels.includes(level.id);
      const highScore = saveData.highScores[level.id] || 0;
      
      levelsHtml += `
        <div class="level-card ${isUnlocked ? '' : 'locked'}" data-level-id="${level.id}">
          <h3>${level.name}</h3>
          <p>${level.description}</p>
          <p>难度: ${level.difficulty === 'easy' ? '简单' : level.difficulty === 'medium' ? '中等' : '困难'}</p>
          <p>目标分数: ${level.targetScore}</p>
          ${isUnlocked ? `<p>最高分: ${highScore}</p>` : '<p style="color: #999;">🔒 未解锁</p>'}
        </div>
      `;
    });
    
    const html = `
      <div>
        <h2>选择关卡</h2>
        <div class="controls">
          <button id="backToMenuBtn" class="secondary">返回</button>
          <button id="exportLevelsBtn" class="secondary">导出关卡</button>
        </div>
        <div class="level-select">
          ${levelsHtml}
        </div>
        <div id="exportSection" style="display: none; margin-top: 20px;">
          <div class="import-export">
            <h3>导出关卡数据</h3>
            <textarea id="exportData" readonly></textarea>
            <div style="display: flex; gap: 10px;">
              <button id="copyExportBtn">复制到剪贴板</button>
              <button id="closeExportBtn" class="secondary">关闭</button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    this.container.innerHTML = html;
    
    // 绑定事件
    document.getElementById('backToMenuBtn').addEventListener('click', onBack);
    
    document.querySelectorAll('.level-card').forEach(card => {
      card.addEventListener('click', () => {
        const levelId = parseInt(card.dataset.levelId);
        const isUnlocked = saveData.unlockedLevels.includes(levelId);
        if (isUnlocked && onSelectLevel) {
          onSelectLevel(levelId);
        }
      });
    });
    
    document.getElementById('exportLevelsBtn').addEventListener('click', () => {
      if (onExport) {
        const exportData = onExport();
        document.getElementById('exportData').value = exportData;
        document.getElementById('exportSection').style.display = 'block';
      }
    });
    
    document.getElementById('closeExportBtn').addEventListener('click', () => {
      document.getElementById('exportSection').style.display = 'none';
    });
    
    document.getElementById('copyExportBtn').addEventListener('click', () => {
      const exportData = document.getElementById('exportData');
      exportData.select();
      document.execCommand('copy');
      alert('已复制到剪贴板！');
    });
  }

  /**
   * 渲染游戏主界面
   * @param {Object} gameState 游戏状态
   * @param {Object} levelConfig 关卡配置
   * @param {Function} onPause 暂停回调
   * @param {Function} onRestart 重开回调
   * @param {Function} onAssignOrder 分配订单回调
   * @param {Function} onCompleteStep 完成步骤回调
   */
  renderGameScreen(gameState, levelConfig, onPause, onRestart, onAssignOrder, onCompleteStep) {
    const { orders, stations, score, income, waste, isPaused, gameTime, targetScore } = gameState;
    
    // 渲染订单队列
    let ordersHtml = '';
    orders.forEach(order => {
      const waitTime = Math.floor((Date.now() - order.createdAt) / 1000);
      const maxWaitTime = levelConfig.maxWaitTime;
      const isUrgent = waitTime > maxWaitTime * 0.7;
      
      let stepsHtml = '';
      order.steps.forEach(step => {
        const stepClass = step.completed ? 'completed' : (step.current ? 'current' : 'pending');
        stepsHtml += `
          <div class="step-item ${stepClass}">
            <span>${step.name}</span>
            <span>${step.completed ? '✓' : (step.current ? '⏳' : '○')}</span>
          </div>
        `;
      });
      
      ordersHtml += `
        <div class="order-card ${isUrgent ? 'urgent' : ''} ${order.status === 'completed' ? 'completed' : ''}" 
             data-order-id="${order.id}">
          <h4>${order.dish}</h4>
          <p>价格: ¥${order.price}</p>
          <p>满意度: ${order.satisfaction}%</p>
          <p>等待时间: ${waitTime}秒</p>
          <div class="order-details">
            <div class="order-steps">
              ${stepsHtml}
            </div>
          </div>
          ${order.status === 'pending' ? `<button class="assign-order-btn" data-order-id="${order.id}">分配到工位</button>` : ''}
        </div>
      `;
    });
    
    // 渲染工位
    let stationsHtml = '';
    stations.forEach((station, index) => {
      let stationContent = '';
      let progressBar = '';
      
      if (station.status === 'available') {
        stationContent = '<p>空闲</p>';
      } else if (station.currentOrder) {
        const order = station.currentOrder;
        stationContent = `
          <h4>${order.dish}</h4>
          <p>当前步骤: ${station.currentStep.name}</p>
          <p>满意度: ${order.satisfaction}%</p>
        `;
        
        if (station.status === 'busy') {
          const progressPercent = Math.round(station.progress * 100);
          const progressClass = station.progress > 0.7 ? 'urgent' : (station.progress > 0.5 ? 'normal' : 'normal');
          progressBar = `
            <div class="progress-bar">
              <div class="progress ${progressClass}" style="width: ${progressPercent}%"></div>
            </div>
            <p>进度: ${progressPercent}%</p>
          `;
        }
      }
      
      let actionButton = '';
      if (station.status === 'completed' || station.status === 'burned') {
        actionButton = `
          <button class="complete-step-btn ${station.status === 'burned' ? 'danger' : 'success'}" 
                  data-station-id="${station.id}">
            ${station.status === 'burned' ? '处理糊掉的订单' : '完成当前步骤'}
          </button>
        `;
      }
      
      const stationStatusClass = station.status === 'available' ? 'available' : 
                                  station.status === 'busy' ? 'busy' :
                                  station.status === 'completed' ? 'completed' : 'burned';
      
      stationsHtml += `
        <div class="station ${stationStatusClass}" data-station-id="${station.id}">
          <h3>${station.type} (工位 ${index + 1})</h3>
          <p>状态: ${this._getStatusText(station.status)}</p>
          ${stationContent}
          ${progressBar}
          ${actionButton}
        </div>
      `;
    });
    
    // 计算剩余时间
    const remainingTime = Math.max(0, levelConfig.gameDuration - gameTime);
    const minutes = Math.floor(remainingTime / 60);
    const seconds = Math.floor(remainingTime % 60);
    
    const html = `
      <div>
        <div class="controls">
          <button id="pauseGameBtn">${isPaused ? '继续' : '暂停'}</button>
          <button id="restartGameBtn" class="danger">重开</button>
          <button id="backToLevelBtn" class="secondary">返回关卡</button>
        </div>
        
        <div class="game-info">
          <div class="info-item">
            <span>关卡: ${levelConfig.name}</span>
            <span>剩余时间: ${minutes}:${seconds.toString().padStart(2, '0')}</span>
          </div>
          <div class="info-item">
            <span>当前分数: ${score}</span>
            <span>目标分数: ${targetScore}</span>
          </div>
          <div class="info-item">
            <span>收入: ¥${income}</span>
            <span>浪费: ¥${waste}</span>
          </div>
        </div>
        
        <div class="game-container">
          <div class="order-queue">
            <h3>订单队列</h3>
            <div class="orders">
              ${ordersHtml || '<p>暂无订单</p>'}
            </div>
          </div>
          
          <div class="stations">
            <h3 style="grid-column: 1 / -1;">工位</h3>
            ${stationsHtml}
          </div>
        </div>
        
        <div class="shortcuts">
          <h4>快捷键</h4>
          <ul>
            <li><kbd>空格</kbd> - 暂停/继续</li>
            <li><kbd>R</kbd> - 重开</li>
            <li><kbd>1-9</kbd> - 快速选择工位</li>
            <li><kbd>Enter</kbd> - 完成当前步骤</li>
          </ul>
        </div>
        
        ${isPaused ? this._renderPauseOverlay() : ''}
      </div>
    `;
    
    this.container.innerHTML = html;
    
    // 绑定事件
    document.getElementById('pauseGameBtn').addEventListener('click', onPause);
    document.getElementById('restartGameBtn').addEventListener('click', onRestart);
    
    // 分配订单按钮
    document.querySelectorAll('.assign-order-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const orderId = btn.dataset.orderId;
        if (onAssignOrder) {
          onAssignOrder(orderId);
        }
      });
    });
    
    // 完成步骤按钮
    document.querySelectorAll('.complete-step-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const stationId = btn.dataset.stationId;
        if (onCompleteStep) {
          onCompleteStep(stationId);
        }
      });
    });
  }

  /**
   * 渲染暂停覆盖层
   * @private
   * @returns {string} HTML字符串
   */
  _renderPauseOverlay() {
    return `
      <div class="pause-overlay" id="pauseOverlay">
        <div class="pause-menu">
          <h2>游戏暂停</h2>
          <div class="pause-buttons">
            <button id="resumeGameBtn">继续游戏</button>
            <button id="restartFromPauseBtn">重新开始</button>
            <button id="backFromPauseBtn" class="secondary">返回关卡选择</button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 获取状态文本
   * @private
   * @param {string} status 状态
   * @returns {string} 状态文本
   */
  _getStatusText(status) {
    const statusMap = {
      'available': '空闲',
      'busy': '忙碌',
      'completed': '待处理',
      'burned': '糊掉了'
    };
    return statusMap[status] || status;
  }

  /**
   * 渲染结算页面
   * @param {Object} summary 结算数据
   * @param {Object} levelInfo 关卡信息
   * @param {Function} onRestart 重开回调
   * @param {Function} onBack 返回回调
   * @param {Function} onExportReport 导出报告回调
   */
  renderSummary(summary, levelInfo, onRestart, onBack, onExportReport) {
    let starsDisplay = '';
    for (let i = 0; i < 3; i++) {
      starsDisplay += i < summary.stars ? '★' : '☆';
    }
    
    const html = `
      <div class="summary-container">
        <div class="summary-header">
          <h2>游戏结束</h2>
          <h3>${summary.isPassed ? '恭喜通关！' : '再接再厉！'}</h3>
          <div style="font-size: 2em; margin: 20px 0;">${starsDisplay}</div>
          <p>最终分数: ${summary.finalScore} / ${summary.targetScore}</p>
        </div>
        
        <div class="summary-stats">
          <div class="stat-card">
            <h4>总收入</h4>
            <div class="stat-value positive">¥${summary.totalIncome}</div>
          </div>
          <div class="stat-card">
            <h4>总浪费</h4>
            <div class="stat-value negative">¥${summary.totalWaste}</div>
          </div>
          <div class="stat-card">
            <h4>平均满意度</h4>
            <div class="stat-value ${summary.avgSatisfaction >= 70 ? 'positive' : 'negative'}">${summary.avgSatisfaction}%</div>
          </div>
          <div class="stat-card">
            <h4>完成订单</h4>
            <div class="stat-value positive">${summary.ordersCompleted}</div>
          </div>
          <div class="stat-card">
            <h4>糊掉订单</h4>
            <div class="stat-value negative">${summary.ordersBurned}</div>
          </div>
          <div class="stat-card">
            <h4>完美订单</h4>
            <div class="stat-value positive">${summary.perfectOrders}</div>
          </div>
        </div>
        
        <div class="import-export">
          <h3>导出报告</h3>
          <div style="display: flex; gap: 10px;">
            <button id="exportJSONBtn">导出 JSON</button>
            <button id="exportMarkdownBtn">导出 Markdown</button>
          </div>
        </div>
        
        <div class="summary-actions">
          <button id="playAgainBtn" class="success">再玩一次</button>
          <button id="backToLevelsBtn" class="secondary">返回关卡选择</button>
        </div>
      </div>
    `;
    
    this.container.innerHTML = html;
    
    // 绑定事件
    document.getElementById('playAgainBtn').addEventListener('click', onRestart);
    document.getElementById('backToLevelsBtn').addEventListener('click', onBack);
    
    document.getElementById('exportJSONBtn').addEventListener('click', () => {
      if (onExportReport) {
        onExportReport('json');
      }
    });
    
    document.getElementById('exportMarkdownBtn').addEventListener('click', () => {
      if (onExportReport) {
        onExportReport('markdown');
      }
    });
  }

  /**
   * 显示提示信息
   * @param {string} message 消息
   * @param {string} type 类型 (success, error, info)
   */
  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 15px 25px;
      border-radius: 8px;
      color: white;
      font-weight: bold;
      z-index: 2000;
      animation: fadeInOut 3s ease-in-out;
      background-color: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db'};
    `;
    
    toast.textContent = message;
    
    // 添加动画样式
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeInOut {
        0% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
        10% { opacity: 1; transform: translateX(-50%) translateY(0); }
        90% { opacity: 1; transform: translateX(-50%) translateY(0); }
        100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
      style.remove();
    }, 3000);
  }
}
