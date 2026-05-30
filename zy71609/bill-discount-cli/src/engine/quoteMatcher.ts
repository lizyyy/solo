import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import { Quote, Application, Bill, Anomaly } from '../types';

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

export interface QuoteMatchResult {
  quote: Quote | null;
  anomalies: Anomaly[];
}

export function matchQuote(
  app: Application,
  bill: Bill,
  quotes: Quote[]
): QuoteMatchResult {
  const anomalies: Anomaly[] = [];
  const now = dayjs();

  const matchingQuotes = quotes.filter(
    (q) =>
      q.bankName === app.bankName &&
      q.billType === bill.billType &&
      q.minAmount <= bill.amount &&
      q.maxAmount >= bill.amount &&
      dayjs(q.effectiveDate).isSameOrBefore(dayjs(app.discountDate)) &&
      dayjs(q.expiryDate).isSameOrAfter(dayjs(app.discountDate))
  );

  if (matchingQuotes.length === 0) {
    const allBankQuotes = quotes.filter((q) => q.bankName === app.bankName);

    if (allBankQuotes.length === 0) {
      anomalies.push({
        id: `no-quote-${app.appId}`,
        billNo: bill.billNo,
        category: 'material',
        severity: 'error',
        code: 'NO_QUOTE_FOUND',
        message: '该银行无可用报价',
        detail: `银行=${app.bankName}, 票据类型=${bill.billType}, 金额=${bill.amount}`,
        resolved: false,
        resolvedAt: '',
        resolution: '',
        createdAt: new Date().toISOString(),
      });
    } else {
      const latestQuote = allBankQuotes.sort((a, b) => b.version - a.version)[0];
      if (dayjs(latestQuote.expiryDate).isBefore(dayjs(app.discountDate))) {
        anomalies.push({
          id: `expired-quote-${app.appId}`,
          billNo: bill.billNo,
          category: 'material',
          severity: 'error',
          code: 'QUOTE_EXPIRED',
          message: '银行报价已过期',
          detail: `银行=${app.bankName}, 最新报价到期日=${latestQuote.expiryDate}, 贴现日=${app.discountDate}`,
          resolved: false,
          resolvedAt: '',
          resolution: '',
          createdAt: new Date().toISOString(),
        });
      } else {
        anomalies.push({
          id: `no-matching-quote-${app.appId}`,
          billNo: bill.billNo,
          category: 'rule',
          severity: 'warning',
          code: 'QUOTE_NOT_MATCHING',
          message: '无匹配报价(金额或类型不符)',
          detail: `银行=${app.bankName}, 票据类型=${bill.billType}, 金额=${bill.amount}, 需要在[${latestQuote.minAmount}-${latestQuote.maxAmount}]范围内`,
          resolved: false,
          resolvedAt: '',
          resolution: '',
          createdAt: new Date().toISOString(),
        });
      }
    }

    return { quote: null, anomalies };
  }

  const bestQuote = matchingQuotes.sort((a, b) => b.version - a.version)[0];

  if (dayjs(bestQuote.expiryDate).isBefore(now)) {
    anomalies.push({
      id: `quote-near-expiry-${app.appId}`,
      billNo: bill.billNo,
      category: 'rule',
      severity: 'warning',
      code: 'QUOTE_NEAR_EXPIRY',
      message: '匹配报价即将到期',
      detail: `银行=${app.bankName}, 报价到期日=${bestQuote.expiryDate}, 当前日期=${now.format('YYYY-MM-DD')}`,
      resolved: false,
      resolvedAt: '',
      resolution: '',
      createdAt: new Date().toISOString(),
    });
  }

  if (bestQuote.rate !== app.appliedRate) {
    anomalies.push({
      id: `rate-mismatch-${app.appId}`,
      billNo: bill.billNo,
      category: 'data',
      severity: bestQuote.rate > app.appliedRate ? 'error' : 'warning',
      code: 'RATE_MISMATCH',
      message: '申请利率与报价利率不一致',
      detail: `申请利率=${app.appliedRate}%, 报价利率=${bestQuote.rate}%, 差异=${(bestQuote.rate - app.appliedRate).toFixed(4)}%`,
      resolved: false,
      resolvedAt: '',
      resolution: '',
      createdAt: new Date().toISOString(),
    });
  }

  return { quote: bestQuote, anomalies };
}
