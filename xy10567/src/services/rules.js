const { HEALTH_LEVEL, TICKET_PRIORITY, TICKET_SEVERITY } = require('../models/factory');

const RULE_CONFIG = {
  healthScore: {
    lowRiskThreshold: 50,
    criticalThreshold: 30,
    greenLightThreshold: 70
  },
  tickets: {
    majorBlockingPriorities: [TICKET_PRIORITY.HIGH, TICKET_PRIORITY.CRITICAL],
    majorBlockingSeverities: [TICKET_SEVERITY.MAJOR, TICKET_SEVERITY.SEVERE]
  },
  discounts: {
    standardTierThreshold: 10,
    premiumTierThreshold: 15,
    enterpriseTierThreshold: 20,
    approvalThresholds: {
      level1: { percent: 10, approver: 'team_lead' },
      level2: { percent: 20, approver: 'manager' },
      level3: { percent: 30, approver: 'director' },
      level4: { percent: 100, approver: 'vp' }
    }
  }
};

function checkHealthScoreRule(healthScore) {
  if (!healthScore) {
    return {
      passed: false,
      riskLevel: 'high',
      reason: '缺少健康分数据',
      action: '需要补充健康分评估'
    };
  }

  const { score, level, risks = [] } = healthScore;

  if (score >= RULE_CONFIG.healthScore.greenLightThreshold) {
    return {
      passed: true,
      riskLevel: 'low',
      reason: `健康分 ${score} 分，状态良好`,
      details: { level, score }
    };
  }

  if (score >= RULE_CONFIG.healthScore.lowRiskThreshold) {
    return {
      passed: false,
      riskLevel: 'medium',
      reason: `健康分较低 (${score} 分)，需要关注`,
      details: { level, score, risks },
      action: '建议客户成功经理介入了解原因'
    };
  }

  return {
    passed: false,
    riskLevel: score < RULE_CONFIG.healthScore.criticalThreshold ? 'critical' : 'high',
    reason: `健康分过低 (${score} 分)，存在流失风险`,
    details: { level, score, risks },
    action: '启动风险客户处理流程，需立即介入'
  };
}

function checkTicketsRule(openTickets) {
  const criticalOrHighTickets = openTickets.filter(t => 
    RULE_CONFIG.tickets.majorBlockingPriorities.includes(t.priority) ||
    RULE_CONFIG.tickets.majorBlockingSeverities.includes(t.severity)
  );

  const slaBreachedTickets = openTickets.filter(t => t.slaBreached);

  const hasBlockingIssues = criticalOrHighTickets.length > 0;
  const hasSlaBreaches = slaBreachedTickets.length > 0;

  if (!hasBlockingIssues && !hasSlaBreaches) {
    return {
      passed: true,
      riskLevel: 'low',
      reason: '未结工单状态正常，无重大阻塞问题',
      details: { openTickets: openTickets.length }
    };
  }

  return {
    passed: false,
    riskLevel: hasBlockingIssues ? 'high' : 'medium',
    reason: `存在 ${criticalOrHighTickets.length} 个重大未结工单${hasSlaBreaches ? `，其中 ${slaBreachedTickets.length} 个已超 SLA` : ''}`,
    details: {
      criticalOrHighTickets: criticalOrHighTickets.map(t => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        severity: t.severity,
        slaBreached: t.slaBreached
      })),
      slaBreachedCount: slaBreachedTickets.length
    },
    action: '重大工单未结，不能标绿，需先解决或与客户确认'
  };
}

function checkDiscountApprovalRule(discountPercent, customerTier = 'standard', quoteTotal = 0) {
  const thresholds = RULE_CONFIG.discounts.approvalThresholds;
  let requiredApprovalLevel = null;
  let tierMaxDiscount = RULE_CONFIG.discounts.standardTierThreshold;

  if (customerTier === 'premium') {
    tierMaxDiscount = RULE_CONFIG.discounts.premiumTierThreshold;
  } else if (customerTier === 'enterprise') {
    tierMaxDiscount = RULE_CONFIG.discounts.enterpriseTierThreshold;
  }

  if (discountPercent <= 0) {
    return {
      passed: true,
      approvalRequired: false,
      riskLevel: 'low',
      reason: '无折扣，无需审批'
    };
  }

  if (discountPercent <= tierMaxDiscount) {
    return {
      passed: true,
      approvalRequired: false,
      riskLevel: 'low',
      reason: `折扣 ${discountPercent}% 在 ${customerTier} 客户允许范围内 (≤${tierMaxDiscount}%)`
    };
  }

  for (const [level, config] of Object.entries(thresholds)) {
    if (discountPercent <= config.percent) {
      requiredApprovalLevel = { level, ...config };
      break;
    }
  }

  if (!requiredApprovalLevel) {
    requiredApprovalLevel = thresholds.level4;
  }

  return {
    passed: false,
    approvalRequired: true,
    riskLevel: discountPercent > 30 ? 'high' : 'medium',
    reason: `折扣 ${discountPercent}% 超出 ${customerTier} 客户标准阈值 (${tierMaxDiscount}%)，需审批`,
    details: {
      discountPercent,
      tierMaxDiscount,
      customerTier,
      quoteTotal
    },
    requiredApproval: requiredApprovalLevel,
    action: `需要 ${requiredApprovalLevel.approver} 级别审批`
  };
}

function checkUsageTrendRule(usageMetrics) {
  if (!usageMetrics || usageMetrics.length === 0) {
    return {
      passed: false,
      riskLevel: 'high',
      reason: '缺少使用量数据',
      action: '需要补充产品使用量数据'
    };
  }

  const decliningProducts = usageMetrics.filter(m => 
    m.trend === 'declining' || m.comparedToLastPeriod < -10
  );

  if (decliningProducts.length === 0) {
    return {
      passed: true,
      riskLevel: 'low',
      reason: '所有产品使用趋势稳定或增长',
      details: { productsCount: usageMetrics.length }
    };
  }

  return {
    passed: false,
    riskLevel: decliningProducts.length > usageMetrics.length / 2 ? 'high' : 'medium',
    reason: `${decliningProducts.length}/${usageMetrics.length} 个产品使用量下降`,
    details: {
      decliningProducts: decliningProducts.map(p => ({
        productId: p.productId,
        trend: p.trend,
        change: p.comparedToLastPeriod
      }))
    },
    action: '建议关注使用量下降原因'
  };
}

function evaluateAllRules(workflowData) {
  const results = {};
  const riskFlags = [];
  const blockingRules = [];

  results.healthScore = checkHealthScoreRule(workflowData.healthScore);
  if (!results.healthScore.passed) {
    riskFlags.push({
      type: 'health_score',
      level: results.healthScore.riskLevel,
      message: results.healthScore.reason,
      action: results.healthScore.action
    });
    if (results.healthScore.riskLevel === 'critical') {
      blockingRules.push('health_score');
    }
  }

  results.tickets = checkTicketsRule(workflowData.openTickets || []);
  if (!results.tickets.passed) {
    riskFlags.push({
      type: 'open_tickets',
      level: results.tickets.riskLevel,
      message: results.tickets.reason,
      action: results.tickets.action
    });
    blockingRules.push('open_tickets');
  }

  results.usage = checkUsageTrendRule(workflowData.usageMetrics || []);
  if (!results.usage.passed) {
    riskFlags.push({
      type: 'usage_trend',
      level: results.usage.riskLevel,
      message: results.usage.reason,
      action: results.usage.action
    });
  }

  const overallPassed = blockingRules.length === 0 && 
    riskFlags.every(r => r.level !== 'critical');

  return {
    passed: overallPassed,
    canMarkGreen: blockingRules.length === 0 && 
      (results.healthScore.passed || results.healthScore.riskLevel !== 'critical'),
    results,
    riskFlags,
    blockingRules,
    summary: overallPassed 
      ? '所有规则检查通过，可以推进' 
      : `存在 ${riskFlags.length} 个风险点${blockingRules.length > 0 ? `，其中 ${blockingRules.length} 个为阻塞项` : ''}`
  };
}

module.exports = {
  RULE_CONFIG,
  checkHealthScoreRule,
  checkTicketsRule,
  checkDiscountApprovalRule,
  checkUsageTrendRule,
  evaluateAllRules
};
