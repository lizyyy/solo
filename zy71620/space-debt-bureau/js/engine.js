const FinancialEngine = (function () {
  function validateLoan(loan) {
    const errors = [];
    if (loan.id == null) errors.push({ field: 'id', msg: '缺少借款编号', severity: 'critical' });
    if (loan.principal == null || isNaN(loan.principal)) errors.push({ field: 'principal', msg: '缺少本金', severity: 'critical' });
    else if (loan.principal <= 0) errors.push({ field: 'principal', msg: '本金必须为正数', severity: 'critical' });
    if (loan.interestRate == null || isNaN(loan.interestRate)) errors.push({ field: 'interestRate', msg: '缺少利率', severity: 'critical' });
    else if (loan.interestRate < 0) errors.push({ field: 'interestRate', msg: '利率不能为负', severity: 'error' });
    else if (loan.interestRate > 0.5) errors.push({ field: 'interestRate', msg: '利率异常偏高(>50%)，请确认', severity: 'warning' });
    if (loan.dueTurn == null || isNaN(loan.dueTurn)) errors.push({ field: 'dueTurn', msg: '缺少到期回合', severity: 'warning' });
    else if (loan.dueTurn < 1) errors.push({ field: 'dueTurn', msg: '到期回合不合法', severity: 'error' });
    if (loan.source == null) errors.push({ field: 'source', msg: '缺少来源信息', severity: 'warning' });
    return errors;
  }

  function validateOrder(order) {
    const errors = [];
    if (order.id == null) errors.push({ field: 'id', msg: '缺少订单编号', severity: 'critical' });
    if (order.revenue == null || isNaN(order.revenue)) errors.push({ field: 'revenue', msg: '缺少收入金额', severity: 'critical' });
    else if (order.revenue < 0) errors.push({ field: 'revenue', msg: '收入不能为负', severity: 'error' });
    if (order.fuelCost == null || isNaN(order.fuelCost)) errors.push({ field: 'fuelCost', msg: '缺少燃料成本', severity: 'warning' });
    if (order.fuelCost > order.revenue) errors.push({ field: 'fuelCost', msg: '燃料成本超过收入，可能不合理', severity: 'warning' });
    if (order.duration == null || isNaN(order.duration) || order.duration < 1) {
      errors.push({ field: 'duration', msg: '缺少或无效的持续时间', severity: 'warning' });
      order.duration = 1;
    }
    if (order.source == null) errors.push({ field: 'source', msg: '缺少来源信息', severity: 'warning' });
    return errors;
  }

  function validateRateEvent(evt) {
    const errors = [];
    if (evt.turn == null || isNaN(evt.turn)) errors.push({ field: 'turn', msg: '缺少触发回合', severity: 'critical' });
    if (evt.newRate == null || isNaN(evt.newRate)) errors.push({ field: 'newRate', msg: '缺少新利率', severity: 'critical' });
    else if (evt.newRate > 0.5) errors.push({ field: 'newRate', msg: '新利率异常偏高(>50%)', severity: 'warning' });
    else if (evt.newRate < 0) errors.push({ field: 'newRate', msg: '新利率不能为负', severity: 'error' });
    return errors;
  }

  function validateRepayment(plan) {
    const errors = [];
    if (plan.loanId == null) errors.push({ field: 'loanId', msg: '缺少关联借款编号', severity: 'critical' });
    if (plan.turn == null || isNaN(plan.turn)) errors.push({ field: 'turn', msg: '缺少还款回合', severity: 'critical' });
    if (plan.amount == null || isNaN(plan.amount)) errors.push({ field: 'amount', msg: '缺少还款金额', severity: 'critical' });
    else if (plan.amount <= 0) errors.push({ field: 'amount', msg: '还款金额必须为正', severity: 'error' });
    return errors;
  }

  function calculateInterest(loan, currentTurn) {
    if (loan.principal == null || loan.interestRate == null) {
      return {
        interest: 0,
        effectiveRate: 0,
        error: { msg: '无法计算利息：缺少本金或利率', affectedLoanId: loan.id, affectedFields: ['principal', 'interestRate'] }
      };
    }
    const effectiveRate = loan.interestRate;
    const interest = Math.round(loan.principal * effectiveRate * 100) / 100;
    return { interest, effectiveRate, error: null };
  }

  function applyInterest(loan, currentTurn) {
    const result = calculateInterest(loan, currentTurn);
    if (result.error) {
      return {
        loan: { ...loan, lastInterest: 0, interestError: result.error },
        interestAmount: 0,
        error: result.error
      };
    }
    const updatedLoan = {
      ...loan,
      accruedInterest: (loan.accruedInterest || 0) + result.interest,
      lastInterest: result.interest,
      interestError: null
    };
    return { loan: updatedLoan, interestAmount: result.interest, error: null };
  }

  function processRepayment(loan, amount) {
    if (amount <= 0) {
      return {
        loan,
        paid: 0,
        remainingAmount: amount,
        breakdown: { toInterest: 0, toPrincipal: 0 },
        error: { msg: '还款金额无效(≤0)', affectedLoanId: loan.id, affectedFields: ['amount'] }
      };
    }
    const accruedInterest = loan.accruedInterest || 0;
    const toInterest = Math.min(accruedInterest, amount);
    const remainingAfterInterest = amount - toInterest;
    const toPrincipal = Math.min(loan.principal, remainingAfterInterest);
    const leftover = Math.round((remainingAfterInterest - toPrincipal) * 100) / 100;
    const newPrincipal = Math.round((loan.principal - toPrincipal) * 100) / 100;
    const newAccruedInterest = Math.round((accruedInterest - toInterest) * 100) / 100;
    const fullyPaid = newPrincipal <= 0 && newAccruedInterest <= 0;
    return {
      loan: {
        ...loan,
        principal: Math.max(0, newPrincipal),
        accruedInterest: Math.max(0, newAccruedInterest),
        fullyPaid
      },
      paid: amount - leftover,
      remainingAmount: leftover,
      breakdown: { toInterest, toPrincipal },
      error: null
    };
  }

  function validateRepaymentOrder(loans, repaymentOrder) {
    const issues = [];
    const loanMap = {};
    loans.forEach(l => { loanMap[l.id] = l; });
    repaymentOrder.forEach((loanId, idx) => {
      if (!loanMap[loanId]) {
        issues.push({
          msg: `还款顺序第${idx + 1}位：借款${loanId}不存在`,
          severity: 'error',
          position: idx,
          loanId
        });
        return;
      }
      const loan = loanMap[loanId];
      if (loan.fullyPaid) {
        issues.push({
          msg: `还款顺序第${idx + 1}位：借款${loanId}已还清，无需还款`,
          severity: 'warning',
          position: idx,
          loanId
        });
      }
    });
    const orderedIds = new Set(repaymentOrder);
    loans.filter(l => !l.fullyPaid).forEach(l => {
      if (!orderedIds.has(l.id)) {
        issues.push({
          msg: `借款${l.id}未在还款顺序中，将被跳过`,
          severity: 'warning',
          loanId: l.id
        });
      }
    });
    const highRateUnordered = loans
      .filter(l => !l.fullyPaid && l.interestRate > 0.1 && !orderedIds.has(l.id))
      .map(l => l.id);
    if (highRateUnordered.length > 0) {
      issues.push({
        msg: `高利率借款[${highRateUnordered.join(', ')}]未在还款顺序中，可能增加利息负担`,
        severity: 'warning',
        affectedLoanIds: highRateUnordered
      });
    }
    return issues;
  }

  function calculateCashFlow(turnRecord) {
    const inflow = turnRecord.revenue || 0;
    const outflow = (turnRecord.fuelExpense || 0) + (turnRecord.repaymentTotal || 0) + (turnRecord.emergencyLoanInterest || 0);
    const net = Math.round((inflow - outflow) * 100) / 100;
    return { inflow, outflow, net };
  }

  function checkCashStatus(cash) {
    if (cash < 0) {
      return {
        status: 'negative',
        severity: 'critical',
        msg: `现金为负(${cash})，将自动产生紧急贷款(利率30%)`,
        impact: '紧急贷款将按负现金绝对值计息'
      };
    }
    if (cash < 1000) {
      return {
        status: 'danger',
        severity: 'warning',
        msg: `现金过低(${cash})，资金链紧张`,
        impact: '可能无法按时还款，建议优先偿还高利率贷款'
      };
    }
    if (cash < 5000) {
      return {
        status: 'caution',
        severity: 'info',
        msg: `现金偏低(${cash})，注意现金流管理`,
        impact: null
      };
    }
    return { status: 'healthy', severity: null, msg: null, impact: null };
  }

  function generateEmergencyLoan(amount, turn) {
    return {
      id: `EMERGENCY-${turn}-${Date.now()}`,
      principal: Math.abs(amount),
      interestRate: 0.3,
      dueTurn: turn + 3,
      source: { type: 'system', name: '紧急贷款系统', note: '现金为负自动产生' },
      isEmergency: true,
      accruedInterest: 0,
      fullyPaid: false,
      flags: ['emergency', 'high-risk']
    };
  }

  function computeDebtSummary(loans) {
    const active = loans.filter(l => !l.fullyPaid);
    const totalPrincipal = active.reduce((s, l) => s + (l.principal || 0), 0);
    const totalInterest = active.reduce((s, l) => s + (l.accruedInterest || 0), 0);
    const totalDebt = Math.round((totalPrincipal + totalInterest) * 100) / 100;
    const maxRate = active.length > 0 ? Math.max(...active.map(l => l.interestRate || 0)) : 0;
    const overdueLoans = active.filter(l => l.dueTurn != null && l.dueTurn <= 0);
    return {
      totalPrincipal: Math.round(totalPrincipal * 100) / 100,
      totalInterest: Math.round(totalInterest * 100) / 100,
      totalDebt,
      loanCount: active.length,
      maxRate,
      overdueCount: overdueLoans.length,
      overdueIds: overdueLoans.map(l => l.id)
    };
  }

  function rankLoansByPriority(loans) {
    return [...loans]
      .filter(l => !l.fullyPaid)
      .sort((a, b) => {
        if (a.isEmergency && !b.isEmergency) return -1;
        if (!a.isEmergency && b.isEmergency) return 1;
        if ((a.dueTurn || 999) !== (b.dueTurn || 999)) return (a.dueTurn || 999) - (b.dueTurn || 999);
        return (b.interestRate || 0) - (a.interestRate || 0);
      });
  }

  function traceErrorImpact(error, allLoans, allOrders, allEvents) {
    const impact = { error, affectedRecords: [], affectedIds: [] };
    if (error.affectedLoanId) {
      const loan = allLoans.find(l => l.id === error.affectedLoanId);
      if (loan) {
        impact.affectedRecords.push({ type: 'loan', id: loan.id, source: loan.source });
        impact.affectedIds.push(loan.id);
      }
    }
    if (error.affectedLoanIds) {
      error.affectedLoanIds.forEach(lid => {
        const loan = allLoans.find(l => l.id === lid);
        if (loan) {
          impact.affectedRecords.push({ type: 'loan', id: loan.id, source: loan.source });
          if (!impact.affectedIds.includes(lid)) impact.affectedIds.push(lid);
        }
      });
    }
    return impact;
  }

  return {
    validateLoan,
    validateOrder,
    validateRateEvent,
    validateRepayment,
    calculateInterest,
    applyInterest,
    processRepayment,
    validateRepaymentOrder,
    calculateCashFlow,
    checkCashStatus,
    generateEmergencyLoan,
    computeDebtSummary,
    rankLoansByPriority,
    traceErrorImpact
  };
})();
