import { Anomaly, AnomalyCategory, Bill, Application, Quote } from '../types';

export function classifyAnomalies(
  rawAnomalies: Anomaly[],
  bill: Bill,
  app: Application,
  quote: Quote | null
): Anomaly[] {
  return rawAnomalies.map((a) => {
    const enriched = { ...a };
    if (!enriched.billNo) {
      enriched.billNo = bill.billNo;
    }

    enriched.category = recategorize(enriched, bill, app, quote);

    return enriched;
  });
}

function recategorize(
  anomaly: Anomaly,
  bill: Bill,
  app: Application,
  quote: Quote | null
): AnomalyCategory {
  const code = anomaly.code;

  const dataCodes: Set<string> = new Set([
    'RATE_MISMATCH',
    'DUPLICATE_DISCOUNT_PENDING',
    'DUPLICATE_CALCULATION_EXISTS',
    'ZERO_INTEREST_DAYS',
  ]);

  const ruleCodes: Set<string> = new Set([
    'INVALID_DATE_RANGE',
    'LONG_INTEREST_PERIOD',
    'DUPLICATE_DISCOUNT_APPROVED',
    'QUOTE_NOT_MATCHING',
    'QUOTE_NEAR_EXPIRY',
  ]);

  const materialCodes: Set<string> = new Set([
    'MISSING_BILL',
    'NO_QUOTE_FOUND',
    'QUOTE_EXPIRED',
  ]);

  if (dataCodes.has(code)) return 'data';
  if (ruleCodes.has(code)) return 'rule';
  if (materialCodes.has(code)) return 'material';

  return anomaly.category;
}

export function getAnomalyStats(anomalies: Anomaly[]): {
  total: number;
  resolved: number;
  byCategory: Record<AnomalyCategory, number>;
  bySeverity: Record<string, number>;
} {
  const byCategory: Record<AnomalyCategory, number> = { data: 0, rule: 0, material: 0 };
  const bySeverity: Record<string, number> = { error: 0, warning: 0, info: 0 };

  for (const a of anomalies) {
    byCategory[a.category]++;
    bySeverity[a.severity]++;
  }

  return {
    total: anomalies.length,
    resolved: anomalies.filter((a) => a.resolved).length,
    byCategory,
    bySeverity,
  };
}

export function formatCategoryLabel(category: AnomalyCategory): string {
  const labels: Record<AnomalyCategory, string> = {
    data: '数据问题',
    rule: '规则问题',
    material: '材料缺失',
  };
  return labels[category];
}

export function formatSeverityIcon(severity: string): string {
  const icons: Record<string, string> = {
    error: '✖',
    warning: '⚠',
    info: 'ℹ',
  };
  return icons[severity] || '?';
}
