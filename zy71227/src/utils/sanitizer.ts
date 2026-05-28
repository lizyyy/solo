import type { ReportData, AuctionRecord, Collector } from '../types';

export type SanitizeMode = 'mask' | 'hash' | 'remove';

export interface SanitizeRules {
  collectorBudget: SanitizeMode;
  collectorName: SanitizeMode;
  artistName: SanitizeMode;
  transactionIds: SanitizeMode;
}

const defaultRules: SanitizeRules = {
  collectorBudget: 'mask',
  collectorName: 'mask',
  artistName: 'mask',
  transactionIds: 'hash'
};

export function maskValue(value: string | number): string {
  const str = String(value);
  if (typeof value === 'number') {
    const num = value as number;
    if (num >= 1000) {
      return '***,' + str.slice(-3);
    }
    return '***';
  }
  if (str.length <= 2) {
    return '*'.repeat(str.length);
  }
  return str[0] + '*'.repeat(Math.max(0, str.length - 2)) + str.slice(-1);
}

export function hashValue(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return '0x' + Math.abs(hash).toString(16).slice(0, 8).toUpperCase();
}

export function sanitizeCollector(
  collector: Collector,
  rules: Partial<SanitizeRules> = {}
): Record<string, unknown> {
  const mergedRules = { ...defaultRules, ...rules };
  const result: Record<string, unknown> = { ...collector };

  if (mergedRules.collectorBudget === 'mask') {
    result.budget = maskValue(collector.budget);
  } else if (mergedRules.collectorBudget === 'hash') {
    result.budget = hashValue(String(collector.budget));
  } else if (mergedRules.collectorBudget === 'remove') {
    delete result.budget;
  }

  if (mergedRules.collectorName === 'mask') {
    result.name = maskValue(collector.name);
  } else if (mergedRules.collectorName === 'hash') {
    result.name = hashValue(collector.name);
  } else if (mergedRules.collectorName === 'remove') {
    delete result.name;
  }

  return result;
}

export function sanitizeAuctionRecord(
  record: AuctionRecord,
  rules: Partial<SanitizeRules> = {}
): Record<string, unknown> {
  const mergedRules = { ...defaultRules, ...rules };
  const result: Record<string, unknown> = { ...record };

  if (mergedRules.transactionIds === 'mask') {
    result.id = maskValue(record.id);
  } else if (mergedRules.transactionIds === 'hash') {
    result.id = hashValue(record.id);
  } else if (mergedRules.transactionIds === 'remove') {
    delete result.id;
  }

  if (mergedRules.collectorBudget === 'mask' && record.finalBidderId) {
    result.finalBidderId = maskValue(record.finalBidderId);
  } else if (mergedRules.collectorBudget === 'hash' && record.finalBidderId) {
    result.finalBidderId = hashValue(record.finalBidderId);
  } else if (mergedRules.collectorBudget === 'remove') {
    delete result.finalBidderId;
  }

  return result;
}

export function sanitizeReport(
  report: ReportData,
  rules: Partial<SanitizeRules> = {}
): ReportData {
  const mergedRules = { ...defaultRules, ...rules };
  const sanitizedReport = JSON.parse(JSON.stringify(report)) as ReportData;

  sanitizedReport.byArtwork = sanitizedReport.byArtwork.map(item => {
    if (mergedRules.artistName === 'mask') {
      return { ...item, title: maskValue(item.title) };
    } else if (mergedRules.artistName === 'hash') {
      return { ...item, title: hashValue(item.title) };
    } else if (mergedRules.artistName === 'remove') {
      return { ...item, title: '[REDACTED' };
    }
    return item;
  });

  return sanitizedReport;
}

export function exportToJSON(data: unknown, sanitized: boolean = true): string {
  const exportData = sanitized ? data : data;
  return JSON.stringify(exportData, null, 2);
}

export function exportToCSV(data: Record<string, unknown>[], headers: string[]): string {
  const headerRow = headers.join(',');
  const dataRows = data.map(row =>
    headers.map(h => {
      const value = row[h];
      if (typeof value === 'string' && value.includes(',')) {
        return `"${value}"`;
      }
      return String(value ?? '');
    }).join(',')
  );
  return [headerRow, ...dataRows].join('\n');
}
