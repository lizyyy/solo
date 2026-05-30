const Game = (function () {
  let state = null;
  let listeners = [];

  function subscribe(fn) {
    listeners.push(fn);
  }

  function notify(eventType, data) {
    listeners.forEach(fn => fn(eventType, data));
  }

  function createState(dataPack) {
    const { prepared, validationReport } = DataModule.cleanAndPrepare(dataPack);
    return {
      phase: 'playing',
      turn: 1,
      maxTurns: dataPack.maxTurns || 12,
      cash: dataPack.initialCash || 20000,
      fuel: dataPack.initialFuel || 60,
      fuelPrice: dataPack.fuelPrice || 500,
      loans: prepared.loans.map(l => ({ ...l, accruedInterest: 0, fullyPaid: false, paidThisTurn: false })),
      allOrders: prepared.orders,
      availableOrders: prepared.orders.filter(o => !o.flags.includes('missing-revenue')),
      activeOrders: [],
      completedOrdersThisTurn: [],
      rateEvents: prepared.rateEvents,
      repayments: prepared.repayments,
      processingLog: prepared.processingLog,
      validationReport,
      history: [],
      turnLog: [],
      errors: [],
      warnings: [],
      consecutiveNegativeCashTurns: 0,
      repaymentOrder: [],
      selectedOrderIds: [],
      fuelBuyAmount: 0,
      repaymentAmounts: {},
      dataPack
    };
  }

  function startNewGame(dataPack) {
    dataPack = dataPack || DataModule.SAMPLE_DATA_PACK;
    state = createState(dataPack);
    notify('gameStarted', state);
    return state;
  }

  function getState() {
    return state;
  }

  function pause() {
    if (state.phase !== 'playing') return;
    state.phase = 'paused';
    notify('gamePaused', state);
  }

  function resume() {
    if (state.phase !== 'paused') return;
    state.phase = 'playing';
    notify('gameResumed', state);
  }

  function restart() {
    const dataPack = state ? state.dataPack : DataModule.SAMPLE_DATA_PACK;
    state = createState(dataPack);
    notify('gameRestarted', state);
    return state;
  }

  function selectOrder(orderId) {
    if (state.phase !== 'playing') return;
    const order = state.availableOrders.find(o => o.id === orderId);
    if (!order) return;
    if (state.selectedOrderIds.includes(orderId)) return;
    const totalFuelNeeded = state.selectedOrderIds
      .map(id => state.availableOrders.find(o => o.id === id))
      .filter(Boolean)
      .reduce((s, o) => s + (o.minFuel || 0), 0) + (order.minFuel || 0);
    if (totalFuelNeeded > state.fuel + state.fuelBuyAmount) {
      state.warnings.push({
        msg: `燃料不足，无法承接订单"${order.name}"(需要${order.minFuel}，当前+购买=${state.fuel + state.fuelBuyAmount})`,
        type: 'fuel-shortage'
      });
      notify('warning', state);
      return;
    }
    state.selectedOrderIds.push(orderId);
    notify('orderSelected', state);
  }

  function deselectOrder(orderId) {
    state.selectedOrderIds = state.selectedOrderIds.filter(id => id !== orderId);
    notify('orderDeselected', state);
  }

  function setFuelBuy(amount) {
    state.fuelBuyAmount = Math.max(0, Math.floor(amount));
    notify('fuelBuyChanged', state);
  }

  function setRepaymentAmount(loanId, amount) {
    state.repaymentAmounts[loanId] = Math.max(0, amount);
    notify('repaymentChanged', state);
  }

  function setRepaymentOrder(order) {
    const issues = FinancialEngine.validateRepaymentOrder(state.loans, order);
    state.repaymentOrder = order;
    if (issues.length > 0) {
      state.warnings.push(...issues.map(i => ({ msg: i.msg, type: 'repayment-order' })));
    }
    notify('repaymentOrderChanged', state);
  }

  function executeTurn() {
    if (state.phase !== 'playing') return;

    const turnRecord = {
      turn: state.turn,
      startingCash: state.cash,
      startingFuel: state.fuel,
      revenue: 0,
      fuelExpense: 0,
      purchaseExpense: 0,
      interestAccrued: 0,
      repaymentTotal: 0,
      repaymentBreakdown: [],
      emergencyLoanCreated: null,
      endingCash: 0,
      endingFuel: 0,
      ordersCompleted: [],
      ordersSkipped: [],
      eventsTriggered: [],
      errors: [],
      warnings: [],
      loanSnapshots: []
    };

    state.warnings = [];
    state.errors = [];

    // Phase 1: Buy fuel
    if (state.fuelBuyAmount > 0) {
      const fuelCost = state.fuelBuyAmount * state.fuelPrice;
      if (fuelCost > state.cash) {
        const affordable = Math.floor(state.cash / state.fuelPrice);
        state.warnings.push({
          msg: `资金不足，仅能购买${affordable}单位燃料(计划${state.fuelBuyAmount})`,
          type: 'fuel-purchase'
        });
        state.fuel += affordable;
        state.cash -= affordable * state.fuelPrice;
        turnRecord.purchaseExpense = affordable * state.fuelPrice;
      } else {
        state.fuel += state.fuelBuyAmount;
        state.cash -= fuelCost;
        turnRecord.purchaseExpense = fuelCost;
      }
    }

    // Phase 2: Execute orders
    state.selectedOrderIds.forEach(orderId => {
      const order = state.availableOrders.find(o => o.id === orderId);
      if (!order) return;
      if (state.fuel < (order.minFuel || 0)) {
        turnRecord.ordersSkipped.push({ id: order.id, name: order.name, reason: '燃料不足' });
        state.warnings.push({
          msg: `订单"${order.name}"因燃料不足无法执行`,
          type: 'order-skipped'
        });
        return;
      }
      state.fuel -= (order.minFuel || 0);
      const netRevenue = (order.revenue || 0) - (order.fuelCost || 0);
      state.cash += netRevenue;
      turnRecord.revenue += (order.revenue || 0);
      turnRecord.fuelExpense += (order.fuelCost || 0);
      turnRecord.ordersCompleted.push({
        id: order.id,
        name: order.name,
        revenue: order.revenue,
        fuelCost: order.fuelCost,
        fuelUsed: order.minFuel,
        netRevenue
      });
    });

    // Phase 3: Apply interest rate events
    state.rateEvents.filter(e => e.turn === state.turn).forEach(evt => {
      turnRecord.eventsTriggered.push(evt);
      if (evt.newRate == null) {
        state.errors.push({
          msg: `利率事件"${evt.description}"缺少新利率数据，无法执行`,
          severity: 'error',
          source: evt.source,
          eventId: evt.id
        });
        turnRecord.errors.push({
          phase: 'rate-event',
          msg: `利率事件"${evt.description}"缺少新利率数据`,
          eventId: evt.id
        });
        return;
      }
      if (evt.loanId === 'all') {
        state.loans.forEach(loan => {
          if (!loan.fullyPaid) {
            loan.interestRate = evt.newRate;
          }
        });
      } else {
        const target = state.loans.find(l => l.id === evt.loanId);
        if (target && !target.fullyPaid) {
          target.interestRate = evt.newRate;
        }
      }
    });

    // Phase 4: Accrue interest on all active loans
    state.loans.filter(l => !l.fullyPaid).forEach(loan => {
      const result = FinancialEngine.applyInterest(loan, state.turn);
      const idx = state.loans.findIndex(l => l.id === loan.id);
      state.loans[idx] = result.loan;
      turnRecord.interestAccrued += result.interestAmount;
      if (result.error) {
        state.errors.push(result.error);
        turnRecord.errors.push({
          phase: 'interest',
          msg: result.error.msg,
          loanId: loan.id
        });
      }
    });

    // Phase 5: Process repayments
    const scheduledRepayments = state.repayments.filter(r => r.turn === state.turn);
    const repaymentSources = [
      ...scheduledRepayments.map(r => ({ loanId: r.loanId, amount: r.amount, source: 'scheduled', planId: r.id })),
      ...Object.entries(state.repaymentAmounts)
        .filter(([, amt]) => amt > 0)
        .map(([loanId, amount]) => ({ loanId, amount, source: 'manual' }))
    ];

    const orderedLoans = FinancialEngine.rankLoansByPriority(state.loans);
    const orderedLoanIds = orderedLoans.map(l => l.id);

    repaymentSources.sort((a, b) => {
      const aIdx = orderedLoanIds.indexOf(a.loanId);
      const bIdx = orderedLoanIds.indexOf(b.loanId);
      if (aIdx !== bIdx) return aIdx - bIdx;
      if (a.source === 'scheduled' && b.source !== 'scheduled') return -1;
      return 0;
    });

    repaymentSources.forEach(rp => {
      const loanIdx = state.loans.findIndex(l => l.id === rp.loanId);
      if (loanIdx === -1) {
        state.errors.push({
          msg: `还款失败：借款${rp.loanId}不存在`,
          severity: 'error',
          affectedLoanId: rp.loanId
        });
        return;
      }
      const loan = state.loans[loanIdx];
      if (loan.fullyPaid) {
        state.warnings.push({
          msg: `借款${rp.loanId}已还清，无需还款`,
          type: 'already-paid'
        });
        return;
      }
      const actualAmount = Math.min(rp.amount, state.cash);
      if (actualAmount < rp.amount) {
        state.warnings.push({
          msg: `借款${rp.loanId}计划还款${rp.amount}，但现金不足，实际还款${actualAmount}`,
          type: 'partial-repayment'
        });
      }
      if (actualAmount <= 0) return;

      const result = FinancialEngine.processRepayment(loan, actualAmount);
      state.loans[loanIdx] = result.loan;
      state.cash -= result.paid;
      state.cash = Math.round(state.cash * 100) / 100;
      turnRecord.repaymentTotal += result.paid;
      turnRecord.repaymentBreakdown.push({
        loanId: rp.loanId,
        planned: rp.amount,
        actual: result.paid,
        toInterest: result.breakdown.toInterest,
        toPrincipal: result.breakdown.toPrincipal,
        source: rp.source
      });
      if (result.remainingAmount > 0) {
        state.cash += result.remainingAmount;
      }
    });

    // Phase 6: Check cash status
    const cashStatus = FinancialEngine.checkCashStatus(state.cash);
    if (cashStatus.status === 'negative') {
      state.consecutiveNegativeCashTurns++;
      const emergencyLoan = FinancialEngine.generateEmergencyLoan(state.cash, state.turn);
      state.loans.push(emergencyLoan);
      state.cash = 0;
      turnRecord.emergencyLoanCreated = emergencyLoan;
      state.errors.push({
        msg: cashStatus.msg,
        severity: 'critical',
        impact: cashStatus.impact,
        emergencyLoanId: emergencyLoan.id
      });
      turnRecord.errors.push({
        phase: 'cash-negative',
        msg: cashStatus.msg,
        emergencyLoanId: emergencyLoan.id
      });
    } else {
      state.consecutiveNegativeCashTurns = 0;
    }
    if (cashStatus.severity === 'warning' || cashStatus.severity === 'info') {
      state.warnings.push({ msg: cashStatus.msg, type: 'cash-status', impact: cashStatus.impact });
    }

    // Snapshot loans
    state.loans.forEach(loan => {
      turnRecord.loanSnapshots.push({
        id: loan.id,
        principal: loan.principal,
        accruedInterest: loan.accruedInterest,
        interestRate: loan.interestRate,
        fullyPaid: loan.fullyPaid,
        isEmergency: loan.isEmergency || false
      });
    });

    turnRecord.endingCash = state.cash;
    turnRecord.endingFuel = state.fuel;
    turnRecord.warnings = [...state.warnings];
    turnRecord.errors = [...state.errors];

    state.history.push(turnRecord);
    state.turnLog.push(turnRecord);

    // Check game over conditions
    const allPaid = state.loans.every(l => l.fullyPaid);
    if (allPaid) {
      state.phase = 'gameover';
      state.gameOverReason = 'victory';
      notify('turnExecuted', state);
      notify('gameOver', state);
      return state;
    }

    if (state.consecutiveNegativeCashTurns >= 3) {
      state.phase = 'gameover';
      state.gameOverReason = 'bankrupt';
      notify('turnExecuted', state);
      notify('gameOver', state);
      return state;
    }

    if (state.turn >= state.maxTurns) {
      state.phase = 'gameover';
      state.gameOverReason = 'timeout';
      notify('turnExecuted', state);
      notify('gameOver', state);
      return state;
    }

    // Advance turn
    state.turn++;
    state.selectedOrderIds = [];
    state.fuelBuyAmount = 0;
    state.repaymentAmounts = {};
    state.availableOrders = generateNewOrders(state.turn);

    notify('turnExecuted', state);
    return state;
  }

  function generateNewOrders(turn) {
    const templates = [
      { name: '地火航线 · 补给运输', route: '地球→火星', revenue: 8000 + Math.floor(Math.random() * 6000), fuelCost: 2500 + Math.floor(Math.random() * 1500), duration: 1, risk: 'low', minFuel: 25 },
      { name: '火木航线 · 科技设备', route: '火星→木星', revenue: 22000 + Math.floor(Math.random() * 12000), fuelCost: 7000 + Math.floor(Math.random() * 3000), duration: 2, risk: 'medium', minFuel: 55 },
      { name: '木土航线 · 稀有矿物', route: '木星→土星', revenue: 38000 + Math.floor(Math.random() * 18000), fuelCost: 12000 + Math.floor(Math.random() * 6000), duration: 3, risk: 'high', minFuel: 85 },
      { name: '地月航线 · 邮件快送', route: '地球→月球', revenue: 3500 + Math.floor(Math.random() * 3000), fuelCost: 800 + Math.floor(Math.random() * 500), duration: 1, risk: 'low', minFuel: 10 },
      { name: '土天航线 · 危险品运输', route: '土星→天王星', revenue: 50000 + Math.floor(Math.random() * 25000), fuelCost: 20000 + Math.floor(Math.random() * 10000), duration: 3, risk: 'high', minFuel: 95 }
    ];
    const count = 2 + Math.floor(Math.random() * 2);
    const selected = [];
    const used = new Set();
    while (selected.length < count && selected.length < templates.length) {
      const idx = Math.floor(Math.random() * templates.length);
      if (used.has(idx)) continue;
      used.add(idx);
      const t = templates[idx];
      selected.push({
        id: `ORD-GEN-${turn}-${selected.length + 1}`,
        name: t.name,
        route: t.route,
        revenue: t.revenue,
        fuelCost: t.fuelCost,
        duration: t.duration,
        risk: t.risk,
        minFuel: t.minFuel,
        source: { type: 'system', name: '航线管理系统' },
        flags: []
      });
    }
    return selected;
  }

  function getSettlementReport() {
    if (!state) return null;
    const debtSummary = FinancialEngine.computeDebtSummary(state.loans);
    const totalRevenue = state.history.reduce((s, r) => s + (r.revenue || 0), 0);
    const totalFuelExpense = state.history.reduce((s, r) => s + (r.fuelExpense || 0), 0);
    const totalPurchaseExpense = state.history.reduce((s, r) => s + (r.purchaseExpense || 0), 0);
    const totalInterestAccrued = state.history.reduce((s, r) => s + (r.interestAccrued || 0), 0);
    const totalRepayment = state.history.reduce((s, r) => s + (r.repaymentTotal || 0), 0);
    const emergencyLoans = state.loans.filter(l => l.isEmergency);
    const totalEmergencyDebt = emergencyLoans.reduce((s, l) => s + l.principal + (l.accruedInterest || 0), 0);

    const criticalErrors = [];
    state.history.forEach(r => {
      (r.errors || []).forEach(e => {
        criticalErrors.push({ turn: r.turn, ...e });
      });
    });

    const riskAnalysis = analyzeRisks();

    return {
      gameOverReason: state.gameOverReason,
      turnsPlayed: state.history.length,
      maxTurns: state.maxTurns,
      finalCash: state.cash,
      finalFuel: state.fuel,
      remainingDebt: debtSummary,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalFuelExpense: Math.round(totalFuelExpense * 100) / 100,
      totalPurchaseExpense: Math.round(totalPurchaseExpense * 100) / 100,
      totalInterestAccrued: Math.round(totalInterestAccrued * 100) / 100,
      totalRepayment: Math.round(totalRepayment * 100) / 100,
      emergencyLoanCount: emergencyLoans.length,
      totalEmergencyDebt: Math.round(totalEmergencyDebt * 100) / 100,
      errors: criticalErrors,
      riskAnalysis,
      turnHistory: state.history,
      loanFinalState: state.loans.map(l => ({
        id: l.id,
        principal: l.principal,
        accruedInterest: l.accruedInterest,
        interestRate: l.interestRate,
        fullyPaid: l.fullyPaid,
        isEmergency: l.isEmergency || false,
        source: l.source
      })),
      processingLog: state.processingLog
    };
  }

  function analyzeRisks() {
    const analysis = [];
    const highRateLoans = state.loans.filter(l => !l.fullyPaid && l.interestRate > 0.15);
    if (highRateLoans.length > 0) {
      analysis.push({
        type: 'high-rate',
        msg: `存在${highRateLoans.length}笔高利率贷款(>15%)：${highRateLoans.map(l => l.id).join(', ')}`,
        suggestion: '应优先偿还高利率贷款以减少利息负担',
        severity: 'warning'
      });
    }
    const emergencyCount = state.loans.filter(l => l.isEmergency).length;
    if (emergencyCount > 0) {
      analysis.push({
        type: 'emergency',
        msg: `产生了${emergencyCount}笔紧急贷款(利率30%)`,
        suggestion: '现金管理不当导致资金链断裂，应保留足够现金缓冲',
        severity: 'critical'
      });
    }
    const negativeTurns = state.history.filter(r => r.endingCash < 0 || r.emergencyLoanCreated);
    if (negativeTurns.length > 0) {
      analysis.push({
        type: 'negative-cash',
        msg: `有${negativeTurns.length}个回合出现负现金`,
        suggestion: '负现金会产生高利率紧急贷款，应控制支出节奏',
        severity: 'warning',
        turns: negativeTurns.map(r => r.turn)
      });
    }
    const lateRepayments = state.history.reduce((acc, r) => {
      (r.warnings || []).filter(w => w.type === 'partial-repayment').forEach(w => {
        acc.push({ turn: r.turn, msg: w.msg });
      });
      return acc;
    }, []);
    if (lateRepayments.length > 0) {
      analysis.push({
        type: 'late-repayment',
        msg: `有${lateRepayments.length}次还款不足`,
        suggestion: '应确保留有足够现金应对还款计划',
        severity: 'warning'
      });
    }
    return analysis;
  }

  function exportReport() {
    const report = getSettlementReport();
    if (!report) return null;
    const exportData = {
      gameTitle: '太空债务清偿局 - 经营报告',
      exportTime: new Date().toISOString(),
      ...report
    };
    return exportData;
  }

  return {
    subscribe,
    startNewGame,
    getState,
    pause,
    resume,
    restart,
    selectOrder,
    deselectOrder,
    setFuelBuy,
    setRepaymentAmount,
    setRepaymentOrder,
    executeTurn,
    getSettlementReport,
    exportReport
  };
})();
