import type {
  GameState,
  Tour,
  Stop,
  MerchItem,
  DecisionLog,
  RiskEvent,
  StopResult,
  ReviewReport,
  ExecutionSummary,
  FinancialOverview,
  StopAnalysis,
  RiskAnalysis,
  DecisionAnalysis,
  Recommendation,
  AlternativePath,
  GameStats,
  DisposalOption,
} from '../types';

export function useReviewAnalysis() {
  const generateReviewReport = (
    gameState: GameState,
    tour: Tour | null,
    stops: Stop[],
    merch: MerchItem[],
    decisions: DecisionLog[],
    riskEvents: RiskEvent[],
    stopResults: StopResult[]
  ): ReviewReport => {
    if (!tour) {
      throw new Error('Tour is required to generate review report');
    }

    const completedStops = stops.filter((s) => s.status === 'completed');
    const initialBudget = tour.initialBudget;
    const finalCashFlow = gameState.cashFlow;
    const netProfit = finalCashFlow - initialBudget;
    const isSuccess = netProfit >= 0;
    const riskLevel = calculateRiskLevel(gameState.riskIndex);

    const executionSummary: ExecutionSummary = {
      tourName: tour.name,
      bandName: tour.bandName,
      tourDuration: formatTourDuration(tour.startDate, tour.endDate),
      totalStops: stops.length,
      completedStops: completedStops.length,
      initialBudget,
      finalCashFlow,
      netProfit,
      isSuccess,
      successMessage: isSuccess
        ? `巡演成功！净利润 ${formatCurrency(netProfit)}`
        : `巡演亏损 ${formatCurrency(Math.abs(netProfit))}`,
      riskLevel,
    };

    const financialOverview: FinancialOverview = calculateFinancialOverview(
      stopResults,
      stops,
      merch,
      initialBudget,
      finalCashFlow
    );

    const stopAnalysis: StopAnalysis[] = calculateStopAnalysis(
      stops,
      stopResults,
      riskEvents,
      decisions,
      merch
    );

    const riskAnalysis: RiskAnalysis = calculateRiskAnalysis(riskEvents, stops);

    const decisionAnalysis: DecisionAnalysis = calculateDecisionAnalysis(decisions);

    const recommendations: Recommendation[] = generateRecommendations(
      financialOverview,
      stopAnalysis,
      riskAnalysis,
      decisionAnalysis,
      riskEvents,
      decisions
    );

    const gameStats: GameStats = calculateGameStats(
      stops,
      stopResults,
      riskEvents,
      decisions,
      stopAnalysis
    );

    return {
      executionSummary,
      financialOverview,
      stopAnalysis,
      riskAnalysis,
      decisionAnalysis,
      recommendations,
      alternativePaths: [],
      gameStats,
      generatedAt: new Date().toISOString(),
    };
  };

  const simulateAlternativePath = (
    originalState: GameState,
    decisionPoint: DecisionLog,
    alternativeOption: DisposalOption
  ): AlternativePath => {
    const originalOutcome = decisionPoint.outcome.actualImpact;
    const alternativeImpact = alternativeOption.immediateImpact.cashFlow;
    const impactDiff = alternativeImpact - originalOutcome;

    const simulatedFinalCashFlow = originalState.cashFlow + impactDiff;
    const simulatedNetProfit = simulatedFinalCashFlow - (originalState.currentTour?.initialBudget || 0);
    const simulatedIsSuccess = simulatedNetProfit >= 0;

    const risksAvoided: string[] = [];
    const risksCreated: string[] = [];

    if (
      alternativeOption.riskLevel === 'conservative' &&
      decisionPoint.chosenOption.riskLevel !== 'conservative'
    ) {
      risksAvoided.push(decisionPoint.id);
    } else if (
      alternativeOption.riskLevel === 'aggressive' &&
      decisionPoint.chosenOption.riskLevel !== 'aggressive'
    ) {
      risksCreated.push(decisionPoint.id);
    }

    return {
      decisionPointId: decisionPoint.id,
      stopId: decisionPoint.stopId,
      alternativeOptionId: alternativeOption.id,
      alternativeOptionName: alternativeOption.name,
      simulatedResult: {
        finalCashFlow: simulatedFinalCashFlow,
        totalRevenue: originalState.totalRevenue,
        totalExpense: originalState.totalExpense - impactDiff,
        netProfit: simulatedNetProfit,
        risksAvoided,
        risksCreated,
        isSuccess: simulatedIsSuccess,
      },
    };
  };

  return {
    generateReviewReport,
    simulateAlternativePath,
  };
}

function calculateRiskLevel(riskIndex: number): 'low' | 'medium' | 'high' {
  if (riskIndex < 30) return 'low';
  if (riskIndex < 70) return 'medium';
  return 'high';
}

function formatTourDuration(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return `${diffDays} 天`;
}

function formatCurrency(amount: number): string {
  return `¥${amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function calculateFinancialOverview(
  stopResults: StopResult[],
  stops: Stop[],
  merch: MerchItem[],
  initialBudget: number,
  finalCashFlow: number
): FinancialOverview {
  const totalRevenue = stopResults.reduce((sum, r) => sum + r.totalRevenue, 0);
  const totalExpense = stopResults.reduce((sum, r) => sum + r.totalExpense, 0);
  const netProfit = finalCashFlow - initialBudget;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  const ticketRevenue = stopResults.reduce((sum, r) => sum + r.ticketRevenue, 0);
  const merchRevenue = stopResults.reduce((sum, r) => sum + r.merchRevenue, 0);

  const revenueBreakdown = [
    { category: '门票收入', amount: ticketRevenue, percentage: totalRevenue > 0 ? (ticketRevenue / totalRevenue) * 100 : 0 },
    { category: '周边收入', amount: merchRevenue, percentage: totalRevenue > 0 ? (merchRevenue / totalRevenue) * 100 : 0 },
  ];

  const venueExpense = stopResults.reduce((sum, r) => sum + r.venueExpense, 0);
  const transportExpense = stopResults.reduce((sum, r) => sum + r.transportExpense, 0);
  const merchCost = stopResults.reduce((sum, r) => sum + r.merchCost, 0);
  const otherExpenses = stopResults.reduce((sum, r) => sum + r.otherExpenses, 0);

  const expenseBreakdown = [
    { category: '场地费用', amount: venueExpense, percentage: totalExpense > 0 ? (venueExpense / totalExpense) * 100 : 0 },
    { category: '交通费用', amount: transportExpense, percentage: totalExpense > 0 ? (transportExpense / totalExpense) * 100 : 0 },
    { category: '周边成本', amount: merchCost, percentage: totalExpense > 0 ? (merchCost / totalExpense) * 100 : 0 },
    { category: '其他费用', amount: otherExpenses, percentage: totalExpense > 0 ? (otherExpenses / totalExpense) * 100 : 0 },
  ];

  const cashFlowTimeline = stopResults.map((result) => {
    const stop = stops.find((s) => s.id === result.stopId);
    return {
      stop: stop?.city || '未知',
      date: stop?.date || '',
      cashFlow: result.netProfit,
      revenue: result.totalRevenue,
      expense: result.totalExpense,
    };
  });

  const perStopFinancials = stopResults.map((result) => {
    const stop = stops.find((s) => s.id === result.stopId);
    return {
      stopId: result.stopId,
      city: stop?.city || '未知',
      revenue: result.totalRevenue,
      expense: result.totalExpense,
      profit: result.netProfit,
    };
  });

  return {
    totalRevenue,
    totalExpense,
    netProfit,
    profitMargin,
    revenueBreakdown,
    expenseBreakdown,
    cashFlowTimeline,
    perStopFinancials,
  };
}

function calculateStopAnalysis(
  stops: Stop[],
  stopResults: StopResult[],
  riskEvents: RiskEvent[],
  decisions: DecisionLog[],
  merch: MerchItem[]
): StopAnalysis[] {
  return stopResults.map((result) => {
    const stop = stops.find((s) => s.id === result.stopId);
    if (!stop) {
      throw new Error(`Stop not found for result: ${result.stopId}`);
    }

    const stopRisks = riskEvents.filter((r) => r.stopId === result.stopId);
    const stopDecisions = decisions.filter((d) => d.stopId === result.stopId);

    const attendanceRate = stop.predictedAttendance > 0
      ? (result.actualAttendance / stop.predictedAttendance) * 100
      : 0;

    const profitPerAttendee = result.actualAttendance > 0
      ? result.netProfit / result.actualAttendance
      : 0;

    const totalMerchSold = result.merchSales.reduce((sum, sale) => sum + sale.quantity, 0);
    const merchConversionRate = result.actualAttendance > 0
      ? (totalMerchSold / result.actualAttendance) * 100
      : 0;

    const performanceRating = getPerformanceRating(result.netProfit, attendanceRate);

    const keyInsights = generateStopKeyInsights(
      result,
      stop,
      attendanceRate,
      merchConversionRate,
      stopRisks,
      stopDecisions
    );

    return {
      stop,
      result,
      attendanceRate,
      profitPerAttendee,
      merchConversionRate,
      risks: stopRisks,
      decisions: stopDecisions,
      performanceRating,
      keyInsights,
    };
  });
}

function getPerformanceRating(
  profit: number,
  attendanceRate: number
): 'excellent' | 'good' | 'average' | 'poor' {
  if (profit > 0 && attendanceRate >= 90) return 'excellent';
  if (profit > 0 && attendanceRate >= 70) return 'good';
  if (profit >= 0 || attendanceRate >= 50) return 'average';
  return 'poor';
}

function generateStopKeyInsights(
  result: StopResult,
  stop: Stop,
  attendanceRate: number,
  merchConversionRate: number,
  risks: RiskEvent[],
  decisions: DecisionLog[]
): string[] {
  const insights: string[] = [];

  if (attendanceRate >= 90) {
    insights.push(`上座率达到 ${attendanceRate.toFixed(1)}%，表现优秀`);
  } else if (attendanceRate < 60) {
    insights.push(`上座率仅 ${attendanceRate.toFixed(1)}%，需要改进营销策略`);
  }

  if (merchConversionRate >= 30) {
    insights.push(`周边转化率 ${merchConversionRate.toFixed(1)}%，销售表现出色`);
  } else if (merchConversionRate < 10) {
    insights.push(`周边转化率仅 ${merchConversionRate.toFixed(1)}%，可优化周边品类`);
  }

  if (result.netProfit > 0) {
    insights.push(`本站盈利 ${formatCurrency(result.netProfit)}`);
  } else {
    insights.push(`本站亏损 ${formatCurrency(Math.abs(result.netProfit))}`);
  }

  if (risks.length > 0) {
    insights.push(`本站发生 ${risks.length} 起风险事件`);
  }

  if (decisions.length > 0) {
    insights.push(`本站做出 ${decisions.length} 项决策`);
  }

  return insights;
}

function calculateRiskAnalysis(riskEvents: RiskEvent[], stops: Stop[]): RiskAnalysis {
  const totalRisks = riskEvents.length;

  const risksByType: Record<string, number> = {};
  const risksBySeverity: Record<string, number> = {};

  riskEvents.forEach((risk) => {
    risksByType[risk.type] = (risksByType[risk.type] || 0) + 1;
    risksBySeverity[risk.severity] = (risksBySeverity[risk.severity] || 0) + 1;
  });

  const highRiskEvents = riskEvents.filter(
    (r) => r.severity === 'critical' || r.level === 'high'
  );

  const riskTimeline = stops.map((stop) => {
    const stopRisks = riskEvents.filter((r) => r.stopId === stop.id);
    const riskIndex = stopRisks.reduce((sum, r) => sum + r.impact, 0);
    return {
      stop: stop.city,
      date: stop.date,
      riskCount: stopRisks.length,
      riskIndex,
    };
  });

  const unresolvedRisks = riskEvents.filter((r) => !r.resolvedAt);

  return {
    totalRisks,
    risksByType,
    risksBySeverity,
    highRiskEvents,
    riskTimeline,
    unresolvedRisks,
  };
}

function calculateDecisionAnalysis(decisions: DecisionLog[]): DecisionAnalysis {
  const totalDecisions = decisions.length;

  const decisionsByType: Record<string, number> = {};
  const decisionsByRiskLevel: Record<string, number> = {};

  decisions.forEach((d) => {
    decisionsByType[d.decisionType] = (decisionsByType[d.decisionType] || 0) + 1;
    decisionsByRiskLevel[d.chosenOption.riskLevel] =
      (decisionsByRiskLevel[d.chosenOption.riskLevel] || 0) + 1;
  });

  const averageImpact = decisions.length > 0
    ? decisions.reduce((sum, d) => sum + d.outcome.actualImpact, 0) / decisions.length
    : 0;

  const sortedDecisions = [...decisions].sort(
    (a, b) => b.outcome.actualImpact - a.outcome.actualImpact
  );

  const bestDecisions = sortedDecisions.slice(0, Math.min(3, sortedDecisions.length));
  const worstDecisions = sortedDecisions
    .slice()
    .reverse()
    .slice(0, Math.min(3, sortedDecisions.length));

  const decisionImpactChart = decisions.map((d) => ({
    decisionId: d.id,
    description: d.description,
    impact: d.outcome.actualImpact,
    riskLevel: d.chosenOption.riskLevel,
  }));

  return {
    totalDecisions,
    decisionsByType,
    decisionsByRiskLevel,
    averageImpact,
    bestDecisions,
    worstDecisions,
    decisionImpactChart,
  };
}

function generateRecommendations(
  financialOverview: FinancialOverview,
  stopAnalysis: StopAnalysis[],
  riskAnalysis: RiskAnalysis,
  decisionAnalysis: DecisionAnalysis,
  riskEvents: RiskEvent[],
  decisions: DecisionLog[]
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  let idCounter = 0;

  if (financialOverview.profitMargin < 10) {
    recommendations.push({
      id: `rec-${idCounter++}`,
      category: 'financial',
      priority: 'high',
      title: '提升利润率',
      description: `当前利润率仅为 ${financialOverview.profitMargin.toFixed(1)}%，低于健康阈值 10%`,
      actionableSteps: [
        '优化各站成本结构，特别是场地和交通费用',
        '提高周边产品定价或增加高利润品类',
        '评估低价站点的必要性，考虑取消或调整路线',
      ],
      expectedImpact: '预计可提升利润率 5-10 个百分点',
    });
  }

  const poorPerformingStops = stopAnalysis.filter((s) => s.performanceRating === 'poor');
  if (poorPerformingStops.length > 0) {
    recommendations.push({
      id: `rec-${idCounter++}`,
      category: 'route',
      priority: 'high',
      title: '优化巡演路线',
      description: `发现 ${poorPerformingStops.length} 个表现不佳的站点`,
      actionableSteps: [
        `评估以下站点是否保留: ${poorPerformingStops.map((s) => s.stop.city).join(', ')}`,
        '分析低上座率原因，考虑更换场地或调整日期',
        '增加热门城市的演出场次',
      ],
      expectedImpact: '减少亏损站点，提升整体巡演效益',
    });
  }

  const lowConversionStops = stopAnalysis.filter((s) => s.merchConversionRate < 15);
  if (lowConversionStops.length > 0) {
    recommendations.push({
      id: `rec-${idCounter++}`,
      category: 'inventory',
      priority: 'medium',
      title: '优化周边商品策略',
      description: `多个站点周边转化率低于 15%`,
      actionableSteps: [
        '调研粉丝喜好，优化周边设计和品类',
        '设置现场促销活动，如套装折扣、限量版商品',
        '优化周边陈列位置和销售流程',
      ],
      expectedImpact: '提升周边转化率至 25% 以上',
    });
  }

  if (riskAnalysis.totalRisks > 5) {
    recommendations.push({
      id: `rec-${idCounter++}`,
      category: 'risk_management',
      priority: 'high',
      title: '加强风险管理',
      description: `本次巡演共发生 ${riskAnalysis.totalRisks} 起风险事件`,
      actionableSteps: [
        '建立更完善的风险预警机制',
        '针对高频风险类型制定应急预案',
        '增加风险准备金预算',
      ],
      expectedImpact: '降低风险事件发生频率和影响程度',
      relatedRiskEventId: riskAnalysis.highRiskEvents[0]?.id,
    });
  }

  const aggressiveDecisions = decisions.filter(
    (d) => d.chosenOption.riskLevel === 'aggressive'
  );
  if (aggressiveDecisions.length > decisions.length * 0.5) {
    recommendations.push({
      id: `rec-${idCounter++}`,
      category: 'marketing',
      priority: 'medium',
      title: '平衡决策风险',
      description: '激进型决策占比过高，建议平衡风险',
      actionableSteps: [
        '在做出重大决策前进行更充分的风险评估',
        '适当增加保守型决策的比例',
        '建立决策复盘机制，总结经验教训',
      ],
      expectedImpact: '降低整体运营风险，提升决策质量',
      relatedDecisionId: decisionAnalysis.worstDecisions[0]?.id,
    });
  }

  return recommendations;
}

function calculateGameStats(
  stops: Stop[],
  stopResults: StopResult[],
  riskEvents: RiskEvent[],
  decisions: DecisionLog[],
  stopAnalysis: StopAnalysis[]
): GameStats {
  const totalStops = stops.length;
  const completedStops = stopResults.length;
  const successfulStops = stopResults.filter((r) => r.netProfit >= 0).length;
  const totalRiskEvents = riskEvents.length;
  const highRiskEvents = riskEvents.filter(
    (r) => r.severity === 'critical' || r.level === 'high'
  ).length;
  const decisionsMade = decisions.length;
  const averageDecisionRisk = decisions.length > 0
    ? decisions.reduce((sum, d) => {
        const riskValue = d.chosenOption.riskLevel === 'aggressive' ? 3 :
                          d.chosenOption.riskLevel === 'balanced' ? 2 : 1;
        return sum + riskValue;
      }, 0) / decisions.length
    : 0;

  const sortedByProfit = [...stopAnalysis].sort(
    (a, b) => b.result.netProfit - a.result.netProfit
  );

  const bestPerformingStop = sortedByProfit[0]?.stop.city || null;
  const worstPerformingStop = sortedByProfit[sortedByProfit.length - 1]?.stop.city || null;

  return {
    totalStops,
    completedStops,
    successfulStops,
    totalRiskEvents,
    highRiskEvents,
    decisionsMade,
    averageDecisionRisk,
    bestPerformingStop,
    worstPerformingStop,
  };
}
