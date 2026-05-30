import { RebalanceConfig, TradeSuggestion, CalculationStep } from '@/types';

export interface LossPool {
  shortTermLosses: number;
  longTermLosses: number;
  priorYearLosses: number;
  washSaleDisallowed: number[];
}

export interface LossOffsetResult {
  offsetApplied: number;
  remainingLosses: LossPool;
  evidenceSteps: CalculationStep[];
  disallowedReasons: string[];
}

export function checkWashSale(
  symbol: string,
  action: 'buy' | 'sell',
  recentTrades: Array<{ symbol: string; action: string; date: Date; gain: number }>,
  config: RebalanceConfig
): { isDisallowed: boolean; reason?: string } {
  if (!config.constraints.washSaleProtection || action !== 'buy') {
    return { isDisallowed: false };
  }

  const protectionDays = config.lossOffsetRules.washSaleProtectionDays;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - protectionDays);

  const recentLossSale = recentTrades.find(
    t => t.symbol === symbol && 
         t.action === 'sell' && 
         t.gain < 0 && 
         t.date >= cutoffDate
  );

  if (recentLossSale) {
    return {
      isDisallowed: true,
      reason: `Wash Sale规则：${protectionDays}天内曾卖出${symbol}并产生亏损${recentLossSale.gain.toFixed(2)}元，此次买入的亏损将不可抵扣`
    };
  }

  return { isDisallowed: false };
}

export function applyLossOffset(
  realizedGain: number,
  holdingDays: number,
  lossPool: LossPool,
  config: RebalanceConfig,
  order: number = 1
): LossOffsetResult {
  const evidenceSteps: CalculationStep[] = [];
  const disallowedReasons: string[] = [];
  
  if (!config.lossOffsetRules.enabled || realizedGain <= 0) {
    evidenceSteps.push({
      order,
      operation: '亏损抵扣检查',
      formula: realizedGain <= 0 ? '亏损无需抵扣' : '亏损抵扣未启用',
      inputs: {
        实现盈亏: { value: realizedGain, source: '税费计算模块' },
        抵扣启用: { value: config.lossOffsetRules.enabled ? 1 : 0, source: '配置参数' },
      },
      result: 0,
      timestamp: new Date(),
    });
    
    return {
      offsetApplied: 0,
      remainingLosses: { ...lossPool },
      evidenceSteps,
      disallowedReasons,
    };
  }

  const isLongTermGain = holdingDays > config.holdingPeriodRules.longTermThresholdDays;
  let remainingGain = realizedGain;
  let offsetApplied = 0;
  const remainingLosses = { ...lossPool };

  evidenceSteps.push({
    order,
    operation: '盈亏性质判断',
    formula: isLongTermGain ? '持有期 > 365天 → 长期盈利' : '持有期 ≤ 365天 → 短期盈利',
    inputs: {
      持有天数: { value: holdingDays, source: '税费计算模块' },
      实现盈利: { value: realizedGain, source: '税费计算模块' },
    },
    result: isLongTermGain ? 1 : 0,
    timestamp: new Date(),
  });

  const offsetOrder = config.lossOffsetRules.offsetOrder;
  const useShortFirst = offsetOrder === 'short_first' ? !isLongTermGain : isLongTermGain;

  if (useShortFirst) {
    if (remainingLosses.shortTermLosses < 0 && remainingGain > 0) {
      const available = Math.abs(remainingLosses.shortTermLosses);
      const offsetAmount = Math.min(available, remainingGain);
      
      evidenceSteps.push({
        order: order + 1,
        operation: '短期亏损抵扣短期盈利',
        formula: 'min(可用短期亏损, 剩余盈利)',
        inputs: {
          可用短期亏损: { value: available, source: '亏损池' },
          剩余盈利: { value: remainingGain, source: '上一步结果' },
        },
        result: offsetAmount,
        timestamp: new Date(),
      });
      
      remainingGain -= offsetAmount;
      offsetApplied += offsetAmount;
      remainingLosses.shortTermLosses += offsetAmount;
    }

    if (remainingLosses.longTermLosses < 0 && remainingGain > 0) {
      const available = Math.abs(remainingLosses.longTermLosses);
      const offsetAmount = Math.min(available, remainingGain);
      
      evidenceSteps.push({
        order: order + 2,
        operation: '长期亏损抵扣剩余盈利',
        formula: 'min(可用长期亏损, 剩余盈利)',
        inputs: {
          可用长期亏损: { value: available, source: '亏损池' },
          剩余盈利: { value: remainingGain, source: '上一步结果' },
        },
        result: offsetAmount,
        timestamp: new Date(),
      });
      
      remainingGain -= offsetAmount;
      offsetApplied += offsetAmount;
      remainingLosses.longTermLosses += offsetAmount;
    }
  } else {
    if (remainingLosses.longTermLosses < 0 && remainingGain > 0) {
      const available = Math.abs(remainingLosses.longTermLosses);
      const offsetAmount = Math.min(available, remainingGain);
      
      evidenceSteps.push({
        order: order + 1,
        operation: '长期亏损抵扣长期盈利',
        formula: 'min(可用长期亏损, 剩余盈利)',
        inputs: {
          可用长期亏损: { value: available, source: '亏损池' },
          剩余盈利: { value: remainingGain, source: '上一步结果' },
        },
        result: offsetAmount,
        timestamp: new Date(),
      });
      
      remainingGain -= offsetAmount;
      offsetApplied += offsetAmount;
      remainingLosses.longTermLosses += offsetAmount;
    }

    if (remainingLosses.shortTermLosses < 0 && remainingGain > 0) {
      const available = Math.abs(remainingLosses.shortTermLosses);
      const offsetAmount = Math.min(available, remainingGain);
      
      evidenceSteps.push({
        order: order + 2,
        operation: '短期亏损抵扣剩余盈利',
        formula: 'min(可用短期亏损, 剩余盈利)',
        inputs: {
          可用短期亏损: { value: available, source: '亏损池' },
          剩余盈利: { value: remainingGain, source: '上一步结果' },
        },
        result: offsetAmount,
        timestamp: new Date(),
      });
      
      remainingGain -= offsetAmount;
      offsetApplied += offsetAmount;
      remainingLosses.shortTermLosses += offsetAmount;
    }
  }

  if (remainingLosses.priorYearLosses < 0 && remainingGain > 0) {
    const available = Math.abs(remainingLosses.priorYearLosses);
    const offsetAmount = Math.min(available, remainingGain);
    
    evidenceSteps.push({
      order: order + 3,
      operation: '以前年度亏损结转抵扣',
      formula: 'min(可用结转亏损, 剩余盈利)',
      inputs: {
        可用结转亏损: { value: available, source: '配置参数-以前年度亏损' },
        剩余盈利: { value: remainingGain, source: '上一步结果' },
      },
      result: offsetAmount,
      timestamp: new Date(),
    });
    
    remainingGain -= offsetAmount;
    offsetApplied += offsetAmount;
    remainingLosses.priorYearLosses += offsetAmount;
  }

  evidenceSteps.push({
    order: order + 4,
    operation: '亏损抵扣汇总',
    formula: 'Σ各步抵扣金额',
    inputs: {
      抵扣金额: { value: offsetApplied, source: '上述步骤结果' },
      未抵扣盈利: { value: remainingGain, source: '剩余需纳税盈利' },
    },
    result: offsetApplied,
    timestamp: new Date(),
  });

  return {
    offsetApplied,
    remainingLosses,
    evidenceSteps,
    disallowedReasons,
  };
}

export function processTradesWithLossOffset(
  trades: TradeSuggestion[],
  config: RebalanceConfig
): {
  updatedTrades: TradeSuggestion[];
  finalLossPool: LossPool;
  totalOffset: number;
} {
  let lossPool: LossPool = {
    shortTermLosses: 0,
    longTermLosses: 0,
    priorYearLosses: config.lossOffsetRules.priorYearLosses,
    washSaleDisallowed: [],
  };

  const sellTrades = trades.filter(t => t.action === 'sell');
  const buyTrades = trades.filter(t => t.action === 'buy');
  const holdTrades = trades.filter(t => t.action === 'hold');

  const recentTrades: Array<{ symbol: string; action: string; date: Date; gain: number }> = [];

  const processedSells = sellTrades.map(trade => {
    const isLongTerm = trade.holdingDays > config.holdingPeriodRules.longTermThresholdDays;
    const realizedGain = (trade.price - (trade.estimatedValue / trade.quantity)) * trade.quantity;
    
    const offsetResult = applyLossOffset(
      Math.max(0, realizedGain),
      trade.holdingDays,
      lossPool,
      config
    );

    if (realizedGain < 0) {
      if (isLongTerm) {
        lossPool.longTermLosses += realizedGain;
      } else {
        lossPool.shortTermLosses += realizedGain;
      }
      
      recentTrades.push({
        symbol: trade.symbol,
        action: 'sell',
        date: new Date(),
        gain: realizedGain,
      });
    }

    const updatedTax = Math.max(0, trade.estimatedCapitalGainsTax - offsetResult.offsetApplied);
    
    return {
      ...trade,
      lossOffsetApplied: offsetResult.offsetApplied,
      estimatedCapitalGainsTax: updatedTax,
      estimatedTotalTax: trade.estimatedCommission + trade.estimatedStampDuty + updatedTax,
      constraints: [...trade.constraints, ...offsetResult.disallowedReasons],
    };
  });

  const processedBuys = buyTrades.map(trade => {
    const washSaleCheck = checkWashSale(trade.symbol, 'buy', recentTrades, config);
    if (washSaleCheck.isDisallowed && washSaleCheck.reason) {
      return {
        ...trade,
        constraints: [...trade.constraints, washSaleCheck.reason],
      };
    }
    return trade;
  });

  const totalOffset = processedSells.reduce((sum, t) => sum + t.lossOffsetApplied, 0);

  return {
    updatedTrades: [...processedSells, ...processedBuys, ...holdTrades],
    finalLossPool: lossPool,
    totalOffset,
  };
}
