import dayjs from 'dayjs';
import { Bill, Quote, Application, CalendarEntry, CalculationResult, Anomaly } from '../types';
import { matchQuote } from './quoteMatcher';
import { checkDuplicateDiscount } from './duplicateCheck';
import { classifyAnomalies } from '../anomaly/classifier';
import { loadStore } from '../store/store';

export function calculateInterestDays(
  discountDate: string,
  maturityDate: string,
  calendar: CalendarEntry[]
): { days: number; anomalies: Anomaly[] } {
  const anomalies: Anomaly[] = [];
  const start = dayjs(discountDate);
  const end = dayjs(maturityDate);

  if (end.isBefore(start)) {
    anomalies.push({
      id: `calc-days-${discountDate}-${maturityDate}`,
      billNo: '',
      category: 'rule',
      severity: 'error',
      code: 'INVALID_DATE_RANGE',
      message: '到期日早于贴现日',
      detail: `贴现日=${discountDate}, 到期日=${maturityDate}`,
      resolved: false,
      resolvedAt: '',
      resolution: '',
      createdAt: new Date().toISOString(),
    });
    return { days: 0, anomalies };
  }

  let workdays = 0;
  let totalDays = 0;
  let current = start.add(1, 'day');

  while (current.isBefore(end) || current.isSame(end, 'day')) {
    totalDays++;
    const dateStr = current.format('YYYY-MM-DD');
    const calEntry = calendar.find((c) => c.date === dateStr);

    if (calEntry) {
      if (calEntry.isWorkday) {
        workdays++;
      }
    } else {
      const dow = current.day();
      if (dow !== 0 && dow !== 6) {
        workdays++;
      }
    }
    current = current.add(1, 'day');
  }

  if (totalDays === 0) {
    anomalies.push({
      id: `calc-days-zero-${discountDate}-${maturityDate}`,
      billNo: '',
      category: 'data',
      severity: 'warning',
      code: 'ZERO_INTEREST_DAYS',
      message: '计息天数为0',
      detail: `贴现日=${discountDate}, 到期日=${maturityDate}, 计算天数=${totalDays}`,
      resolved: false,
      resolvedAt: '',
      resolution: '',
      createdAt: new Date().toISOString(),
    });
  }

  if (totalDays > 365) {
    anomalies.push({
      id: `calc-days-long-${discountDate}-${maturityDate}`,
      billNo: '',
      category: 'rule',
      severity: 'warning',
      code: 'LONG_INTEREST_PERIOD',
      message: '计息天数超过一年',
      detail: `贴现日=${discountDate}, 到期日=${maturityDate}, 计算天数=${totalDays}`,
      resolved: false,
      resolvedAt: '',
      resolution: '',
      createdAt: new Date().toISOString(),
    });
  }

  return { days: workdays, anomalies };
}

export function calculateDiscountInterest(
  amount: number,
  rate: number,
  days: number
): number {
  return Math.round(amount * (rate / 100) * (days / 360) * 100) / 100;
}

export function runCalculation(): CalculationResult[] {
  const store = loadStore();
  const results: CalculationResult[] = [];
  const now = new Date().toISOString();

  for (const app of store.applications) {
    const bill = store.bills.find((b) => b.billNo === app.billNo);
    if (!bill) {
      const anomaly: Anomaly = {
        id: `missing-bill-${app.appId}`,
        billNo: app.billNo,
        category: 'material',
        severity: 'error',
        code: 'MISSING_BILL',
        message: '贴现申请缺少对应票据',
        detail: `申请号=${app.appId}, 票据号=${app.billNo}`,
        resolved: false,
        resolvedAt: '',
        resolution: '',
        createdAt: now,
      };
      store.anomalies.push(anomaly);
      continue;
    }

    const allAnomalies: Anomaly[] = [];

    const duplicateAnomalies = checkDuplicateDiscount(app, store.applications, store.calculations);
    allAnomalies.push(...duplicateAnomalies);

    const { days, anomalies: dayAnomalies } = calculateInterestDays(
      app.discountDate,
      bill.maturityDate,
      store.calendar
    );
    allAnomalies.push(...dayAnomalies);

    const quoteResult = matchQuote(app, bill, store.quotes);
    allAnomalies.push(...quoteResult.anomalies);

    const matchedRate = quoteResult.quote ? quoteResult.quote.rate : app.appliedRate;
    const discountInterest = calculateDiscountInterest(bill.amount, matchedRate, days);
    const appliedInterest = calculateDiscountInterest(bill.amount, app.appliedRate, days);
    const netAmount = Math.round((bill.amount - discountInterest) * 100) / 100;
    const rateDiff = Math.round((matchedRate - app.appliedRate) * 10000) / 10000;
    const interestDiff = Math.round((discountInterest - appliedInterest) * 100) / 100;

    const classifiedAnomalies = classifyAnomalies(allAnomalies, bill, app, quoteResult.quote);
    allAnomalies.length = 0;
    allAnomalies.push(...classifiedAnomalies);

    for (const a of allAnomalies) {
      const existing = store.anomalies.find(
        (ea) => ea.billNo === a.billNo && ea.code === a.code && !ea.resolved
      );
      if (!existing) {
        store.anomalies.push(a);
      }
    }

    const calcResult: CalculationResult = {
      billNo: bill.billNo,
      appId: app.appId,
      bankName: app.bankName,
      amount: bill.amount,
      discountDate: app.discountDate,
      maturityDate: bill.maturityDate,
      interestDays: days,
      appliedRate: app.appliedRate,
      matchedQuoteId: quoteResult.quote ? quoteResult.quote.id : '',
      matchedRate,
      discountInterest,
      netAmount,
      rateDiff,
      interestDiff,
      anomalies: allAnomalies,
      calculatedAt: now,
    };

    const existingCalcIdx = store.calculations.findIndex(
      (c) => c.billNo === calcResult.billNo && c.appId === calcResult.appId
    );
    if (existingCalcIdx >= 0) {
      store.calculations[existingCalcIdx] = calcResult;
    } else {
      store.calculations.push(calcResult);
    }

    results.push(calcResult);
  }

  const { saveStore: doSave } = require('../store/store');
  doSave(store);
  return results;
}
