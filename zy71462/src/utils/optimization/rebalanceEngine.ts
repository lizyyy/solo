import {
  Holding,
  TargetWeight,
  PriceQuote,
  RebalanceConfig,
  TradeSuggestion,
  Task,
  EvidenceRecord,
  CalculationStep,
} from '@/types';
import {
  calculateTaxForTrade,
  calculateMarginalTaxRate,
  calculateHoldingDays,
  createEvidenceRecord,
  TradeForTax,
} from '../tax/calculateTax';
import { processTradesWithLossOffset } from '../tax/lossOffset';

export interface RebalanceInput {
  holdings: Holding[];
  targetWeights: TargetWeight[];
  priceQuotes: PriceQuote[];
  config: RebalanceConfig;
  materialIds: {
    holding: string;
    target: string;
    price: string;
  };
}

export interface RebalanceResult {
  task: Task;
  trades: TradeSuggestion[];
  evidenceRecords: EvidenceRecord[];
  summary: {
    totalMarketValue: number;
    totalTax: number;
    totalCommission: number;
    totalStampDuty: number;
    totalCapitalGainsTax: number;
    totalLossOffset: number;
    afterTaxReturn: number;
    trackingError: number;
    totalTurnover: number;
  };
}

export function calculatePortfolioValue(holdings: Holding[]): number {
  return holdings.reduce((sum, h) => sum + h.marketValue, 0);
}

export function calculateCurrentWeights(holdings: Holding[]): Map<string, number> {
  const totalValue = calculatePortfolioValue(holdings);
  const weights = new Map<string, number>();
  
  for (const holding of holdings) {
    weights.set(holding.symbol, holding.marketValue / totalValue);
  }
  
  return weights;
}

export function validateTargetWeights(
  targetWeights: TargetWeight[],
  tolerance: number = 0.001
): { valid: boolean; sum: number; diff: number } {
  const sum = targetWeights.reduce((s, tw) => s + tw.targetWeight, 0);
  const diff = Math.abs(sum - 1.0);
  return {
    valid: diff <= tolerance,
    sum,
    diff,
  };
}

function getPrice(symbol: string, action: 'buy' | 'sell', priceQuotes: PriceQuote[]): number {
  const quote = priceQuotes.find(q => q.symbol === symbol);
  if (!quote) return 0;
  return action === 'buy' ? quote.askPrice : quote.bidPrice;
}

function generateTradeReason(
  action: 'buy' | 'sell' | 'hold',
  currentWeight: number,
  targetWeight: number,
  marginalTaxRate: number,
  constraints: string[]
): string {
  if (action === 'hold') {
    if (constraints.length > 0) {
      return `因约束条件[${constraints.join('; ')}]，保持持仓不变`;
    }
    const diff = Math.abs(currentWeight - targetWeight);
    if (diff < 0.005) {
      return `当前权重${(currentWeight * 100).toFixed(2)}%接近目标${(targetWeight * 100).toFixed(2)}%，无需调整`;
    }
    return `边际税率${(marginalTaxRate * 100).toFixed(2)}%过高，暂缓调整`;
  }
  
  const direction = action === 'buy' ? '加仓' : '减仓';
  const diff = targetWeight - currentWeight;
  return `${direction}：当前权重${(currentWeight * 100).toFixed(2)}% → 目标${(targetWeight * 100).toFixed(2)}%，偏离${(diff * 100).toFixed(2)}个百分点`;
}

function checkConstraints(
  holding: Holding,
  action: 'buy' | 'sell',
  config: RebalanceConfig
): string[] {
  const constraints: string[] = [];
  const holdingDays = calculateHoldingDays(holding.purchaseDate);

  if (action === 'sell') {
    if (holdingDays < config.holdingPeriodRules.minHoldingDays && !config.constraints.allowShortTermSell) {
      constraints.push(`持有期${holdingDays}天 < 最低要求${config.holdingPeriodRules.minHoldingDays}天，禁止卖出`);
    }
  }

  return constraints;
}

export function runRebalanceOptimization(
  input: RebalanceInput,
  onProgress?: (progress: number, message: string) => void
): RebalanceResult {
  const { holdings, targetWeights, priceQuotes, config, materialIds } = input;
  const taskId = `task_${Date.now()}`;
  const evidenceRecords: EvidenceRecord[] = [];

  onProgress?.(0, '初始化计算...');

  const totalMarketValue = calculatePortfolioValue(holdings);
  const currentWeights = calculateCurrentWeights(holdings);
  const weightValidation = validateTargetWeights(targetWeights);

  if (!weightValidation.valid) {
    console.warn(`目标权重和为${weightValidation.sum.toFixed(6)}，与1.0相差${weightValidation.diff.toFixed(6)}`);
  }

  onProgress?.(10, '计算边际税率...');

  const holdingData = holdings.map(h => {
    const targetWeight = targetWeights.find(tw => tw.symbol === h.symbol)?.targetWeight || 0;
    const currentWeight = currentWeights.get(h.symbol) || 0;
    const marginalTaxRate = calculateMarginalTaxRate(h, config);
    const constraints = checkConstraints(h, 'sell', config);
    
    return {
      holding: h,
      targetWeight,
      currentWeight,
      weightDiff: targetWeight - currentWeight,
      marginalTaxRate,
      constraints,
      canSell: constraints.length === 0,
    };
  });

  onProgress?.(30, '生成初始交易方案...');

  const symbolMap = new Map(holdingData.map(d => [d.holding.symbol, d]));
  const trades: TradeSuggestion[] = [];
  let totalTurnover = 0;
  let maxTurnoverValue = totalMarketValue * config.constraints.maxTurnoverPct;

  const sortedByAdjustmentNeed = [...holdingData].sort((a, b) => {
    if (config.optimizationTarget === 'minimize_tax') {
      return a.marginalTaxRate - b.marginalTaxRate;
    } else if (config.optimizationTarget === 'minimize_tracking_error') {
      return Math.abs(b.weightDiff) - Math.abs(a.weightDiff);
    } else {
      const afterTaxDiffA = a.weightDiff * (1 - a.marginalTaxRate);
      const afterTaxDiffB = b.weightDiff * (1 - b.marginalTaxRate);
      return Math.abs(afterTaxDiffB) - Math.abs(afterTaxDiffA);
    }
  });

  for (const data of sortedByAdjustmentNeed) {
    const { holding, targetWeight, currentWeight, weightDiff, marginalTaxRate, constraints, canSell } = data;
    
    if (Math.abs(weightDiff) < 0.001) {
      trades.push({
        id: `trade_${holding.symbol}`,
        taskId,
        symbol: holding.symbol,
        name: holding.name,
        action: 'hold',
        quantity: 0,
        price: holding.marketPrice,
        estimatedValue: 0,
        estimatedCommission: 0,
        estimatedStampDuty: 0,
        estimatedCapitalGainsTax: 0,
        estimatedTotalTax: 0,
        lossOffsetApplied: 0,
        netProceeds: 0,
        holdingDays: calculateHoldingDays(holding.purchaseDate),
        currentWeight,
        targetWeight,
        suggestedWeight: currentWeight,
        weightDiff: 0,
        reason: generateTradeReason('hold', currentWeight, targetWeight, marginalTaxRate, constraints),
        constraints,
        evidenceId: '',
        marginalTaxRate,
      });
      continue;
    }

    const action: 'buy' | 'sell' = weightDiff > 0 ? 'buy' : 'sell';
    const targetValue = totalMarketValue * targetWeight;
    const currentValue = holding.marketValue;
    const tradeValue = Math.abs(targetValue - currentValue);

    if (tradeValue < config.constraints.minTradeValue) {
      trades.push({
        id: `trade_${holding.symbol}`,
        taskId,
        symbol: holding.symbol,
        name: holding.name,
        action: 'hold',
        quantity: 0,
        price: holding.marketPrice,
        estimatedValue: 0,
        estimatedCommission: 0,
        estimatedStampDuty: 0,
        estimatedCapitalGainsTax: 0,
        estimatedTotalTax: 0,
        lossOffsetApplied: 0,
        netProceeds: 0,
        holdingDays: calculateHoldingDays(holding.purchaseDate),
        currentWeight,
        targetWeight,
        suggestedWeight: currentWeight,
        weightDiff: 0,
        reason: `调整金额${tradeValue.toFixed(2)}元低于最小交易金额${config.constraints.minTradeValue}元，保持持仓`,
        constraints: [`交易金额<${config.constraints.minTradeValue}元`],
        evidenceId: '',
        marginalTaxRate,
      });
      continue;
    }

    if (action === 'sell' && !canSell) {
      trades.push({
        id: `trade_${holding.symbol}`,
        taskId,
        symbol: holding.symbol,
        name: holding.name,
        action: 'hold',
        quantity: 0,
        price: holding.marketPrice,
        estimatedValue: 0,
        estimatedCommission: 0,
        estimatedStampDuty: 0,
        estimatedCapitalGainsTax: 0,
        estimatedTotalTax: 0,
        lossOffsetApplied: 0,
        netProceeds: 0,
        holdingDays: calculateHoldingDays(holding.purchaseDate),
        currentWeight,
        targetWeight,
        suggestedWeight: currentWeight,
        weightDiff: 0,
        reason: generateTradeReason('hold', currentWeight, targetWeight, marginalTaxRate, constraints),
        constraints,
        evidenceId: '',
        marginalTaxRate,
      });
      continue;
    }

    if (totalTurnover + tradeValue > maxTurnoverValue) {
      const remainingTurnover = maxTurnoverValue - totalTurnover;
      if (remainingTurnover < config.constraints.minTradeValue) {
        trades.push({
          id: `trade_${holding.symbol}`,
          taskId,
          symbol: holding.symbol,
          name: holding.name,
          action: 'hold',
          quantity: 0,
          price: holding.marketPrice,
          estimatedValue: 0,
          estimatedCommission: 0,
          estimatedStampDuty: 0,
          estimatedCapitalGainsTax: 0,
          estimatedTotalTax: 0,
          lossOffsetApplied: 0,
          netProceeds: 0,
          holdingDays: calculateHoldingDays(holding.purchaseDate),
          currentWeight,
          targetWeight,
          suggestedWeight: currentWeight,
          weightDiff: 0,
          reason: `换手率限制：剩余可用换手率${remainingTurnover.toFixed(2)}元不足，暂缓调整`,
          constraints: [`换手率限制${(config.constraints.maxTurnoverPct * 100).toFixed(0)}%`],
          evidenceId: '',
          marginalTaxRate,
        });
        continue;
      }
    }

    const price = getPrice(holding.symbol, action, priceQuotes) || holding.marketPrice;
    const rawQuantity = tradeValue / price;
    const quantity = Math.floor(rawQuantity / 100) * 100;
    const actualValue = quantity * price;

    if (actualValue < config.constraints.minTradeValue) {
      trades.push({
        id: `trade_${holding.symbol}`,
        taskId,
        symbol: holding.symbol,
        name: holding.name,
        action: 'hold',
        quantity: 0,
        price: holding.marketPrice,
        estimatedValue: 0,
        estimatedCommission: 0,
        estimatedStampDuty: 0,
        estimatedCapitalGainsTax: 0,
        estimatedTotalTax: 0,
        lossOffsetApplied: 0,
        netProceeds: 0,
        holdingDays: calculateHoldingDays(holding.purchaseDate),
        currentWeight,
        targetWeight,
        suggestedWeight: currentWeight,
        weightDiff: 0,
        reason: `调整后数量${quantity}股对应金额${actualValue.toFixed(2)}元低于最小交易金额`,
        constraints: ['最小交易单位约束'],
        evidenceId: '',
        marginalTaxRate,
      });
      continue;
    }

    const tradeForTax: TradeForTax = {
      action,
      quantity,
      price,
      value: actualValue,
    };

    const holdingRowIndex = holdings.findIndex(h => h.symbol === holding.symbol);
    const taxResult = calculateTaxForTrade(
      tradeForTax,
      holding,
      config,
      materialIds.holding,
      holdingRowIndex
    );

    const evidence = createEvidenceRecord(
      taskId,
      `trade_${holding.symbol}`,
      'trade',
      taxResult.evidenceSteps,
      [materialIds.holding, materialIds.target, materialIds.price]
    );
    evidenceRecords.push(evidence);

    const newWeight = (holding.marketValue + (action === 'buy' ? actualValue : -actualValue)) / totalMarketValue;
    
    trades.push({
      id: `trade_${holding.symbol}`,
      taskId,
      symbol: holding.symbol,
      name: holding.name,
      action,
      quantity,
      price,
      estimatedValue: actualValue,
      estimatedCommission: taxResult.breakdown.commission,
      estimatedStampDuty: taxResult.breakdown.stampDuty,
      estimatedCapitalGainsTax: taxResult.breakdown.capitalGainsTax,
      estimatedTotalTax: taxResult.breakdown.totalTax,
      lossOffsetApplied: 0,
      netProceeds: action === 'sell' ? actualValue - taxResult.breakdown.totalTax : actualValue + taxResult.breakdown.totalTax,
      holdingDays: calculateHoldingDays(holding.purchaseDate),
      currentWeight,
      targetWeight,
      suggestedWeight: newWeight,
      weightDiff: newWeight - currentWeight,
      reason: generateTradeReason(action, currentWeight, targetWeight, marginalTaxRate, []),
      constraints: [],
      evidenceId: evidence.id,
      marginalTaxRate,
    });

    totalTurnover += actualValue;
  }

  onProgress?.(60, '应用亏损抵扣...');

  const lossOffsetResult = processTradesWithLossOffset(trades, config);

  onProgress?.(80, '计算汇总指标...');

  const summary = calculateSummaryMetrics(
    holdings,
    lossOffsetResult.updatedTrades,
    totalMarketValue,
    config
  );

  onProgress?.(90, '生成任务记录...');

  const task: Task = {
    id: taskId,
    batchId: '',
    version: 1,
    config,
    status: 'completed',
    totalTax: summary.totalTax,
    totalCommission: summary.totalCommission,
    totalStampDuty: summary.totalStampDuty,
    totalCapitalGainsTax: summary.totalCapitalGainsTax,
    totalLossOffset: summary.totalLossOffset,
    afterTaxReturn: summary.afterTaxReturn,
    trackingError: summary.trackingError,
    totalTurnover: summary.totalTurnover,
    createdAt: new Date(),
    completedAt: new Date(),
    progress: 100,
  };

  onProgress?.(100, '计算完成');

  return {
    task,
    trades: lossOffsetResult.updatedTrades,
    evidenceRecords,
    summary,
  };
}

function calculateSummaryMetrics(
  holdings: Holding[],
  trades: TradeSuggestion[],
  totalMarketValue: number,
  config: RebalanceConfig
) {
  const totalCommission = trades.reduce((sum, t) => sum + t.estimatedCommission, 0);
  const totalStampDuty = trades.reduce((sum, t) => sum + t.estimatedStampDuty, 0);
  const totalCapitalGainsTax = trades.reduce((sum, t) => sum + t.estimatedCapitalGainsTax, 0);
  const totalLossOffset = trades.reduce((sum, t) => sum + t.lossOffsetApplied, 0);
  const totalTax = totalCommission + totalStampDuty + totalCapitalGainsTax;
  const totalTurnover = trades.filter(t => t.action !== 'hold').reduce((sum, t) => sum + t.estimatedValue, 0);

  const totalUnrealizedGain = holdings.reduce((sum, h) => sum + h.unrealizedGain, 0);
  const realizedGains = trades
    .filter(t => t.action === 'sell')
    .map(t => (t.price - (holdings.find(h => h.symbol === t.symbol)?.costBasis || 0)) * t.quantity)
    .filter(g => g > 0);
  const totalRealizedGain = realizedGains.reduce((sum, g) => sum + g, 0);
  const afterTaxReturn = totalRealizedGain - totalCapitalGainsTax - totalCommission - totalStampDuty;

  let trackingError = 0;
  for (const trade of trades) {
    const diff = Math.abs(trade.suggestedWeight - trade.targetWeight);
    trackingError += diff;
  }

  return {
    totalMarketValue,
    totalTax,
    totalCommission,
    totalStampDuty,
    totalCapitalGainsTax,
    totalLossOffset,
    afterTaxReturn,
    trackingError,
    totalTurnover,
  };
}

export function generateConstraintExplanation(
  trade: TradeSuggestion,
  config: RebalanceConfig
): {
  cause: string;
  constraint: string;
  tradeoff: string;
  result: string;
}[] {
  const explanations: {
    cause: string;
    constraint: string;
    tradeoff: string;
    result: string;
  }[] = [];

  if (trade.action === 'hold' && trade.constraints.length > 0) {
    for (const constraint of trade.constraints) {
      if (constraint.includes('持有期')) {
        explanations.push({
          cause: `该持仓仅持有${trade.holdingDays}天`,
          constraint: `最低持有期要求：${config.holdingPeriodRules.minHoldingDays}天`,
          tradeoff: '遵守持有期规定，避免合规风险',
          result: '保持当前持仓，不进行卖出操作',
        });
      } else if (constraint.includes('最小交易金额')) {
        explanations.push({
          cause: `所需调整金额过小`,
          constraint: `单笔交易最低金额：${config.constraints.minTradeValue}元`,
          tradeoff: '避免小额交易产生不必要的佣金成本',
          result: '保持当前权重，待偏离扩大后再调整',
        });
      } else if (constraint.includes('换手率')) {
        explanations.push({
          cause: '已达到换手率上限',
          constraint: `最大换手率限制：${(config.constraints.maxTurnoverPct * 100).toFixed(0)}%`,
          tradeoff: '控制整体交易成本，避免过度调仓',
          result: '本只股票暂不调整，优先调整其他更重要的持仓',
        });
      }
    }
  }

  if (trade.action !== 'hold') {
    if (trade.holdingDays < config.holdingPeriodRules.shortTermThresholdDays) {
      const taxRate = config.taxRules.shortTermCapitalGainsRate;
      explanations.push({
        cause: `持有期${trade.holdingDays}天 < 365天`,
        constraint: `短期资本利得税率：${(taxRate * 100).toFixed(0)}%`,
        tradeoff: '快速调整权重以跟踪目标，但承担较高税率',
        result: `按${(taxRate * 100).toFixed(0)}%税率缴纳资本利得税`,
      });
    }

    if (trade.marginalTaxRate > 0.02) {
      explanations.push({
        cause: `边际税率较高：${(trade.marginalTaxRate * 100).toFixed(2)}%`,
        constraint: '税费最小化优化目标',
        tradeoff: '权衡跟踪误差与税费成本',
        result: `进行调整，但优先选择税率更低的标的先行调整`,
      });
    }
  }

  if (trade.lossOffsetApplied > 0) {
    explanations.push({
      cause: `本次交易产生盈利${(trade.estimatedCapitalGainsTax / config.taxRules.shortTermCapitalGainsRate).toFixed(2)}元`,
      constraint: '亏损抵扣规则',
      tradeoff: '使用以前年度/当年亏损抵扣本次盈利',
      result: `节省税款${trade.lossOffsetApplied.toFixed(2)}元`,
    });
  }

  return explanations;
}
