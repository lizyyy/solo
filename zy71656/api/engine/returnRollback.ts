import dayjs from 'dayjs';
import type { SalesRecord, ReturnRecord, CalculationStep } from '../../shared/types.js';
import { LATE_RETURN_THRESHOLD_DAYS } from '../../shared/constants.js';

export interface ReturnRollbackResult {
  netSalesVolume: number;
  netSalesAmount: number;
  returnVolume: number;
  returnAmount: number;
  lateReturns: ReturnRecord[];
  steps: CalculationStep[];
  isLate: boolean;
}

export function checkIsLateReturn(
  returnDate: string,
  saleDate: string,
  thresholdDays: number = LATE_RETURN_THRESHOLD_DAYS
): boolean {
  const returnDt = dayjs(returnDate);
  const saleDt = dayjs(saleDate);
  const daysDiff = returnDt.diff(saleDt, 'day');
  return daysDiff > thresholdDays;
}

export function matchReturnsToSales(
  sales: SalesRecord[],
  returns: ReturnRecord[]
): { matched: Map<string, ReturnRecord[]>; unmatched: ReturnRecord[] } {
  const matched = new Map<string, ReturnRecord[]>();
  const unmatched: ReturnRecord[] = [];

  const salesById = new Map(sales.map((s) => [s.id, s]));

  for (const ret of returns) {
    if (ret.originalSaleId && salesById.has(ret.originalSaleId)) {
      const existing = matched.get(ret.originalSaleId) || [];
      existing.push(ret);
      matched.set(ret.originalSaleId, existing);
    } else {
      unmatched.push(ret);
    }
  }

  return { matched, unmatched };
}

export function calculateReturnRollback(
  sales: SalesRecord[],
  returns: ReturnRecord[],
  settlementPeriod: string
): ReturnRollbackResult {
  const steps: CalculationStep[] = [];
  const lateReturns: ReturnRecord[] = [];

  let totalSalesVolume = 0;
  let totalSalesAmount = 0;
  let totalReturnVolume = 0;
  let totalReturnAmount = 0;
  let hasLateReturns = false;

  steps.push({
    order: 0,
    description: '统计销售数据',
    operation: 'sum',
    input: sales.length,
    output: 0,
    rule: `结算周期 ${settlementPeriod} 内有效销售记录共 ${sales.length} 条`,
  });

  for (const sale of sales) {
    totalSalesVolume += sale.quantity;
    totalSalesAmount += sale.totalAmount;
  }

  steps.push({
    order: 1,
    description: '汇总销售册数',
    operation: 'sum',
    input: totalSalesVolume,
    output: totalSalesVolume,
    rule: `销售册数合计 = ${sales.map((s) => s.quantity).join(' + ')} = ${totalSalesVolume}`,
  });

  steps.push({
    order: 2,
    description: '汇总销售码洋',
    operation: 'sum',
    input: totalSalesAmount,
    output: totalSalesAmount,
    rule: `销售码洋合计 = ${sales.map((s) => s.totalAmount.toFixed(2)).join(' + ')} = ${totalSalesAmount.toFixed(2)}`,
  });

  const { matched, unmatched } = matchReturnsToSales(sales, returns);

  for (const [saleId, returnList] of matched) {
    const sale = sales.find((s) => s.id === saleId);
    if (!sale) continue;

    for (const ret of returnList) {
      const isLate = checkIsLateReturn(ret.returnDate, sale.saleDate);
      if (isLate) {
        lateReturns.push(ret);
        hasLateReturns = true;
      }

      totalReturnVolume += ret.quantity;
      totalReturnAmount += ret.amount;

      steps.push({
        order: steps.length,
        description: `处理退货 ${ret.id}`,
        operation: 'return_rollback',
        input: ret.quantity,
        output: -ret.quantity,
        rule: `${isLate ? '[逾期退货] ' : ''}原销售单 ${saleId} (${dayjs(sale.saleDate).format('YYYY-MM-DD')})，退货 ${ret.quantity} 册，金额 ${ret.amount.toFixed(2)} 元${isLate ? `，距销售 ${dayjs(ret.returnDate).diff(dayjs(sale.saleDate), 'day')} 天，超过 ${LATE_RETURN_THRESHOLD_DAYS} 天阈值` : ''}`,
      });
    }
  }

  for (const ret of unmatched) {
    const isLate = ret.isLate || dayjs(ret.returnDate).diff(dayjs(settlementPeriod + '-01'), 'day') > LATE_RETURN_THRESHOLD_DAYS;
    if (isLate) {
      lateReturns.push(ret);
      hasLateReturns = true;
    }

    totalReturnVolume += ret.quantity;
    totalReturnAmount += ret.amount;

    steps.push({
      order: steps.length,
      description: `处理无匹配销售单的退货 ${ret.id}`,
      operation: 'return_rollback_unmatched',
      input: ret.quantity,
      output: -ret.quantity,
      rule: `${isLate ? '[逾期退货] ' : ''}无法追溯原销售单，退货 ${ret.quantity} 册，金额 ${ret.amount.toFixed(2)} 元，原因：${ret.reason || '未注明'}`,
    });
  }

  steps.push({
    order: steps.length,
    description: '汇总退货册数',
    operation: 'sum',
    input: totalReturnVolume,
    output: totalReturnVolume,
    rule: `退货册数合计 = ${totalReturnVolume} 册`,
  });

  steps.push({
    order: steps.length,
    description: '汇总退货码洋',
    operation: 'sum',
    input: totalReturnAmount,
    output: totalReturnAmount,
    rule: `退货码洋合计 = ${totalReturnAmount.toFixed(2)} 元`,
  });

  const netSalesVolume = Math.max(0, totalSalesVolume - totalReturnVolume);
  const netSalesAmount = Math.max(0, totalSalesAmount - totalReturnAmount);

  steps.push({
    order: steps.length,
    description: '计算净销售册数',
    operation: 'subtract',
    input: totalSalesVolume,
    output: netSalesVolume,
    rule: `净销售册数 = 销售册数 - 退货册数 = ${totalSalesVolume} - ${totalReturnVolume} = ${netSalesVolume}`,
  });

  steps.push({
    order: steps.length,
    description: '计算净销售码洋',
    operation: 'subtract',
    input: totalSalesAmount,
    output: netSalesAmount,
    rule: `净销售码洋 = 销售码洋 - 退货码洋 = ${totalSalesAmount.toFixed(2)} - ${totalReturnAmount.toFixed(2)} = ${netSalesAmount.toFixed(2)}`,
  });

  return {
    netSalesVolume,
    netSalesAmount,
    returnVolume: totalReturnVolume,
    returnAmount: totalReturnAmount,
    lateReturns,
    steps,
    isLate: hasLateReturns,
  };
}
