import type {
  PayoutPlan,
  CalculationResult,
  ParsedTerms,
  CustomerPosition,
} from '../types';
import { generateId } from '../utils/hash';

export function generatePayoutPlans(
  batchId: string,
  calculations: CalculationResult[],
  terms: ParsedTerms,
  positions: CustomerPosition[]
): PayoutPlan[] {
  const plans: PayoutPlan[] = [];
  
  const totalPrincipal = calculations.reduce((sum, c) => sum + c.principal, 0);
  const totalPayout = calculations.reduce((sum, c) => sum + c.payoutAmount, 0);
  const totalReturn = calculations.reduce((sum, c) => sum + c.calculatedReturn, 0);
  const avgReturnRate = totalPrincipal > 0 ? totalReturn / totalPrincipal : 0;
  
  plans.push({
    id: generateId('plan'),
    batchId,
    name: '方案一：按观察日收盘价计算',
    description: '使用观察区间内最后一个交易日的收盘价作为观察价格，匹配对应收益档位',
    totalPrincipal,
    totalPayout,
    totalReturn,
    averageReturnRate: avgReturnRate,
    details: calculations,
    isSelected: true,
    createdAt: new Date(),
  });
  
  const conservativeCalculations = calculations.map(calc => {
    const worstTier = terms.returnTiers.reduce((worst, tier) => 
      tier.returnRate < worst.returnRate ? tier : worst
    , terms.returnTiers[0]);
    
    const worstReturn = calc.principal * worstTier.returnRate;
    
    return {
      ...calc,
      id: generateId('calc'),
      matchedTierId: worstTier.id,
      matchedTierDescription: `保守方案: ${worstTier.description}`,
      returnRate: worstTier.returnRate,
      calculatedReturn: worstReturn,
      payoutAmount: calc.principal + worstReturn,
    };
  });
  
  const conservativeTotalReturn = conservativeCalculations.reduce((sum, c) => sum + c.calculatedReturn, 0);
  const conservativeTotalPayout = conservativeCalculations.reduce((sum, c) => sum + c.payoutAmount, 0);
  const conservativeAvgRate = totalPrincipal > 0 ? conservativeTotalReturn / totalPrincipal : 0;
  
  if (conservativeAvgRate < avgReturnRate - 0.0001) {
    plans.push({
      id: generateId('plan'),
      batchId,
      name: '方案二：保守方案（最低档收益率）',
      description: '假设所有客户均适用最低档收益率，用于风险准备金计提或最坏情况测算',
      totalPrincipal,
      totalPayout: conservativeTotalPayout,
      totalReturn: conservativeTotalReturn,
      averageReturnRate: conservativeAvgRate,
      details: conservativeCalculations,
      isSelected: false,
      createdAt: new Date(),
    });
  }
  
  if (terms.earlyTermination?.enabled) {
    const etCalculations = calculations.map(calc => {
      if (calc.earlyTerminated) return calc;
      
      const etRate = terms.earlyTermination!.returnRate;
      const etReturn = calc.principal * etRate;
      
      return {
        ...calc,
        id: generateId('calc'),
        matchedTierId: 'early_termination',
        matchedTierDescription: `假设提前终止: ${(etRate * 100).toFixed(2)}%`,
        returnRate: etRate,
        calculatedReturn: etReturn,
        payoutAmount: calc.principal + etReturn,
        earlyTerminated: true,
        terminationDate: terms.earlyTermination!.observationDates[0],
      };
    });
    
    const etTotalReturn = etCalculations.reduce((sum, c) => sum + c.calculatedReturn, 0);
    const etTotalPayout = etCalculations.reduce((sum, c) => sum + c.payoutAmount, 0);
    const etAvgRate = totalPrincipal > 0 ? etTotalReturn / totalPrincipal : 0;
    
    plans.push({
      id: generateId('plan'),
      batchId,
      name: '方案三：假设全部提前终止',
      description: '假设所有客户均在第一个提前终止观察日触发提前终止，用于压力测试',
      totalPrincipal,
      totalPayout: etTotalPayout,
      totalReturn: etTotalReturn,
      averageReturnRate: etAvgRate,
      details: etCalculations,
      isSelected: false,
      createdAt: new Date(),
    });
  }
  
  return plans;
}

export function selectPayoutPlan(
  plans: PayoutPlan[],
  planId: string
): PayoutPlan[] {
  return plans.map(plan => ({
    ...plan,
    isSelected: plan.id === planId,
  }));
}

export function getPayoutSummary(plan: PayoutPlan): {
  label: string;
  value: string;
}[] {
  return [
    { label: '客户数量', value: `${plan.details.length} 位` },
    { label: '本金合计', value: `¥${plan.totalPrincipal.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
    { label: '收益合计', value: `¥${plan.totalReturn.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
    { label: '兑付合计', value: `¥${plan.totalPayout.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
    { label: '平均收益率', value: `${(plan.averageReturnRate * 100).toFixed(2)}%` },
  ];
}
