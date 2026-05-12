import * as crypto from 'crypto';
import { LogEntry, SamplingOptions, AggregatedSample, ErrorCodeMapping, SuppressionRule } from './types';

export class Aggregator {
  private errorCodeMapping: ErrorCodeMapping;
  private suppressionRules: SuppressionRule[];
  private knownErrorCodes: Set<string>;

  constructor(
    errorCodeMapping: ErrorCodeMapping = {},
    suppressionRules: SuppressionRule[] = [],
    knownErrorCodes: Set<string> = new Set()
  ) {
    this.errorCodeMapping = errorCodeMapping;
    this.suppressionRules = suppressionRules;
    this.knownErrorCodes = knownErrorCodes;
  }

  public aggregate(entries: LogEntry[], options: SamplingOptions): AggregatedSample[] {
    const grouped = new Map<string, LogEntry[]>();
    
    entries.forEach(entry => {
      const key = this.getAggregationKey(entry, options.timeWindowMinutes);
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(entry);
    });

    const samples: AggregatedSample[] = [];
    
    grouped.forEach((groupEntries, key) => {
      if (groupEntries.length >= options.minSampleCount) {
        const sample = this.createSample(groupEntries, key);
        samples.push(sample);
      }
    });

    return this.sortSamples(samples, options);
  }

  private getAggregationKey(entry: LogEntry, timeWindowMinutes: number): string {
    const orderId = entry.orderId || 'UNKNOWN';
    const tenantId = entry.tenantId || 'UNKNOWN';
    const errorCode = entry.errorCode || 'UNKNOWN';
    
    const timeKey = this.getTimeWindowKey(entry.timestamp, timeWindowMinutes);
    
    return `${tenantId}||${errorCode}||${timeKey}||${this.normalizeOrderId(orderId)}`;
  }

  private normalizeOrderId(orderId: string): string {
    if (orderId === 'UNKNOWN') return 'UNKNOWN';
    return orderId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
  }

  private getTimeWindowKey(timestamp: string, minutes: number): string {
    const date = new Date(timestamp);
    const timestampMs = date.getTime();
    const windowMs = minutes * 60 * 1000;
    const windowStart = Math.floor(timestampMs / windowMs) * windowMs;
    return new Date(windowStart).toISOString();
  }

  private createSample(entries: LogEntry[], key: string): AggregatedSample {
    const sortedEntries = [...entries].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    const representative = sortedEntries[0];
    const uniqueOrderIds = new Set<string>();
    const tenants = new Set<string>();
    const errorCodes = new Set<string>();
    
    let totalAmount = 0;
    let amountCount = 0;
    let firstSeen = new Date(entries[0].timestamp);
    let lastSeen = new Date(entries[0].timestamp);

    entries.forEach(entry => {
      if (entry.orderId) uniqueOrderIds.add(entry.orderId);
      if (entry.tenantId) tenants.add(entry.tenantId);
      if (entry.errorCode) errorCodes.add(entry.errorCode);
      
      if (entry.amount !== undefined && entry.amount >= 0) {
        totalAmount += entry.amount;
        amountCount++;
      }

      const entryTime = new Date(entry.timestamp);
      if (entryTime < firstSeen) firstSeen = entryTime;
      if (entryTime > lastSeen) lastSeen = entryTime;
    });

    const errorCode = representative.errorCode || 'UNKNOWN';
    const errorMapping = this.errorCodeMapping[errorCode];
    const avgAmount = amountCount > 0 ? totalAmount / amountCount : 0;
    
    const isNew = errorCode !== 'UNKNOWN' && !this.knownErrorCodes.has(errorCode);
    
    const suppression = this.checkSuppression(entries);
    
    const severity = errorMapping?.severity || 'unknown';
    const priority = this.calculatePriority(
      entries.length,
      totalAmount,
      uniqueOrderIds.size,
      tenants.size,
      severity
    );

    return {
      id: crypto.createHash('md5').update(key).digest('hex'),
      representative,
      count: entries.length,
      uniqueOrderIds: Array.from(uniqueOrderIds),
      tenants: Array.from(tenants),
      errorCode,
      errorDescription: errorMapping?.description || errorCode,
      totalAmount: Math.round(totalAmount * 100) / 100,
      avgAmount: Math.round(avgAmount * 100) / 100,
      firstSeen: firstSeen.toISOString(),
      lastSeen: lastSeen.toISOString(),
      timeWindow: key.split('||')[2],
      isNew,
      isSuppressed: suppression.isSuppressed,
      suppressionReason: suppression.reason,
      priority,
      severity,
      duplicateSamples: sortedEntries.slice(0, 5)
    };
  }

  private checkSuppression(entries: LogEntry[]): { isSuppressed: boolean; reason?: string } {
    const now = new Date();
    
    for (const rule of this.suppressionRules) {
      const expireDate = new Date(rule.expireAt);
      if (expireDate < now) continue;
      
      if (this.matchRule(entries, rule)) {
        return {
          isSuppressed: true,
          reason: rule.reason
        };
      }
    }
    
    return { isSuppressed: false };
  }

  private matchRule(entries: LogEntry[], rule: SuppressionRule): boolean {
    for (const entry of entries) {
      let matches = true;
      
      if (rule.orderIdPattern && entry.orderId) {
        try {
          const regex = new RegExp(rule.orderIdPattern);
          if (!regex.test(entry.orderId)) matches = false;
        } catch {
          if (rule.orderIdPattern !== entry.orderId) matches = false;
        }
      }
      
      if (rule.tenantIdPattern && entry.tenantId) {
        try {
          const regex = new RegExp(rule.tenantIdPattern);
          if (!regex.test(entry.tenantId)) matches = false;
        } catch {
          if (rule.tenantIdPattern !== entry.tenantId) matches = false;
        }
      }
      
      if (rule.errorCodePattern && entry.errorCode) {
        try {
          const regex = new RegExp(rule.errorCodePattern);
          if (!regex.test(entry.errorCode)) matches = false;
        } catch {
          if (rule.errorCodePattern !== entry.errorCode) matches = false;
        }
      }
      
      if (rule.messagePattern) {
        try {
          const regex = new RegExp(rule.messagePattern);
          if (!regex.test(entry.message)) matches = false;
        } catch {
          if (!entry.message.includes(rule.messagePattern)) matches = false;
        }
      }
      
      if (entry.amount !== undefined) {
        if (rule.minAmount !== undefined && entry.amount < rule.minAmount) matches = false;
        if (rule.maxAmount !== undefined && entry.amount > rule.maxAmount) matches = false;
      }
      
      if (matches) return true;
    }
    
    return false;
  }

  private calculatePriority(
    count: number,
    totalAmount: number,
    uniqueOrders: number,
    uniqueTenants: number,
    severity: string
  ): number {
    let priority = 0;
    
    priority += count * 1;
    priority += totalAmount * 0.1;
    priority += uniqueOrders * 10;
    priority += uniqueTenants * 50;
    
    const severityWeight: { [key: string]: number } = {
      'critical': 1000,
      'high': 500,
      'medium': 200,
      'low': 50,
      'unknown': 100
    };
    priority += severityWeight[severity] || 100;
    
    return Math.round(priority);
  }

  private sortSamples(samples: AggregatedSample[], options: SamplingOptions): AggregatedSample[] {
    const sorted = [...samples].sort((a, b) => {
      let comparison = 0;
      
      switch (options.sortBy) {
        case 'amount':
          comparison = a.totalAmount - b.totalAmount;
          break;
        case 'count':
          comparison = a.count - b.count;
          break;
        case 'priority':
          comparison = a.priority - b.priority;
          break;
        case 'time':
          comparison = new Date(a.lastSeen).getTime() - new Date(b.lastSeen).getTime();
          break;
      }
      
      return options.sortOrder === 'desc' ? -comparison : comparison;
    });
    
    return sorted.slice(0, options.maxSamples);
  }

  public updateErrorCodeMapping(mapping: ErrorCodeMapping): void {
    this.errorCodeMapping = mapping;
  }

  public updateSuppressionRules(rules: SuppressionRule[]): void {
    this.suppressionRules = rules;
  }

  public updateKnownErrorCodes(codes: Set<string>): void {
    this.knownErrorCodes = codes;
  }
}
