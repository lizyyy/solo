const DataModule = (function () {
  const SAMPLE_DATA_PACK = {
    name: '初始试跑数据包',
    description: '包含正常、缺项和异常记录的混合数据包',
    loans: [
      {
        id: 'L-001',
        principal: 50000,
        interestRate: 0.08,
        dueTurn: 12,
        source: { type: 'spreadsheet', name: '借款台账2024.xlsx', receivedAt: '2024-11-15' },
        flags: []
      },
      {
        id: 'L-002',
        principal: 30000,
        interestRate: 0.15,
        dueTurn: 8,
        source: { type: 'email', name: '银行贷款确认邮件', receivedAt: '2024-10-20' },
        flags: []
      },
      {
        id: 'L-003',
        principal: null,
        interestRate: 0.12,
        dueTurn: 10,
        source: { type: 'chat', name: '微信群消息截图', receivedAt: '2024-11-01' },
        flags: ['missing-principal']
      },
      {
        id: 'L-004',
        principal: 20000,
        interestRate: 0.6,
        dueTurn: 6,
        source: { type: 'document', name: '民间借贷合同扫描件', receivedAt: '2024-09-30' },
        flags: ['unreasonable-rate']
      },
      {
        id: 'L-005',
        principal: 15000,
        interestRate: 0.05,
        dueTurn: null,
        source: { type: 'spreadsheet', name: '借款台账2024.xlsx', receivedAt: '2024-11-15' },
        flags: ['missing-due']
      }
    ],
    orders: [
      {
        id: 'ORD-001',
        name: '地火航线 · 矿石运输',
        route: '地球→火星',
        revenue: 12000,
        fuelCost: 3000,
        duration: 1,
        risk: 'low',
        minFuel: 30,
        source: { type: 'system', name: '航线管理系统' },
        flags: []
      },
      {
        id: 'ORD-002',
        name: '火木航线 · 精密仪器',
        route: '火星→木星',
        revenue: 28000,
        fuelCost: 8000,
        duration: 2,
        risk: 'medium',
        minFuel: 60,
        source: { type: 'email', name: '客户订单邮件' },
        flags: []
      },
      {
        id: 'ORD-003',
        name: '木土航线 · 生物样本',
        route: '木星→土星',
        revenue: 45000,
        fuelCost: 15000,
        duration: 3,
        risk: 'high',
        minFuel: 90,
        source: { type: 'system', name: '航线管理系统' },
        flags: []
      },
      {
        id: 'ORD-004',
        name: '地月航线 · 快递包裹',
        route: '地球→月球',
        revenue: 5000,
        fuelCost: 1000,
        duration: 1,
        risk: 'low',
        minFuel: 15,
        source: { type: 'chat', name: '客户微信下单' },
        flags: []
      },
      {
        id: 'ORD-005',
        name: '未知航线 · 不明货物',
        route: '???',
        revenue: null,
        fuelCost: 5000,
        duration: 2,
        risk: 'high',
        minFuel: 50,
        source: { type: 'chat', name: '匿名消息' },
        flags: ['missing-revenue']
      },
      {
        id: 'ORD-006',
        name: '土天航线 · 能源核心',
        route: '土星→天王星',
        revenue: 60000,
        fuelCost: 55000,
        duration: 4,
        risk: 'high',
        minFuel: 100,
        source: { type: 'email', name: '高风险合同邮件' },
        flags: ['cost-exceeds-revenue-warning']
      }
    ],
    rateEvents: [
      {
        id: 'EVT-001',
        turn: 3,
        loanId: 'all',
        newRate: null,
        description: '央行利率调整(数据缺失)',
        source: { type: 'email', name: '利率调整通知(附件丢失)' },
        flags: ['missing-rate']
      },
      {
        id: 'EVT-002',
        turn: 5,
        loanId: 'L-002',
        newRate: 0.2,
        description: 'L-002贷款利率上浮',
        source: { type: 'spreadsheet', name: '利率变更记录.xlsx' },
        flags: []
      },
      {
        id: 'EVT-003',
        turn: 7,
        loanId: 'all',
        newRate: 0.12,
        description: '太空金融危机，全面加息',
        source: { type: 'system', name: '星际金融管理局公告' },
        flags: []
      }
    ],
    repayments: [
      {
        id: 'RP-001',
        loanId: 'L-001',
        turn: 4,
        amount: 10000,
        source: { type: 'spreadsheet', name: '还款计划表.xlsx' },
        flags: []
      },
      {
        id: 'RP-002',
        loanId: 'L-002',
        turn: 6,
        amount: 15000,
        source: { type: 'email', name: '还款安排邮件' },
        flags: []
      },
      {
        id: 'RP-003',
        loanId: 'L-999',
        turn: 3,
        amount: 5000,
        source: { type: 'chat', name: '口头还款约定' },
        flags: ['loan-not-found']
      }
    ],
    initialCash: 25000,
    initialFuel: 60,
    maxTurns: 12,
    fuelPrice: 500
  };

  function validateDataPack(dataPack) {
    const report = {
      valid: true,
      loanErrors: [],
      orderErrors: [],
      eventErrors: [],
      repaymentErrors: [],
      globalWarnings: []
    };

    if (!dataPack.loans || dataPack.loans.length === 0) {
      report.globalWarnings.push('数据包中没有借款记录');
    }

    (dataPack.loans || []).forEach(loan => {
      const errors = FinancialEngine.validateLoan(loan);
      if (errors.length > 0) {
        report.loanErrors.push({ loanId: loan.id, errors, source: loan.source });
      }
    });

    (dataPack.orders || []).forEach(order => {
      const errors = FinancialEngine.validateOrder(order);
      if (errors.length > 0) {
        report.orderErrors.push({ orderId: order.id, errors, source: order.source });
      }
    });

    (dataPack.rateEvents || []).forEach(evt => {
      const errors = FinancialEngine.validateRateEvent(evt);
      if (errors.length > 0) {
        report.eventErrors.push({ eventId: evt.id, errors, source: evt.source });
      }
    });

    (dataPack.repayments || []).forEach(plan => {
      const errors = FinancialEngine.validateRepayment(plan);
      if (errors.length > 0) {
        report.repaymentErrors.push({ planId: plan.id, errors, source: plan.source });
      }
    });

    const loanIds = new Set((dataPack.loans || []).map(l => l.id));
    (dataPack.repayments || []).forEach(plan => {
      if (plan.loanId && !loanIds.has(plan.loanId)) {
        report.repaymentErrors.push({
          planId: plan.id,
          errors: [{ field: 'loanId', msg: `还款计划关联的借款${plan.loanId}不存在`, severity: 'error' }],
          source: plan.source
        });
      }
    });

    return report;
  }

  function cleanAndPrepare(dataPack) {
    const validationReport = validateDataPack(dataPack);
    const prepared = {
      loans: [],
      orders: [],
      rateEvents: [],
      repayments: [],
      processingLog: []
    };

    (dataPack.loans || []).forEach(loan => {
      const errors = FinancialEngine.validateLoan(loan);
      const criticalErrors = errors.filter(e => e.severity === 'critical');
      if (criticalErrors.length > 0) {
        prepared.processingLog.push({
          type: 'loan',
          id: loan.id,
          action: 'skipped',
          reason: criticalErrors.map(e => e.msg).join('; '),
          source: loan.source
        });
        return;
      }
      const cleaned = { ...loan, accruedInterest: 0, fullyPaid: false };
      if (cleaned.dueTurn == null) {
        cleaned.dueTurn = (dataPack.maxTurns || 12) + 2;
        prepared.processingLog.push({
          type: 'loan',
          id: loan.id,
          action: 'defaulted',
          field: 'dueTurn',
          reason: '缺少到期回合，默认为最大回合+2',
          source: loan.source
        });
      }
      prepared.loans.push(cleaned);
    });

    (dataPack.orders || []).forEach(order => {
      const errors = FinancialEngine.validateOrder(order);
      const criticalErrors = errors.filter(e => e.severity === 'critical');
      if (criticalErrors.length > 0) {
        prepared.processingLog.push({
          type: 'order',
          id: order.id,
          action: 'skipped',
          reason: criticalErrors.map(e => e.msg).join('; '),
          source: order.source
        });
        return;
      }
      prepared.orders.push({ ...order });
    });

    (dataPack.rateEvents || []).forEach(evt => {
      const errors = FinancialEngine.validateRateEvent(evt);
      const criticalErrors = errors.filter(e => e.severity === 'critical');
      if (criticalErrors.length > 0) {
        prepared.processingLog.push({
          type: 'rateEvent',
          id: evt.id,
          action: 'skipped',
          reason: criticalErrors.map(e => e.msg).join('; '),
          source: evt.source
        });
        return;
      }
      prepared.rateEvents.push({ ...evt });
    });

    (dataPack.repayments || []).forEach(plan => {
      const loanExists = prepared.loans.some(l => l.id === plan.loanId);
      if (!loanExists) {
        prepared.processingLog.push({
          type: 'repayment',
          id: plan.id,
          action: 'skipped',
          reason: `关联借款${plan.loanId}不存在或已被过滤`,
          source: plan.source
        });
        return;
      }
      prepared.repayments.push({ ...plan });
    });

    return { prepared, validationReport };
  }

  function importFromJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      return { success: true, data };
    } catch (e) {
      return { success: false, error: `JSON解析失败: ${e.message}` };
    }
  }

  function sourceLabel(source) {
    if (!source) return '未知来源';
    const typeMap = {
      email: '📧 邮件',
      chat: '💬 群消息',
      spreadsheet: '📊 表格',
      document: '📄 文档',
      system: '🖥️ 系统'
    };
    const prefix = typeMap[source.type] || '📎 其他';
    return `${prefix}: ${source.name || '未命名'}`;
  }

  return {
    SAMPLE_DATA_PACK,
    validateDataPack,
    cleanAndPrepare,
    importFromJSON,
    sourceLabel
  };
})();
