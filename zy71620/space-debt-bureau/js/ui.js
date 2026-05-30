const UI = (function () {
  const screens = {
    menu: document.getElementById('screen-menu'),
    dataImport: document.getElementById('screen-import'),
    playing: document.getElementById('screen-playing'),
    paused: document.getElementById('screen-paused'),
    gameOver: document.getElementById('gameover-overlay'),
    settlement: document.getElementById('screen-settlement')
  };

  function showScreen(name) {
    Object.values(screens).forEach(s => { if (s) s.classList.remove('active'); });
    if (screens[name]) screens[name].classList.add('active');
  }

  function formatMoney(n) {
    if (n == null || isNaN(n)) return '---';
    return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatRate(r) {
    if (r == null || isNaN(r)) return '---';
    return (r * 100).toFixed(2) + '%';
  }

  function riskBadge(risk) {
    const map = {
      low: '<span class="badge badge-low">低风险</span>',
      medium: '<span class="badge badge-medium">中风险</span>',
      high: '<span class="badge badge-high">高风险</span>'
    };
    return map[risk] || '';
  }

  function sourceTag(source) {
    if (!source) return '<span class="source-tag">未知来源</span>';
    return `<span class="source-tag" title="${source.name || ''}">${DataModule.sourceLabel(source)}</span>`;
  }

  function flagTags(flags) {
    if (!flags || flags.length === 0) return '';
    return flags.map(f => `<span class="flag-tag">${f}</span>`).join('');
  }

  function renderStatusBar(state) {
    const debtSummary = FinancialEngine.computeDebtSummary(state.loans);
    const cashStatus = FinancialEngine.checkCashStatus(state.cash);
    const bar = document.getElementById('status-bar');
    if (!bar) return;
    bar.innerHTML = `
      <div class="status-item status-turn">
        <span class="status-label">回合</span>
        <span class="status-value">${state.turn} / ${state.maxTurns}</span>
      </div>
      <div class="status-item status-cash ${cashStatus.status}">
        <span class="status-label">现金</span>
        <span class="status-value">${formatMoney(state.cash)}</span>
      </div>
      <div class="status-item status-debt">
        <span class="status-label">总负债</span>
        <span class="status-value">${formatMoney(debtSummary.totalDebt)}</span>
      </div>
      <div class="status-item status-fuel">
        <span class="status-label">燃料</span>
        <span class="status-value">${state.fuel}</span>
      </div>
      <div class="status-item status-loans">
        <span class="status-label">活跃贷款</span>
        <span class="status-value">${debtSummary.loanCount}笔</span>
      </div>
    `;
  }

  function renderLoans(state) {
    const container = document.getElementById('loans-panel');
    if (!container) return;
    const activeLoans = state.loans.filter(l => !l.fullyPaid);
    const paidLoans = state.loans.filter(l => l.fullyPaid);
    let html = '<h3 class="panel-title">债务状况</h3>';
    if (activeLoans.length > 0) {
      html += '<div class="loan-list">';
      activeLoans.forEach(loan => {
        const isEmergency = loan.isEmergency;
        const isOverdue = loan.dueTurn != null && loan.dueTurn <= state.turn;
        html += `
          <div class="loan-card ${isEmergency ? 'emergency' : ''} ${isOverdue ? 'overdue' : ''}">
            <div class="loan-header">
              <span class="loan-id">${loan.id}</span>
              ${isEmergency ? '<span class="badge badge-emergency">紧急贷款</span>' : ''}
              ${isOverdue ? '<span class="badge badge-overdue">已逾期</span>' : ''}
              ${flagTags(loan.flags)}
            </div>
            <div class="loan-body">
              <div class="loan-detail"><span>本金:</span><span>${formatMoney(loan.principal)}</span></div>
              <div class="loan-detail"><span>利率:</span><span class="${loan.interestRate > 0.15 ? 'text-danger' : ''}">${formatRate(loan.interestRate)}</span></div>
              <div class="loan-detail"><span>已计利息:</span><span class="text-warning">${formatMoney(loan.accruedInterest || 0)}</span></div>
              <div class="loan-detail"><span>到期:</span><span>第${loan.dueTurn || '?'}回合</span></div>
            </div>
            <div class="loan-source">${sourceTag(loan.source)}</div>
            <div class="loan-repay-input">
              <label>还款金额:</label>
              <input type="number" min="0" step="100" value="${state.repaymentAmounts[loan.id] || 0}"
                data-loan-id="${loan.id}" class="repay-input" placeholder="0">
            </div>
          </div>
        `;
      });
      html += '</div>';
    }
    if (paidLoans.length > 0) {
      html += '<div class="paid-loans"><span class="text-success">已还清: ' + paidLoans.map(l => l.id).join(', ') + '</span></div>';
    }
    container.innerHTML = html;
    container.querySelectorAll('.repay-input').forEach(input => {
      input.addEventListener('input', function () {
        Game.setRepaymentAmount(this.dataset.loanId, parseFloat(this.value) || 0);
      });
    });
  }

  function renderOrders(state) {
    const container = document.getElementById('orders-panel');
    if (!container) return;
    let html = '<h3 class="panel-title">可选航线订单</h3>';
    if (state.availableOrders.length === 0) {
      html += '<p class="text-muted">本回合无可用订单</p>';
    } else {
      html += '<div class="order-list">';
      state.availableOrders.forEach(order => {
        const selected = state.selectedOrderIds.includes(order.id);
        const netRevenue = (order.revenue || 0) - (order.fuelCost || 0);
        html += `
          <div class="order-card ${selected ? 'selected' : ''}" data-order-id="${order.id}">
            <div class="order-header">
              <span class="order-name">${order.name}</span>
              ${riskBadge(order.risk)}
              ${flagTags(order.flags)}
            </div>
            <div class="order-body">
              <div class="order-detail"><span>航线:</span><span>${order.route}</span></div>
              <div class="order-detail"><span>收入:</span><span class="text-success">${formatMoney(order.revenue)}</span></div>
              <div class="order-detail"><span>燃料费:</span><span class="text-danger">${formatMoney(order.fuelCost)}</span></div>
              <div class="order-detail"><span>净收益:</span><span class="${netRevenue >= 0 ? 'text-success' : 'text-danger'}">${formatMoney(netRevenue)}</span></div>
              <div class="order-detail"><span>需燃料:</span><span>${order.minFuel}单位</span></div>
              <div class="order-detail"><span>耗时:</span><span>${order.duration}回合</span></div>
            </div>
            <div class="order-source">${sourceTag(order.source)}</div>
            <button class="btn-order ${selected ? 'btn-deselect' : 'btn-select'}" data-order-id="${order.id}">
              ${selected ? '取消选择' : '选择订单'}
            </button>
          </div>
        `;
      });
      html += '</div>';
    }
    html += `
      <div class="fuel-section">
        <h4>燃料补给</h4>
        <div class="fuel-buy">
          <span>购买数量: <input type="range" id="fuel-slider" min="0" max="100" value="${state.fuelBuyAmount}" step="5"></span>
          <span id="fuel-buy-display">${state.fuelBuyAmount} 单位 (${formatMoney(state.fuelBuyAmount * state.fuelPrice)})</span>
          <span>当前燃料: ${state.fuel} → ${state.fuel + state.fuelBuyAmount}</span>
        </div>
      </div>
    `;
    container.innerHTML = html;
    container.querySelectorAll('.btn-order').forEach(btn => {
      btn.addEventListener('click', function () {
        const orderId = this.dataset.orderId;
        if (state.selectedOrderIds.includes(orderId)) {
          Game.deselectOrder(orderId);
        } else {
          Game.selectOrder(orderId);
        }
      });
    });
    const fuelSlider = document.getElementById('fuel-slider');
    if (fuelSlider) {
      fuelSlider.addEventListener('input', function () {
        Game.setFuelBuy(parseInt(this.value));
        const display = document.getElementById('fuel-buy-display');
        if (display) {
          const st = Game.getState();
          display.textContent = `${st.fuelBuyAmount} 单位 (${formatMoney(st.fuelBuyAmount * st.fuelPrice)})`;
        }
      });
    }
  }

  function renderTurnLog(state) {
    const container = document.getElementById('log-panel');
    if (!container) return;
    let html = '<h3 class="panel-title">回合记录</h3>';
    if (state.turnLog.length === 0) {
      html += '<p class="text-muted">暂无记录</p>';
    } else {
      html += '<div class="log-list">';
      [...state.turnLog].reverse().forEach(record => {
        const cashFlow = FinancialEngine.calculateCashFlow(record);
        html += `
          <div class="log-entry">
            <div class="log-header">
              <span>第${record.turn}回合</span>
              <span class="${cashFlow.net >= 0 ? 'text-success' : 'text-danger'}">净现金流: ${formatMoney(cashFlow.net)}</span>
            </div>
            <div class="log-body">
              <div>收入: ${formatMoney(record.revenue)} | 燃料费: ${formatMoney(record.fuelExpense)} | 利息: ${formatMoney(record.interestAccrued)} | 还款: ${formatMoney(record.repaymentTotal)}</div>
              <div>期初现金: ${formatMoney(record.startingCash)} → 期末现金: ${formatMoney(record.endingCash)}</div>
              ${record.ordersCompleted.length > 0 ? `<div>完成订单: ${record.ordersCompleted.map(o => o.name).join(', ')}</div>` : ''}
              ${record.ordersSkipped.length > 0 ? `<div class="text-warning">跳过订单: ${record.ordersSkipped.map(o => o.name + '(' + o.reason + ')').join(', ')}</div>` : ''}
              ${record.emergencyLoanCreated ? `<div class="text-danger">⚠️ 产生紧急贷款: ${formatMoney(record.emergencyLoanCreated.principal)}</div>` : ''}
              ${(record.errors || []).length > 0 ? record.errors.map(e => `<div class="text-danger error-entry">❌ ${e.msg}</div>`).join('') : ''}
              ${(record.warnings || []).length > 0 ? record.warnings.map(w => `<div class="text-warning">⚠️ ${w.msg}</div>`).join('') : ''}
              ${record.repaymentBreakdown.length > 0 ? record.repaymentBreakdown.map(rb =>
                `<div class="repayment-detail">还款${rb.loanId}: 计划${formatMoney(rb.planned)} 实际${formatMoney(rb.actual)} (利息${formatMoney(rb.toInterest)} + 本金${formatMoney(rb.toPrincipal)})</div>`
              ).join('') : ''}
            </div>
          </div>
        `;
      });
      html += '</div>';
    }
    container.innerHTML = html;
  }

  function renderWarnings(state) {
    const container = document.getElementById('warnings-panel');
    if (!container) return;
    let html = '';
    if (state.errors.length > 0) {
      html += '<div class="alert alert-error"><strong>错误:</strong>';
      state.errors.forEach(e => {
        html += `<div class="error-item">${e.msg}`;
        if (e.impact) html += `<span class="impact"> → ${e.impact}</span>`;
        if (e.affectedLoanId) html += `<span class="affected"> [影响: 借款${e.affectedLoanId}]</span>`;
        html += '</div>';
      });
      html += '</div>';
    }
    if (state.warnings.length > 0) {
      html += '<div class="alert alert-warning"><strong>风险提示:</strong>';
      state.warnings.forEach(w => {
        html += `<div class="warning-item">${w.msg}`;
        if (w.impact) html += `<span class="impact"> → ${w.impact}</span>`;
        html += '</div>';
      });
      html += '</div>';
    }
    container.innerHTML = html;
  }

  let selectedDataPack = null;

  function renderImportScreen() {
    const container = document.getElementById('import-content');
    if (!container) return;
    const dataPack = DataModule.SAMPLE_DATA_PACK;
    selectedDataPack = dataPack;
    const report = DataModule.validateDataPack(dataPack);
    let html = `
      <div class="import-preview">
        <h3>数据包: ${dataPack.name}</h3>
        <p>${dataPack.description}</p>
        <div class="data-summary">
          <span>借款单: ${dataPack.loans.length}条</span>
          <span>航线订单: ${dataPack.orders.length}条</span>
          <span>利率事件: ${dataPack.rateEvents.length}条</span>
          <span>还款计划: ${dataPack.repayments.length}条</span>
        </div>
        <div class="import-issues">
    `;
    if (report.loanErrors.length > 0) {
      html += '<div class="issue-group"><h4>借款记录问题</h4>';
      report.loanErrors.forEach(e => {
        html += `<div class="issue-item">${e.loanId || '未知'}: ${e.errors.map(err => err.msg).join('; ')} ${sourceTag(e.source)}</div>`;
      });
      html += '</div>';
    }
    if (report.orderErrors.length > 0) {
      html += '<div class="issue-group"><h4>订单记录问题</h4>';
      report.orderErrors.forEach(e => {
        html += `<div class="issue-item">${e.orderId || '未知'}: ${e.errors.map(err => err.msg).join('; ')} ${sourceTag(e.source)}</div>`;
      });
      html += '</div>';
    }
    if (report.eventErrors.length > 0) {
      html += '<div class="issue-group"><h4>利率事件问题</h4>';
      report.eventErrors.forEach(e => {
        html += `<div class="issue-item">${e.eventId || '未知'}: ${e.errors.map(err => err.msg).join('; ')} ${sourceTag(e.source)}</div>`;
      });
      html += '</div>';
    }
    if (report.repaymentErrors.length > 0) {
      html += '<div class="issue-group"><h4>还款计划问题</h4>';
      report.repaymentErrors.forEach(e => {
        html += `<div class="issue-item">${e.planId || '未知'}: ${e.errors.map(err => err.msg).join('; ')} ${sourceTag(e.source)}</div>`;
      });
      html += '</div>';
    }
    html += '</div>';
    html += `
      <div class="import-json-section">
        <h4>自定义导入</h4>
        <textarea id="import-json-input" rows="6" placeholder="粘贴JSON数据包..."></textarea>
        <button id="btn-import-json" class="btn btn-secondary">导入JSON</button>
        <div id="import-json-result"></div>
      </div>
    `;
    html += `<button id="btn-start-game" class="btn btn-primary btn-large">开始游戏</button>`;
    html += '</div>';
    container.innerHTML = html;

    document.getElementById('btn-start-game').addEventListener('click', function () {
      Game.startNewGame(selectedDataPack);
    });

    document.getElementById('btn-import-json')?.addEventListener('click', function () {
      const jsonInput = document.getElementById('import-json-input').value.trim();
      if (!jsonInput) return;
      const result = DataModule.importFromJSON(jsonInput);
      const resultDiv = document.getElementById('import-json-result');
      if (result.success) {
        resultDiv.innerHTML = '<span class="text-success">JSON解析成功，验证中...</span>';
        const validation = DataModule.validateDataPack(result.data);
        const totalErrors = validation.loanErrors.length + validation.orderErrors.length + validation.eventErrors.length + validation.repaymentErrors.length;
        resultDiv.innerHTML = `<span class="text-success">验证完成，发现${totalErrors}个问题</span>`;
        selectedDataPack = result.data;
      } else {
        resultDiv.innerHTML = `<span class="text-danger">${result.error}</span>`;
      }
    });
  }

  function renderGameOver(state) {
    const overlay = document.getElementById('gameover-overlay');
    if (!overlay) return;
    const reasonMap = {
      victory: { title: '🎉 全部债务已清偿！', class: 'victory', desc: '你成功还清了所有贷款，太空债务清偿局为你骄傲！' },
      bankrupt: { title: '💀 资金链断裂，破产！', class: 'bankrupt', desc: '连续3回合现金为负，公司被迫破产清算。' },
      timeout: { title: '⏰ 时间耗尽！', class: 'timeout', desc: '未能在规定回合内还清所有债务。' }
    };
    const info = reasonMap[state.gameOverReason] || reasonMap.timeout;
    const debtSummary = FinancialEngine.computeDebtSummary(state.loans);
    overlay.innerHTML = `
      <div class="gameover-content ${info.class}">
        <h2>${info.title}</h2>
        <p>${info.desc}</p>
        <div class="gameover-stats">
          <div>经历回合: ${state.history.length}</div>
          <div>最终现金: ${formatMoney(state.cash)}</div>
          <div>剩余债务: ${formatMoney(debtSummary.totalDebt)}</div>
          <div>紧急贷款: ${state.loans.filter(l => l.isEmergency).length}笔</div>
        </div>
        <div class="gameover-actions">
          <button id="btn-settlement" class="btn btn-primary">查看结算报告</button>
          <button id="btn-restart-from-over" class="btn btn-secondary">重新开始</button>
        </div>
      </div>
    `;
    overlay.classList.add('active');
    document.getElementById('btn-settlement').addEventListener('click', function () {
      showSettlement(state);
    });
    document.getElementById('btn-restart-from-over').addEventListener('click', function () {
      overlay.classList.remove('active');
      Game.restart();
    });
  }

  function showSettlement(state) {
    const report = Game.getSettlementReport();
    if (!report) return;
    showScreen('settlement');
    const container = document.getElementById('settlement-content');
    if (!container) return;

    let html = `
      <h2>太空债务清偿局 · 结算报告</h2>
      <div class="settlement-section">
        <h3>经营概况</h3>
        <div class="report-grid">
          <div class="report-item"><span>最终结果</span><span>${report.gameOverReason === 'victory' ? '胜利' : report.gameOverReason === 'bankrupt' ? '破产' : '超时'}</span></div>
          <div class="report-item"><span>经历回合</span><span>${report.turnsPlayed} / ${report.maxTurns}</span></div>
          <div class="report-item"><span>最终现金</span><span>${formatMoney(report.finalCash)}</span></div>
          <div class="report-item"><span>总收入</span><span class="text-success">${formatMoney(report.totalRevenue)}</span></div>
          <div class="report-item"><span>总燃料费</span><span class="text-danger">${formatMoney(report.totalFuelExpense)}</span></div>
          <div class="report-item"><span>总购油费</span><span class="text-danger">${formatMoney(report.totalPurchaseExpense)}</span></div>
          <div class="report-item"><span>总利息产生</span><span class="text-warning">${formatMoney(report.totalInterestAccrued)}</span></div>
          <div class="report-item"><span>总还款金额</span><span>${formatMoney(report.totalRepayment)}</span></div>
        </div>
      </div>
      <div class="settlement-section">
        <h3>债务终态</h3>
        <div class="report-grid">
          <div class="report-item"><span>剩余本金</span><span class="text-danger">${formatMoney(report.remainingDebt.totalPrincipal)}</span></div>
          <div class="report-item"><span>剩余利息</span><span class="text-warning">${formatMoney(report.remainingDebt.totalInterest)}</span></div>
          <div class="report-item"><span>总剩余债务</span><span class="text-danger">${formatMoney(report.remainingDebt.totalDebt)}</span></div>
          <div class="report-item"><span>紧急贷款</span><span>${report.emergencyLoanCount}笔 / ${formatMoney(report.totalEmergencyDebt)}</span></div>
        </div>
      </div>
    `;

    if (report.processingLog && report.processingLog.length > 0) {
      html += '<div class="settlement-section"><h3>数据处理记录</h3><div class="processing-log">';
      report.processingLog.forEach(log => {
        const actionLabel = log.action === 'skipped' ? '<span class="text-danger">跳过</span>' : '<span class="text-warning">补默认值</span>';
        html += `<div class="log-item">${actionLabel} [${log.type}:${log.id}] ${log.reason} ${sourceTag(log.source)}</div>`;
      });
      html += '</div></div>';
    }

    if (report.errors && report.errors.length > 0) {
      html += '<div class="settlement-section"><h3>错误追踪</h3><div class="error-log">';
      report.errors.forEach(e => {
        html += `<div class="error-item">第${e.turn}回合: ${e.msg}`;
        if (e.loanId) html += ` [影响借款: ${e.loanId}]`;
        if (e.emergencyLoanId) html += ` [紧急贷款: ${e.emergencyLoanId}]`;
        html += '</div>';
      });
      html += '</div></div>';
    }

    if (report.riskAnalysis && report.riskAnalysis.length > 0) {
      html += '<div class="settlement-section"><h3>风险分析与建议</h3><div class="risk-analysis">';
      report.riskAnalysis.forEach(r => {
        const severityClass = r.severity === 'critical' ? 'text-danger' : r.severity === 'warning' ? 'text-warning' : 'text-info';
        html += `<div class="risk-item ${severityClass}">
          <div class="risk-msg">${r.msg}</div>
          <div class="risk-suggestion">💡 ${r.suggestion}</div>
        </div>`;
      });
      html += '</div></div>';
    }

    html += '<div class="settlement-section"><h3>贷款终态明细</h3><div class="loan-final-list">';
    report.loanFinalState.forEach(l => {
      html += `<div class="loan-final-item ${l.fullyPaid ? 'paid' : 'unpaid'}">
        <span>${l.id}${l.isEmergency ? ' (紧急)' : ''}</span>
        <span>本金: ${formatMoney(l.principal)}</span>
        <span>利息: ${formatMoney(l.accruedInterest)}</span>
        <span>利率: ${formatRate(l.interestRate)}</span>
        <span>${l.fullyPaid ? '✅已清' : '❌未清'}</span>
        <span class="source-tag-small">${DataModule.sourceLabel(l.source)}</span>
      </div>`;
    });
    html += '</div></div>';

    html += `
      <div class="settlement-actions">
        <button id="btn-export-report" class="btn btn-primary">导出报告(JSON)</button>
        <button id="btn-restart-from-settlement" class="btn btn-secondary">重新开始</button>
      </div>
    `;
    container.innerHTML = html;

    document.getElementById('btn-export-report').addEventListener('click', function () {
      const exportData = Game.exportReport();
      if (!exportData) return;
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `太空债务清偿局-结算报告-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    document.getElementById('btn-restart-from-settlement').addEventListener('click', function () {
      document.getElementById('gameover-overlay')?.classList.remove('active');
      Game.restart();
    });
  }

  function updateGameScreen(state) {
    renderStatusBar(state);
    renderLoans(state);
    renderOrders(state);
    renderTurnLog(state);
    renderWarnings(state);
  }

  function init() {
    document.getElementById('btn-menu-start')?.addEventListener('click', function () {
      showScreen('dataImport');
      renderImportScreen();
    });

    document.getElementById('btn-pause')?.addEventListener('click', function () {
      Game.pause();
    });

    document.getElementById('btn-resume')?.addEventListener('click', function () {
      Game.resume();
    });

    document.getElementById('btn-restart')?.addEventListener('click', function () {
      Game.restart();
    });

    document.getElementById('btn-execute-turn')?.addEventListener('click', function () {
      Game.executeTurn();
    });

    Game.subscribe(function (eventType, state) {
      switch (eventType) {
        case 'gameStarted':
          showScreen('playing');
          updateGameScreen(state);
          break;
        case 'gameResumed':
          showScreen('playing');
          updateGameScreen(state);
          break;
        case 'gamePaused':
          showScreen('paused');
          break;
        case 'gameRestarted':
          document.getElementById('gameover-overlay')?.classList.remove('active');
          showScreen('playing');
          updateGameScreen(state);
          break;
        case 'turnExecuted':
        case 'orderSelected':
        case 'orderDeselected':
        case 'fuelBuyChanged':
        case 'repaymentChanged':
        case 'repaymentOrderChanged':
        case 'warning':
          updateGameScreen(state);
          break;
        case 'gameOver':
          renderGameOver(state);
          break;
      }
    });
  }

  return { init, showScreen, updateGameScreen };
})();
