import { Holding, RebalanceConfig, TaxBreakdown, EvidenceRecord, CalculationStep } from '@/types';

export interface TradeForTax {
  action: 'buy' | 'sell';
  quantity: number;
  price: number;
  value: number;
}

export function calculateHoldingDays(purchaseDate: Date, asOfDate: Date = new Date()): number {
  const diffTime = Math.abs(asOfDate.getTime() - purchaseDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function getCapitalGainsTaxRate(
  holdingDays: number,
  config: RebalanceConfig
): { rate: number; isLongTerm: boolean } {
  if (holdingDays > config.holdingPeriodRules.longTermThresholdDays) {
    return { rate: config.taxRules.longTermCapitalGainsRate, isLongTerm: true };
  }
  return { rate: config.taxRules.shortTermCapitalGainsRate, isLongTerm: false };
}

export interface TaxCalculationResult {
  breakdown: TaxBreakdown;
  evidenceSteps: CalculationStep[];
  marginalTaxRate: number;
}

export function calculateTaxForTrade(
  trade: TradeForTax,
  holding: Holding,
  config: RebalanceConfig,
  materialId: string,
  rowIndex: number
): TaxCalculationResult {
  const evidenceSteps: CalculationStep[] = [];
  const asOfDate = new Date();

  const holdingDays = calculateHoldingDays(holding.purchaseDate, asOfDate);
  evidenceSteps.push({
    order: 1,
    operation: '持有期计算',
    formula: 'ceil((T - T0) / 86400000)',
    inputs: {
      T: { value: asOfDate.getTime(), source: '系统当前日期' },
      T0: { value: holding.purchaseDate.getTime(), source: '持仓表买入日期', materialId, rowIndex },
    },
    result: holdingDays,
    timestamp: new Date(),
  });

  const commission = Math.max(
    trade.value * config.taxRules.commissionRate,
    config.taxRules.commissionMin
  );
  evidenceSteps.push({
    order: 2,
    operation: '交易佣金计算',
    formula: 'max(成交金额 × 佣金率, 最低佣金)',
    inputs: {
      成交金额: { value: trade.value, source: '交易金额' },
      佣金率: { value: config.taxRules.commissionRate, source: '配置参数' },
      最低佣金: { value: config.taxRules.commissionMin, source: '配置参数' },
    },
    result: commission,
    timestamp: new Date(),
  });

  const stampDuty = trade.action === 'sell'
    ? trade.value * config.taxRules.stampDutyRate
    : 0;
  if (trade.action === 'sell') {
    evidenceSteps.push({
      order: 3,
      operation: '印花税计算',
      formula: '卖出成交金额 × 印花税率',
      inputs: {
        卖出成交金额: { value: trade.value, source: '交易金额' },
        印花税率: { value: config.taxRules.stampDutyRate, source: '配置参数' },
      },
      result: stampDuty,
      timestamp: new Date(),
    });
  }

  let capitalGainsTax = 0;
  let marginalTaxRate = 0;
  if (trade.action === 'sell') {
    const realizedGain = (trade.price - holding.costBasis) * trade.quantity;
    const { rate, isLongTerm } = getCapitalGainsTaxRate(holdingDays, config);
    marginalTaxRate = rate;
    
    evidenceSteps.push({
      order: 4,
      operation: '实现盈亏计算',
      formula: '(卖出价 - 成本价) × 卖出数量',
      inputs: {
        卖出价: { value: trade.price, source: '买卖报价', materialId, rowIndex },
        成本价: { value: holding.costBasis, source: '持仓表成本价', materialId, rowIndex },
        卖出数量: { value: trade.quantity, source: '交易建议' },
      },
      result: realizedGain,
      timestamp: new Date(),
    });

    evidenceSteps.push({
      order: 5,
      operation: '利得税税率判定',
      formula: isLongTerm ? '持有期 > 365天 → 长期税率' : '持有期 ≤ 365天 → 短期税率',
      inputs: {
        持有天数: { value: holdingDays, source: '步骤1结果' },
        长期税率: { value: config.taxRules.longTermCapitalGainsRate, source: '配置参数' },
        短期税率: { value: config.taxRules.shortTermCapitalGainsRate, source: '配置参数' },
      },
      result: rate,
      timestamp: new Date(),
    });

    capitalGainsTax = realizedGain > 0 ? realizedGain * rate : 0;
    if (realizedGain > 0) {
      evidenceSteps.push({
        order: 6,
        operation: '资本利得税计算',
        formula: '盈利金额 × 适用税率',
        inputs: {
          盈利金额: { value: realizedGain, source: '步骤4结果' },
          适用税率: { value: rate, source: '步骤5结果' },
        },
        result: capitalGainsTax,
        timestamp: new Date(),
      });
    }
  }

  const totalTax = commission + stampDuty + capitalGainsTax;
  evidenceSteps.push({
    order: 7,
    operation: '税费合计',
    formula: '佣金 + 印花税 + 资本利得税',
    inputs: {
      佣金: { value: commission, source: '步骤2结果' },
      印花税: { value: stampDuty, source: trade.action === 'sell' ? '步骤3结果' : '0（买入免征）' },
      资本利得税: { value: capitalGainsTax, source: trade.action === 'sell' ? '步骤6结果' : '0（买入不产生）' },
    },
    result: totalTax,
    timestamp: new Date(),
  });

  return {
    breakdown: {
      commission,
      stampDuty,
      capitalGainsTax,
      lossOffset: 0,
      totalTax,
    },
    evidenceSteps,
    marginalTaxRate,
  };
}

export function calculateMarginalTaxRate(
  holding: Holding,
  config: RebalanceConfig
): number {
  const holdingDays = calculateHoldingDays(holding.purchaseDate);
  const { rate } = getCapitalGainsTaxRate(holdingDays, config);
  
  const unrealizedGainPerShare = holding.marketPrice - holding.costBasis;
  if (unrealizedGainPerShare <= 0) return 0;
  
  const commissionRate = config.taxRules.commissionRate;
  const stampDutyRate = config.taxRules.stampDutyRate;
  
  return (rate * unrealizedGainPerShare + config.taxRules.commissionMin / holding.quantity) 
    / holding.marketPrice + commissionRate + stampDutyRate;
}

export function createEvidenceRecord(
  taskId: string,
  targetId: string,
  targetType: 'trade' | 'tax' | 'holding',
  steps: CalculationStep[],
  sourceMaterialIds: string[]
): EvidenceRecord {
  return {
    id: `ev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    taskId,
    targetType,
    targetId,
    calculationSteps: steps,
    sourceMaterialIds,
  };
}
