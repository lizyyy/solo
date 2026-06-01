class UIRenderer {
  constructor(controller) {
    this.controller = controller;
    this.currentView = 'home';
    this.selectedRecordId = null;
  }

  init() {
    this.bindEvents();
    this.renderHome();
  }

  bindEvents() {
    document.getElementById('nav-home')?.addEventListener('click', () => this.renderHome());
    document.getElementById('nav-history')?.addEventListener('click', () => this.renderHistory());
    document.getElementById('btn-import-old')?.addEventListener('click', () => this.importOldCaliberData());
    document.getElementById('btn-clear-history')?.addEventListener('click', () => this.clearAllHistory());
  }

  renderHome() {
    this.currentView = 'home';
    this.updateNav('home');
    const app = document.getElementById('app');
    const levels = this.controller.getLevels();

    app.innerHTML = `
      <div class="page-header">
        <h1>🏞️ 水库调洪沙盘战</h1>
        <p class="subtitle">快速演练 · 智能分析 · 全程可追溯</p>
      </div>

      <div class="player-info">
        <label>学员姓名：</label>
        <input type="text" id="player-name" placeholder="请输入姓名" value="张三" />
      </div>

      <div class="levels-grid">
        ${levels.map(level => this.renderLevelCard(level)).join('')}
      </div>

      <div class="quick-stats">
        <h3>📊 快速统计</h3>
        ${this.renderQuickStats()}
      </div>
    `;

    document.querySelectorAll('.level-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const levelId = e.currentTarget.dataset.levelId;
        const playerName = document.getElementById('player-name').value.trim() || '匿名学员';
        this.startGame(levelId, playerName);
      });
    });
  }

  renderLevelCard(level) {
    const isTest = level.difficulty === 'test';
    const hasEmptyEvents = !level.events || level.events.length === 0 || level.events === null;
    const eventsCount = level.events ? level.events.length : 0;

    let statusBadge = '';
    if (hasEmptyEvents) {
      statusBadge = '<span class="badge badge-warning">⚠️ 空关卡</span>';
    } else if (isTest) {
      statusBadge = '<span class="badge badge-test">🧪 测试关</span>';
    }

    const difficultyMap = {
      'easy': { label: '简单', class: 'diff-easy' },
      'normal': { label: '普通', class: 'diff-normal' },
      'hard': { label: '困难', class: 'diff-hard' },
      'test': { label: '测试', class: 'diff-test' }
    };
    const diff = difficultyMap[level.difficulty] || difficultyMap.normal;

    return `
      <div class="level-card" data-level-id="${level.id}">
        <div class="level-header">
          <h3>${level.name || '(未命名关卡)'}</h3>
          <span class="badge ${diff.class}">${diff.label}</span>
        </div>
        <p class="level-desc">${level.description || '暂无描述'}</p>
        <div class="level-meta">
          <span>📋 ${eventsCount} 个事件</span>
          ${statusBadge}
        </div>
      </div>
    `;
  }

  renderQuickStats() {
    const stats = this.controller.getHistoryManager().getStatistics();
    return `
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-value">${stats.total}</span>
          <span class="stat-label">总记录</span>
        </div>
        <div class="stat-item">
          <span class="stat-value status-normal">${stats.normal}</span>
          <span class="stat-label">正常</span>
        </div>
        <div class="stat-item">
          <span class="stat-value status-warning">${stats.needsReview}</span>
          <span class="stat-label">待确认</span>
        </div>
        <div class="stat-item">
          <span class="stat-value status-old">${stats.oldCaliber}</span>
          <span class="stat-label">旧口径</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${stats.avgScore}</span>
          <span class="stat-label">平均分</span>
        </div>
      </div>
    `;
  }

  startGame(levelId, playerName) {
    const result = this.controller.startGame(levelId, playerName);
    if (!result.success) {
      alert(result.error);
      return;
    }

    if (result.finished) {
      this.renderSettlement(result);
      return;
    }

    this.renderGame(result);
  }

  renderGame(gameState) {
    this.currentView = 'game';
    const app = document.getElementById('app');
    const { level, state, currentEvent, eventIndex, totalEvents, validation } = gameState;

    app.innerHTML = `
      <div class="game-header">
        <div class="game-info">
          <h2>${level.name || '(未命名关卡)'}</h2>
          <p>学员：${this.controller.playerName} | 进度 ${eventIndex + 1}/${totalEvents}</p>
        </div>
        <button class="btn btn-secondary" id="btn-quit">退出</button>
      </div>

      ${validation.warnings.length > 0 ? `
        <div class="validation-warnings">
          <strong>⚠️ 关卡配置警告：</strong>
          <ul>
            ${validation.warnings.map(w => `<li>${w}</li>`).join('')}
          </ul>
        </div>
      ` : ''}

      <div class="resource-panel">
        ${this.renderResourceDisplay(state)}
      </div>

      <div class="event-card">
        <div class="event-header">
          <span class="event-time">第 ${currentEvent.timePoint + 1} 阶段</span>
          <h3>${currentEvent.title}</h3>
        </div>
        <p class="event-description">${currentEvent.description}</p>

        ${currentEvent.inflowChange ? `
          <div class="inflow-info">
            <strong>入库变化：</strong>
            <span class="${currentEvent.inflowChange > 0 ? 'text-danger' : 'text-success'}">
              ${currentEvent.inflowChange > 0 ? '+' : ''}${currentEvent.inflowChange} m³/s
            </span>
          </div>
        ` : ''}

        <div class="decisions">
          <h4>请选择应对方案：</h4>
          ${currentEvent.decisions.map(dec => `
            <button class="decision-btn" data-decision-id="${dec.id}">
              <span class="decision-label">${dec.label}</span>
              <span class="decision-preview">
                ${this.renderDecisionPreview(dec.effects)}
              </span>
            </button>
          `).join('')}
        </div>
      </div>

      <div class="progress-bar">
        <div class="progress-fill" style="width: ${((eventIndex + 1) / totalEvents * 100)}%"></div>
      </div>
    `;

    document.getElementById('btn-quit').addEventListener('click', () => {
      if (confirm('确定要退出吗？当前进度将丢失。')) {
        this.controller.forceFinish();
        this.renderHome();
      }
    });

    document.querySelectorAll('.decision-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const decisionId = e.currentTarget.dataset.decisionId;
        this.makeDecision(decisionId);
      });
    });
  }

  renderResourceDisplay(state) {
    const resources = [
      { key: 'waterLevel', label: '水位', icon: '🌊' },
      { key: 'storage', label: '库容', icon: '📦' },
      { key: 'discharge', label: '下泄', icon: '💧' },
      { key: 'score', label: '得分', icon: '⭐' }
    ];

    return resources.map(r => {
      const config = this.controller.resourceConfig[r.key];
      const value = state[r.key];
      const statusClass = this.controller.getResourceStatusClass(r.key, value);
      const displayValue = typeof value === 'number' ? value.toFixed(1) : value;

      return `
        <div class="resource-card ${statusClass}">
          <div class="resource-icon">${r.icon}</div>
          <div class="resource-info">
            <span class="resource-label">${r.label}</span>
            <span class="resource-value">${displayValue} ${config.unit}</span>
          </div>
          ${config.warning && value >= config.warning ? `
            <div class="resource-alert">
              ${value >= config.flood ? '🚨 超防洪' : '⚠️ 超警戒'}
            </div>
          ` : ''}
          ${value < 0 ? `<div class="resource-alert">❌ 负值</div>` : ''}
        </div>
      `;
    }).join('');
  }

  renderDecisionPreview(effects) {
    const labels = [];
    for (const [key, value] of Object.entries(effects)) {
      if (typeof value === 'number' && value !== 0) {
        const sign = value > 0 ? '+' : '';
        labels.push(`<span class="${value > 0 ? 'effect-positive' : 'effect-negative'}">${sign}${value}</span>`);
      }
    }
    return labels.join(' ');
  }

  makeDecision(decisionId) {
    const result = this.controller.makeDecision(decisionId);

    if (!result.success) {
      alert(result.error);
      return;
    }

    if (result.finished) {
      this.renderSettlement(result);
      return;
    }

    if (!result.canContinue) {
      if (confirm('检测到资源异常（负值），需要人工确认。是否继续结算？')) {
        this.renderSettlement(this.controller.forceFinish());
        return;
      }
    }

    this.renderGame({
      ...this.controller.getCurrentState(),
      level: this.controller.currentLevel,
      state: result.state,
      currentEvent: result.currentEvent,
      eventIndex: result.eventIndex,
      totalEvents: result.totalEvents,
      validation: this.controller.levelValidation
    });
  }

  renderSettlement(result) {
    this.currentView = 'settlement';
    const app = document.getElementById('app');
    const { recordId, result: gameResult, decisionHistory, durationFormatted, needsManualReview } = result;

    const statusLabels = {
      'normal': { label: '正常', class: 'status-normal' },
      'has_warnings': { label: '有警告', class: 'status-warning' },
      'needs_manual_review': { label: '待人工确认', class: 'status-danger' },
      'reviewed': { label: '已复核', class: 'status-reviewed' }
    };
    const status = statusLabels[gameResult.status] || statusLabels.normal;

    const penaltyDetails = this.calculatePenaltyDetails(decisionHistory);

    app.innerHTML = `
      <div class="settlement-header">
        <h1>📋 结算报告</h1>
        <span class="badge ${status.class}">${status.label}</span>
      </div>

      <div class="settlement-summary">
        <div class="summary-grid">
          <div class="summary-item">
            <span class="summary-label">最终得分</span>
            <span class="summary-value score-${gameResult.grade}">${gameResult.finalScore}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">评级</span>
            <span class="summary-value grade-${gameResult.grade}">${gameResult.grade}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">用时</span>
            <span class="summary-value">${durationFormatted}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">处理事件</span>
            <span class="summary-value">${gameResult.totalEvents} 个</span>
          </div>
        </div>
      </div>

      ${needsManualReview ? `
        <div class="alert alert-danger">
          <strong>⚠️ 注意：</strong>本记录存在资源负值等异常情况，已标记为"待人工确认"。
          请培训讲师在历史记录中复核。
        </div>
      ` : ''}

      ${gameResult.duplicateEventIds.length > 0 ? `
        <div class="alert alert-warning">
          <strong>⚠️ 警告：</strong>检测到重复事件ID：${gameResult.duplicateEventIds.join(', ')}
        </div>
      ` : ''}

      ${gameResult.hasBoundaryViolation ? `
        <div class="alert alert-warning">
          <strong>⚠️ 警告：</strong>本关存在资源值超出边界的情况，系统已自动修正。
        </div>
      ` : ''}

      <div class="penalty-section">
        <h3>📝 扣分详情</h3>
        <div class="penalty-total">
          总扣分：<span class="penalty-value">-${gameResult.penaltyPoints}</span> 分
        </div>
        ${penaltyDetails.length > 0 ? `
          <div class="penalty-list">
            ${penaltyDetails.map((p, i) => `
              <div class="penalty-item">
                <span class="penalty-index">${i + 1}</span>
                <div class="penalty-content">
                  <div class="penalty-event">${p.eventTitle}</div>
                  <div class="penalty-decision">选择：${p.decisionLabel}</div>
                  <div class="penalty-reason">原因：${p.explanation}</div>
                  ${p.penalty !== 0 ? `<div class="penalty-points">${p.penalty > 0 ? '+' : ''}${p.penalty} 分</div>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        ` : '<p class="text-muted">暂无扣分记录</p>'}
      </div>

      <div class="decisions-review">
        <h3>🔍 决策回顾</h3>
        <div class="timeline">
          ${decisionHistory.map((d, i) => `
            <div class="timeline-item">
              <div class="timeline-marker"></div>
              <div class="timeline-content">
                <div class="timeline-header">
                  <span class="timeline-step">第 ${i + 1} 步</span>
                  <span class="timeline-event">${d.eventTitle}</span>
                </div>
                <div class="timeline-decision">
                  <strong>选择：</strong>${d.decisionLabel}
                </div>
                <div class="timeline-explanation">
                  <strong>分析：</strong>${d.explanation}
                </div>
                ${d.warnings.length > 0 ? `
                  <div class="timeline-warnings">
                    ${d.warnings.map(w => `<div class="warning-text">⚠️ ${w}</div>`).join('')}
                  </div>
                ` : ''}
                <div class="timeline-state">
                  <strong>状态：</strong>
                  水位 ${d.stateAfter.waterLevel.toFixed(1)}m |
                  库容 ${d.stateAfter.storage.toFixed(0)}万m³ |
                  下泄 ${d.stateAfter.discharge.toFixed(0)}m³/s |
                  得分 ${d.stateAfter.score}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="settlement-actions">
        <button class="btn btn-primary" id="btn-again">再玩一局</button>
        <button class="btn btn-secondary" id="btn-home">返回首页</button>
        <button class="btn btn-outline" id="btn-history">查看记录</button>
      </div>
    `;

    document.getElementById('btn-again').addEventListener('click', () => {
      this.startGame(this.controller.currentLevel.id, this.controller.playerName);
    });
    document.getElementById('btn-home').addEventListener('click', () => this.renderHome());
    document.getElementById('btn-history').addEventListener('click', () => {
      this.selectedRecordId = recordId;
      this.renderHistory();
    });
  }

  calculatePenaltyDetails(decisionHistory) {
    return decisionHistory
      .filter(d => {
        const scoreEffect = d.effects.score;
        return scoreEffect !== undefined && scoreEffect !== 0;
      })
      .map(d => ({
        eventTitle: d.eventTitle,
        decisionLabel: d.decisionLabel,
        explanation: d.explanation,
        penalty: d.effects.score || 0
      }));
  }

  renderHistory() {
    this.currentView = 'history';
    this.updateNav('history');
    const app = document.getElementById('app');
    const historyManager = this.controller.getHistoryManager();

    const params = new URLSearchParams(window.location.search);
    const filterStatus = params.get('status') || '';
    const filterLevel = params.get('level') || '';

    const filters = {};
    if (filterStatus) filters.status = filterStatus;
    if (filterLevel) filters.levelId = filterLevel;

    const records = historyManager.getRecords(filters);
    const stats = historyManager.getStatistics();
    const levels = this.controller.getLevels();

    app.innerHTML = `
      <div class="page-header">
        <h1>📚 历史记录</h1>
        <p class="subtitle">共 ${records.length} 条记录</p>
      </div>

      <div class="history-toolbar">
        <div class="filter-group">
          <select id="filter-status">
            <option value="">全部状态</option>
            <option value="normal" ${filterStatus === 'normal' ? 'selected' : ''}>正常</option>
            <option value="has_warnings" ${filterStatus === 'has_warnings' ? 'selected' : ''}>有警告</option>
            <option value="needs_manual_review" ${filterStatus === 'needs_manual_review' ? 'selected' : ''}>待确认</option>
            <option value="reviewed" ${filterStatus === 'reviewed' ? 'selected' : ''}>已复核</option>
          </select>

          <select id="filter-level">
            <option value="">全部关卡</option>
            ${levels.map(l => `
              <option value="${l.id}" ${filterLevel === l.id ? 'selected' : ''}>
                ${l.name || '(未命名)'}
              </option>
            `).join('')}
          </select>

          <label class="checkbox-label">
            <input type="checkbox" id="filter-old" /> 只看旧口径
          </label>
        </div>

        <div class="action-group">
          <button class="btn btn-primary" id="btn-import-old">导入旧口径</button>
          <button class="btn btn-danger" id="btn-clear-history">清空记录</button>
        </div>
      </div>

      <div class="stats-summary">
        <div class="stat-chip">
          <span class="chip-value">${stats.total}</span>
          <span class="chip-label">总记录</span>
        </div>
        <div class="stat-chip status-normal">
          <span class="chip-value">${stats.normal}</span>
          <span class="chip-label">正常</span>
        </div>
        <div class="stat-chip status-warning">
          <span class="chip-value">${stats.needsReview}</span>
          <span class="chip-label">待确认</span>
        </div>
        <div class="stat-chip status-warning">
          <span class="chip-value">${stats.hasWarnings}</span>
          <span class="chip-label">有警告</span>
        </div>
        <div class="stat-chip status-reviewed">
          <span class="chip-value">${stats.reviewed}</span>
          <span class="chip-label">已复核</span>
        </div>
        <div class="stat-chip status-old">
          <span class="chip-value">${stats.oldCaliber}</span>
          <span class="chip-label">旧口径</span>
        </div>
      </div>

      <div class="records-list">
        ${records.length > 0 ? records.map(record => this.renderRecordCard(record)).join('') : `
          <div class="empty-state">
            <div class="empty-icon">📭</div>
            <p>暂无历史记录</p>
            <p class="text-muted">玩一局游戏后记录将显示在这里</p>
          </div>
        `}
      </div>

      ${this.selectedRecordId ? `
        <div id="record-detail-modal" class="modal-overlay">
          <div class="modal-content">
            ${this.renderRecordDetail(this.selectedRecordId)}
          </div>
        </div>
      ` : ''}
    `;

    this.bindHistoryEvents();
  }

  renderRecordCard(record) {
    const statusLabels = {
      'normal': { label: '正常', class: 'badge-success' },
      'has_warnings': { label: '有警告', class: 'badge-warning' },
      'needs_manual_review': { label: '待确认', class: 'badge-danger' },
      'reviewed': { label: '已复核', class: 'badge-reviewed' }
    };
    const status = statusLabels[record.status] || statusLabels.normal;

    return `
      <div class="record-card ${record.isOldCaliber ? 'old-caliber' : ''}" data-record-id="${record.id}">
        <div class="record-header">
          <div class="record-title">
            <span class="record-level">${record.levelName}</span>
            ${record.isOldCaliber ? '<span class="badge badge-old">📜 旧口径</span>' : ''}
            <span class="badge ${status.class}">${status.label}</span>
          </div>
          <span class="record-time">${Utils.formatDateTime(record.createdAt)}</span>
        </div>
        <div class="record-body">
          <div class="record-meta">
            <span>👤 ${record.playerName}</span>
            <span>⏱️ ${record.durationFormatted}</span>
            <span>⭐ ${record.finalScore} 分</span>
            <span>🏅 ${record.grade}</span>
          </div>
          <div class="record-summary">
            ${record.decisionHistory ? `处理 ${record.decisionHistory.length} 个事件` : ''}
            ${record.penaltyPoints > 0 ? ` · 扣 ${record.penaltyPoints} 分` : ''}
            ${record.source ? ` · 来源：${record.source}` : ''}
          </div>
          ${record.reviewNote ? `
            <div class="record-note">
              <strong>复核备注：</strong>${record.reviewNote}
            </div>
          ` : ''}
        </div>
        <div class="record-actions">
          <button class="btn btn-small btn-primary" data-action="view">查看详情</button>
          ${record.status === 'needs_manual_review' ? `
            <button class="btn btn-small btn-success" data-action="review">标记已复核</button>
          ` : ''}
          <button class="btn btn-small btn-danger" data-action="delete">删除</button>
        </div>
      </div>
    `;
  }

  renderRecordDetail(recordId) {
    const record = this.controller.getHistoryManager().getRecordById(recordId);
    if (!record) return '<p>记录不存在</p>';

    return `
      <div class="modal-header">
        <h2>📋 记录详情</h2>
        <button class="btn-close" id="btn-close-modal">&times;</button>
      </div>
      <div class="modal-body">
        <div class="detail-section">
          <h3>基本信息</h3>
          <div class="detail-grid">
            <div><strong>记录ID：</strong>${record.id}</div>
            <div><strong>关卡：</strong>${record.levelName}</div>
            <div><strong>学员：</strong>${record.playerName}</div>
            <div><strong>时间：</strong>${Utils.formatDateTime(record.createdAt)}</div>
            <div><strong>用时：</strong>${record.durationFormatted}</div>
            <div><strong>得分：</strong>${record.finalScore} / ${record.grade}</div>
            <div><strong>状态：</strong>${record.status}</div>
            <div><strong>来源：</strong>${record.isOldCaliber ? `旧口径 (${record.source})` : '系统生成'}</div>
          </div>
        </div>

        ${record.decisionHistory ? `
          <div class="detail-section">
            <h3>决策过程</h3>
            ${record.decisionHistory.map((d, i) => `
              <div class="decision-step">
                <div class="step-header">
                  <span class="step-number">${i + 1}</span>
                  <span class="step-title">${d.eventTitle}</span>
                </div>
                <div class="step-content">
                  <p><strong>选择：</strong>${d.decisionLabel}</p>
                  <p><strong>分析：</strong>${d.explanation}</p>
                  ${d.warnings && d.warnings.length > 0 ? `
                    <div class="step-warnings">
                      ${d.warnings.map(w => `<div class="warning-item">⚠️ ${w}</div>`).join('')}
                    </div>
                  ` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${record.reviewNote ? `
          <div class="detail-section">
            <h3>复核备注</h3>
            <p>${record.reviewNote}</p>
          </div>
        ` : ''}
      </div>
      <div class="modal-footer">
        ${record.status === 'needs_manual_review' ? `
          <button class="btn btn-success" id="btn-mark-reviewed">标记已复核</button>
        ` : ''}
        <button class="btn btn-secondary" id="btn-close-modal2">关闭</button>
      </div>
    `;
  }

  bindHistoryEvents() {
    document.getElementById('filter-status')?.addEventListener('change', (e) => {
      const url = new URL(window.location);
      if (e.target.value) url.searchParams.set('status', e.target.value);
      else url.searchParams.delete('status');
      window.history.replaceState({}, '', url);
      this.renderHistory();
    });

    document.getElementById('filter-level')?.addEventListener('change', (e) => {
      const url = new URL(window.location);
      if (e.target.value) url.searchParams.set('level', e.target.value);
      else url.searchParams.delete('level');
      window.history.replaceState({}, '', url);
      this.renderHistory();
    });

    document.getElementById('filter-old')?.addEventListener('change', (e) => {
      const records = document.querySelectorAll('.record-card');
      records.forEach(card => {
        if (e.target.checked) {
          card.style.display = card.classList.contains('old-caliber') ? '' : 'none';
        } else {
          card.style.display = '';
        }
      });
    });

    document.querySelectorAll('.record-card').forEach(card => {
      const recordId = card.dataset.recordId;

      card.querySelector('[data-action="view"]')?.addEventListener('click', () => {
        this.selectedRecordId = recordId;
        this.renderHistory();
      });

      card.querySelector('[data-action="review"]')?.addEventListener('click', () => {
        const note = prompt('请输入复核备注（可选）：');
        if (note !== null) {
          this.controller.getHistoryManager().markAsReviewed(recordId, '老冯', note);
          alert('已标记为已复核');
          this.renderHistory();
        }
      });

      card.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
        if (confirm('确定要删除这条记录吗？')) {
          this.controller.getHistoryManager().deleteRecord(recordId);
          this.renderHistory();
        }
      });
    });

    document.getElementById('btn-close-modal')?.addEventListener('click', () => {
      this.selectedRecordId = null;
      this.renderHistory();
    });

    document.getElementById('btn-close-modal2')?.addEventListener('click', () => {
      this.selectedRecordId = null;
      this.renderHistory();
    });

    document.getElementById('btn-mark-reviewed')?.addEventListener('click', () => {
      const note = prompt('请输入复核备注（可选）：');
      if (note !== null) {
        this.controller.getHistoryManager().markAsReviewed(this.selectedRecordId, '老冯', note);
        this.selectedRecordId = null;
        this.renderHistory();
      }
    });

    document.getElementById('btn-import-old')?.addEventListener('click', () => this.importOldCaliberData());
    document.getElementById('btn-clear-history')?.addEventListener('click', () => this.clearAllHistory());
  }

  importOldCaliberData() {
    const oldRecords = [
      {
        levelId: 'level_001',
        levelName: '汛期第一轮洪峰',
        playerName: '李四（2024级）',
        finalScore: 72,
        grade: 'C',
        status: 'normal',
        duration: 180000,
        durationFormatted: '3分0秒',
        penaltyPoints: 28,
        decisionHistory: [
          {
            eventTitle: '气象预警',
            decisionLabel: '维持50m³/s，观察雨情',
            explanation: '未及时预泄，库容占用过多',
            effects: { storage: 200, score: -5 },
            stateAfter: { waterLevel: 152, storage: 3200, discharge: 50, score: 95 }
          },
          {
            eventTitle: '洪峰入境',
            decisionLabel: '加大下泄至250m³/s',
            explanation: '下泄不足，水位继续上涨',
            effects: { discharge: 150, score: -5 },
            stateAfter: { waterLevel: 165, storage: 3800, discharge: 250, score: 90 }
          },
          {
            eventTitle: '洪峰过境',
            decisionLabel: '立即关闭至50m³/s',
            explanation: '拦蓄过多，水位居高不下',
            effects: { storage: 300, score: -8 },
            stateAfter: { waterLevel: 170, storage: 4100, discharge: 50, score: 82 }
          }
        ],
        createdAt: Date.now() - 86400000 * 30,
        source: '老师错题本 - 2024年春季培训'
      }
    ];

    const imported = oldRecords.map(r =>
      this.controller.getHistoryManager().importOldRecord(r, r.source)
    );

    alert(`成功导入 ${imported.length} 条旧口径记录`);
    this.renderHistory();
  }

  clearAllHistory() {
    if (confirm('确定要清空所有历史记录吗？此操作不可恢复。')) {
      this.controller.getHistoryManager().clearAllRecords();
      this.renderHistory();
    }
  }

  updateNav(active) {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
    });
    document.getElementById(`nav-${active}`)?.classList.add('active');
  }
}
