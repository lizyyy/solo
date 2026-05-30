import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { RuleService } from './RuleService.js';
import type {
  DrillConfig,
  DrillReport,
  HitResult,
  HitReason,
  Anomaly,
  AnomalyType,
  AnomalySeverity,
  RateLimitRule,
  Customer,
  RequestLog,
  Tier
} from '../../shared/types.js';

interface CustomerMap {
  [key: string]: Customer;
}

interface WindowCounter {
  [key: string]: {
    count: number;
    requests: RequestLog[];
  };
}

interface HitAnalysisParams {
  reportId?: string;
  ruleId?: string;
  customerId?: string;
  startTime?: string;
  endTime?: string;
  page?: number;
  pageSize?: number;
}

interface HitAnalysisResult {
  total: number;
  items: HitResult[];
  summary: {
    byReason: Record<HitReason, number>;
    byTier: Record<Tier, number>;
    wouldBlockCount: number;
  };
}

export class ShadowService {
  static async runDrill(config: DrillConfig): Promise<DrillReport> {
    const reportId = uuidv4();
    const now = new Date().toISOString();

    const ruleVersion = RuleService.getRuleVersion(config.ruleId, config.ruleVersion);
    if (!ruleVersion) {
      throw new Error(`Rule version ${config.ruleVersion} not found for rule ${config.ruleId}`);
    }

    const rule = ruleVersion.snapshot;

    const initialReport: DrillReport = {
      id: reportId,
      name: `${rule.name} - 影子演练 - ${new Date(config.startTime).toLocaleDateString()}`,
      ruleId: rule.id,
      ruleName: rule.name,
      ruleVersion: config.ruleVersion,
      startTime: config.startTime,
      endTime: config.endTime,
      sampleRate: config.sampleRate,
      totalRequests: 0,
      hitCount: 0,
      blockedCustomers: [],
      anomalies: [],
      hitResults: [],
      conclusion: '',
      status: 'running',
      createdAt: now
    };

    this.saveReport(initialReport);

    try {
      const requestLogs = this.getRequestLogs(config, rule);
      const sampledLogs = this.sampleRequests(requestLogs, config.sampleRate);
      const customers = this.getRelevantCustomers(rule.tier);
      const customerMap: CustomerMap = {};
      customers.forEach(c => customerMap[c.id] = c);

      const { hits, windowCounters } = this.calculateHits(sampledLogs, rule, customerMap);

      const anomalies = this.detectAnomalies(hits, sampledLogs, rule, customerMap, windowCounters);

      const blockedCustomers = [...new Set(hits.filter(h => h.wouldBlock).map(h => h.customerId))];

      const conclusion = this.generateConclusion(hits, anomalies, rule, sampledLogs.length);

      hits.forEach(hit => {
        this.saveHitResult({ ...hit, reportId });
      });

      anomalies.forEach(anomaly => {
        this.saveAnomaly(anomaly);
      });

      const finalReport: DrillReport = {
        ...initialReport,
        totalRequests: sampledLogs.length,
        hitCount: hits.length,
        blockedCustomers,
        anomalies,
        hitResults: hits,
        conclusion,
        status: 'completed'
      };

      this.updateReport(finalReport);

      return finalReport;
    } catch (error) {
      const failedReport: DrillReport = {
        ...initialReport,
        status: 'failed',
        conclusion: `演练执行失败: ${error instanceof Error ? error.message : '未知错误'}`
      };
      this.updateReport(failedReport);
      throw error;
    }
  }

  private static getRequestLogs(config: DrillConfig, rule: RateLimitRule): RequestLog[] {
    let sql = `
      SELECT id, customerId, path, method, timestamp, statusCode, latency, userAgent, ip
      FROM request_logs
      WHERE timestamp >= ? AND timestamp <= ?
    `;
    const params: string[] = [config.startTime, config.endTime];

    if (rule.path !== '*') {
      sql += ' AND path = ?';
      params.push(rule.path);
    }

    if (rule.method !== '*') {
      sql += ' AND method = ?';
      params.push(rule.method);
    }

    sql += ' ORDER BY timestamp ASC';

    const stmt = db.prepare(sql);
    return stmt.all(...params) as RequestLog[];
  }

  private static sampleRequests(logs: RequestLog[], sampleRate: number): RequestLog[] {
    if (sampleRate >= 1) return logs;
    if (sampleRate <= 0) return [];

    return logs.filter(() => Math.random() < sampleRate);
  }

  private static getRelevantCustomers(tier: Tier): Customer[] {
    const stmt = db.prepare(`
      SELECT id, name, tier, priority, isWhitelisted, whitelistExpiresAt, whitelistReason, totalRequests, blockedCount, createdAt, updatedAt
      FROM customers
      WHERE tier = ?
    `);

    const rows = stmt.all(tier) as Array<{
      id: string;
      name: string;
      tier: string;
      priority: number;
      isWhitelisted: number;
      whitelistExpiresAt?: string;
      whitelistReason?: string;
      totalRequests: number;
      blockedCount: number;
      createdAt: string;
      updatedAt: string;
    }>;

    return rows.map(row => ({
      ...row,
      tier: row.tier as Tier,
      isWhitelisted: row.isWhitelisted === 1
    }));
  }

  private static calculateHits(
    logs: RequestLog[],
    rule: RateLimitRule,
    customerMap: CustomerMap
  ): { hits: Array<HitResult & { rawRequest: string }>; windowCounters: WindowCounter } {
    const hits: Array<HitResult & { rawRequest: string }> = [];
    const windowCounters: WindowCounter = {};
    const windowMs = rule.windowSize * 1000;

    for (const log of logs) {
      const customer = customerMap[log.customerId];
      if (!customer) continue;

      const windowStart = this.getWindowStart(log.timestamp, windowMs);
      const windowKey = `${log.customerId}-${windowStart}`;

      if (!windowCounters[windowKey]) {
        windowCounters[windowKey] = { count: 0, requests: [] };
      }

      windowCounters[windowKey].count++;
      windowCounters[windowKey].requests.push(log);

      const count = windowCounters[windowKey].count;
      const isWhitelisted = this.isWhitelistedActive(customer, log.timestamp);

      let hitReason: HitReason | null = null;
      let explanation = '';
      let wouldBlock = false;
      let confidence = 0;

      if (isWhitelisted && customer.whitelistExpiresAt) {
        const expiresAt = new Date(customer.whitelistExpiresAt);
        const logTime = new Date(log.timestamp);
        if (logTime > expiresAt) {
          hitReason = 'whitelist_expired';
          explanation = `白名单已过期（过期时间：${customer.whitelistExpiresAt}），当前请求时间：${log.timestamp}`;
          wouldBlock = true;
          confidence = 0.95;
        }
      }

      if (!hitReason && count > rule.limit) {
        hitReason = 'threshold_exceeded';
        explanation = `${rule.windowSize}秒窗口内请求${count}次，阈值${rule.limit}`;
        wouldBlock = !isWhitelisted;
        confidence = 0.9;
      }

      const overlappingHit = this.checkWindowOverlap(log, rule, windowCounters, windowMs);
      if (overlappingHit && !hitReason) {
        hitReason = 'window_overlap';
        explanation = overlappingHit.explanation;
        wouldBlock = overlappingHit.wouldBlock;
        confidence = 0.85;
      }

      if (!hitReason && this.detectFalsePositive(log, windowCounters[windowKey], rule)) {
        hitReason = 'false_positive';
        explanation = '疑似突发流量误杀：短时间内请求集中但分布异常';
        wouldBlock = true;
        confidence = 0.7;
      }

      if (hitReason) {
        hits.push({
          id: uuidv4(),
          requestId: log.id,
          ruleId: rule.id,
          ruleVersion: rule.currentVersion,
          customerId: customer.id,
          customerName: customer.name,
          customerTier: customer.tier,
          hitReason,
          explanation,
          wouldBlock,
          confidence,
          requestTimestamp: log.timestamp,
          requestPath: log.path,
          rawRequest: JSON.stringify(log)
        } as HitResult & { rawRequest: string });
      }
    }

    return { hits, windowCounters };
  }

  private static getWindowStart(timestamp: string, windowMs: number): string {
    const time = new Date(timestamp).getTime();
    const windowStart = Math.floor(time / windowMs) * windowMs;
    return new Date(windowStart).toISOString();
  }

  private static isWhitelistedActive(customer: Customer, timestamp: string): boolean {
    if (!customer.isWhitelisted) return false;
    if (!customer.whitelistExpiresAt) return true;

    const logTime = new Date(timestamp).getTime();
    const expireTime = new Date(customer.whitelistExpiresAt).getTime();

    return logTime <= expireTime;
  }

  private static checkWindowOverlap(
    log: RequestLog,
    rule: RateLimitRule,
    windowCounters: WindowCounter,
    windowMs: number
  ): { explanation: string; wouldBlock: boolean } | null {
    const logTime = new Date(log.timestamp).getTime();
    const currentWindowStart = Math.floor(logTime / windowMs) * windowMs;
    const prevWindowStart = currentWindowStart - windowMs;
    const nextWindowStart = currentWindowStart + windowMs;

    const currentKey = `${log.customerId}-${new Date(currentWindowStart).toISOString()}`;
    const prevKey = `${log.customerId}-${new Date(prevWindowStart).toISOString()}`;
    const nextKey = `${log.customerId}-${new Date(nextWindowStart).toISOString()}`;

    const currentCount = windowCounters[currentKey]?.count || 0;
    const prevCount = windowCounters[prevKey]?.count || 0;
    const nextCount = windowCounters[nextKey]?.count || 0;

    const slidingWindowCount = prevCount + currentCount;
    if (slidingWindowCount > rule.limit * 1.5) {
      return {
        explanation: `滑动窗口重叠检测：前一窗口${prevCount}次 + 当前窗口${currentCount}次 = ${slidingWindowCount}次，超过阈值${rule.limit}的1.5倍`,
        wouldBlock: true
      };
    }

    if (currentCount > rule.limit * 0.8 && nextCount > rule.limit * 0.8) {
      return {
        explanation: `时间窗重叠预警：当前窗口${currentCount}次，下一窗口预测${nextCount}次，均接近阈值${rule.limit}`,
        wouldBlock: false
      };
    }

    return null;
  }

  private static detectFalsePositive(
    log: RequestLog,
    windowData: { count: number; requests: RequestLog[] },
    rule: RateLimitRule
  ): boolean {
    if (windowData.count < rule.limit * 0.5) return false;

    const timestamps = windowData.requests.map(r => new Date(r.timestamp).getTime());
    if (timestamps.length < 10) return false;

    const intervals: number[] = [];
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i - 1]);
    }

    const meanInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((a, b) => a + Math.pow(b - meanInterval, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);

    const cv = stdDev / meanInterval;

    return cv > 2.0 && windowData.count > rule.limit * 0.8;
  }

  private static detectAnomalies(
    hits: HitResult[],
    logs: RequestLog[],
    rule: RateLimitRule,
    customerMap: CustomerMap,
    windowCounters: WindowCounter
  ): Anomaly[] {
    const anomalies: Anomaly[] = [];

    const expiredWhitelistHits = hits.filter(h => h.hitReason === 'whitelist_expired');
    if (expiredWhitelistHits.length > 0) {
      const affectedCustomers = [...new Set(expiredWhitelistHits.map(h => h.customerId))];
      anomalies.push({
        id: uuidv4(),
        type: 'whitelist_expired',
        severity: 'critical',
        message: `检测到 ${affectedCustomers.length} 个客户的白名单已过期，导致 ${expiredWhitelistHits.length} 次请求被命中`,
        affectedEntities: affectedCustomers,
        recommendation: '请检查白名单配置，考虑为重要客户续期或调整规则',
        resolved: false,
        createdAt: new Date().toISOString()
      });
    }

    const windowOverlapHits = hits.filter(h => h.hitReason === 'window_overlap');
    if (windowOverlapHits.length > 0) {
      const affectedRules = [...new Set(windowOverlapHits.map(h => h.ruleId))];
      anomalies.push({
        id: uuidv4(),
        type: 'window_overlap',
        severity: 'warning',
        message: `检测到时间窗重叠问题，影响 ${affectedRules.length} 条规则，${windowOverlapHits.length} 次命中`,
        affectedEntities: affectedRules,
        recommendation: '考虑调整时间窗大小或使用滑动窗口算法减少边界效应',
        resolved: false,
        createdAt: new Date().toISOString()
      });
    }

    const falsePositiveHits = hits.filter(h => h.hitReason === 'false_positive');
    if (falsePositiveHits.length > 0) {
      const affectedCustomers = [...new Set(falsePositiveHits.map(h => h.customerId))];
      anomalies.push({
        id: uuidv4(),
        type: 'false_positive',
        severity: 'warning',
        message: `检测到 ${falsePositiveHits.length} 次疑似误杀，涉及 ${affectedCustomers.length} 个客户`,
        affectedEntities: affectedCustomers,
        recommendation: '建议人工复核这些命中，考虑调整阈值或增加白名单',
        resolved: false,
        createdAt: new Date().toISOString()
      });
    }

    return anomalies;
  }

  private static generateConclusion(
    hits: HitResult[],
    anomalies: Anomaly[],
    rule: RateLimitRule,
    totalRequests: number
  ): string {
    const hitRate = totalRequests > 0 ? ((hits.length / totalRequests) * 100).toFixed(2) : '0';
    const blockedCount = hits.filter(h => h.wouldBlock).length;
    const byReason = hits.reduce((acc, h) => {
      acc[h.hitReason] = (acc[h.hitReason] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    let conclusion = `演练完成，共分析 ${totalRequests} 条请求，命中 ${hits.length} 次（命中率 ${hitRate}%），其中会被拦截 ${blockedCount} 次。\n\n`;
    conclusion += `命中分布：\n`;
    for (const [reason, count] of Object.entries(byReason)) {
      const reasonLabels: Record<string, string> = {
        threshold_exceeded: '阈值超限',
        whitelist_expired: '白名单过期',
        window_overlap: '时间窗重叠',
        false_positive: '疑似误杀'
      };
      conclusion += `- ${reasonLabels[reason] || reason}: ${count} 次\n`;
    }

    if (anomalies.length > 0) {
      conclusion += `\n检测到 ${anomalies.length} 个异常：\n`;
      anomalies.forEach((a, i) => {
        conclusion += `${i + 1}. ${a.message}\n`;
      });
    }

    if (hits.length > totalRequests * 0.1) {
      conclusion += `\n⚠️ 警告：命中率超过 10%，建议评估规则阈值是否合理。`;
    } else if (hits.length === 0) {
      conclusion += `\nℹ️ 提示：本次演练无命中，可能需要降低阈值或扩大时间范围。`;
    }

    return conclusion;
  }

  private static saveReport(report: DrillReport): void {
    const stmt = db.prepare(`
      INSERT INTO drill_reports (id, name, ruleId, ruleName, ruleVersion, startTime, endTime, sampleRate, totalRequests, hitCount, blockedCustomers, anomalies, conclusion, status, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      report.id,
      report.name,
      report.ruleId,
      report.ruleName,
      report.ruleVersion,
      report.startTime,
      report.endTime,
      report.sampleRate,
      report.totalRequests,
      report.hitCount,
      JSON.stringify(report.blockedCustomers),
      JSON.stringify(report.anomalies),
      report.conclusion,
      report.status,
      report.createdAt
    );
  }

  private static updateReport(report: DrillReport): void {
    const stmt = db.prepare(`
      UPDATE drill_reports
      SET totalRequests = ?, hitCount = ?, blockedCustomers = ?, anomalies = ?, conclusion = ?, status = ?
      WHERE id = ?
    `);

    stmt.run(
      report.totalRequests,
      report.hitCount,
      JSON.stringify(report.blockedCustomers),
      JSON.stringify(report.anomalies),
      report.conclusion,
      report.status,
      report.id
    );
  }

  private static saveHitResult(hit: HitResult & { reportId: string; rawRequest: string }): void {
    const stmt = db.prepare(`
      INSERT INTO hit_results (id, reportId, requestId, ruleId, ruleVersion, customerId, customerName, customerTier, hitReason, explanation, wouldBlock, confidence, requestTimestamp, requestPath, rawRequest)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      hit.id,
      hit.reportId,
      hit.requestId,
      hit.ruleId,
      hit.ruleVersion,
      hit.customerId,
      hit.customerName,
      hit.customerTier,
      hit.hitReason,
      hit.explanation,
      hit.wouldBlock ? 1 : 0,
      hit.confidence,
      hit.requestTimestamp,
      hit.requestPath,
      hit.rawRequest
    );
  }

  private static saveAnomaly(anomaly: Anomaly): void {
    const stmt = db.prepare(`
      INSERT INTO anomalies (id, type, severity, message, affectedEntities, recommendation, resolved, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      anomaly.id,
      anomaly.type,
      anomaly.severity,
      anomaly.message,
      JSON.stringify(anomaly.affectedEntities),
      anomaly.recommendation,
      0,
      anomaly.createdAt
    );
  }

  static getDrillResult(id: string): DrillReport | null {
    const stmt = db.prepare(`
      SELECT id, name, ruleId, ruleName, ruleVersion, startTime, endTime, sampleRate, totalRequests, hitCount, blockedCustomers, anomalies, conclusion, status, createdAt
      FROM drill_reports
      WHERE id = ?
    `);

    const row = stmt.get(id) as {
      id: string;
      name: string;
      ruleId: string;
      ruleName: string;
      ruleVersion: number;
      startTime: string;
      endTime: string;
      sampleRate: number;
      totalRequests: number;
      hitCount: number;
      blockedCustomers: string;
      anomalies: string;
      conclusion: string;
      status: string;
      createdAt: string;
    } | undefined;

    if (!row) return null;

    const hitsStmt = db.prepare(`
      SELECT id, requestId, ruleId, ruleVersion, customerId, customerName, customerTier, hitReason, explanation, wouldBlock, confidence, requestTimestamp, requestPath
      FROM hit_results
      WHERE reportId = ?
      ORDER BY requestTimestamp DESC
    `);

    const hitRows = hitsStmt.all(id) as Array<{
      id: string;
      requestId: string;
      ruleId: string;
      ruleVersion: number;
      customerId: string;
      customerName: string;
      customerTier: string;
      hitReason: string;
      explanation: string;
      wouldBlock: number;
      confidence: number;
      requestTimestamp: string;
      requestPath: string;
    }>;

    const hitResults: HitResult[] = hitRows.map(row => ({
      ...row,
      customerTier: row.customerTier as Tier,
      hitReason: row.hitReason as HitReason,
      wouldBlock: row.wouldBlock === 1
    }));

    return {
      ...row,
      blockedCustomers: JSON.parse(row.blockedCustomers),
      anomalies: JSON.parse(row.anomalies),
      status: row.status as DrillReport['status'],
      hitResults
    };
  }

  static getHitAnalysis(params: HitAnalysisParams): HitAnalysisResult {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    let countSql = `
      SELECT COUNT(*) as total
      FROM hit_results h
      WHERE 1=1
    `;

    let querySql = `
      SELECT h.id, h.requestId, h.ruleId, h.ruleVersion, h.customerId, h.customerName, h.customerTier, h.hitReason, h.explanation, h.wouldBlock, h.confidence, h.requestTimestamp, h.requestPath
      FROM hit_results h
      WHERE 1=1
    `;

    const countParams: (string | number)[] = [];
    const queryParams: (string | number)[] = [];

    if (params.reportId) {
      countSql += ' AND h.reportId = ?';
      querySql += ' AND h.reportId = ?';
      countParams.push(params.reportId);
      queryParams.push(params.reportId);
    }

    if (params.ruleId) {
      countSql += ' AND h.ruleId = ?';
      querySql += ' AND h.ruleId = ?';
      countParams.push(params.ruleId);
      queryParams.push(params.ruleId);
    }

    if (params.customerId) {
      countSql += ' AND h.customerId = ?';
      querySql += ' AND h.customerId = ?';
      countParams.push(params.customerId);
      queryParams.push(params.customerId);
    }

    if (params.startTime) {
      countSql += ' AND h.requestTimestamp >= ?';
      querySql += ' AND h.requestTimestamp >= ?';
      countParams.push(params.startTime);
      queryParams.push(params.startTime);
    }

    if (params.endTime) {
      countSql += ' AND h.requestTimestamp <= ?';
      querySql += ' AND h.requestTimestamp <= ?';
      countParams.push(params.endTime);
      queryParams.push(params.endTime);
    }

    querySql += ' ORDER BY h.requestTimestamp DESC LIMIT ? OFFSET ?';
    queryParams.push(pageSize, offset);

    const countStmt = db.prepare(countSql);
    const countRow = countStmt.get(...countParams) as { total: number };

    const queryStmt = db.prepare(querySql);
    const rows = queryStmt.all(...queryParams) as Array<{
      id: string;
      requestId: string;
      ruleId: string;
      ruleVersion: number;
      customerId: string;
      customerName: string;
      customerTier: string;
      hitReason: string;
      explanation: string;
      wouldBlock: number;
      confidence: number;
      requestTimestamp: string;
      requestPath: string;
    }>;

    const items: HitResult[] = rows.map(row => ({
      ...row,
      customerTier: row.customerTier as Tier,
      hitReason: row.hitReason as HitReason,
      wouldBlock: row.wouldBlock === 1
    }));

    const summarySql = `
      SELECT hitReason, customerTier, wouldBlock, COUNT(*) as count
      FROM hit_results h
      WHERE 1=1
      ${params.reportId ? 'AND h.reportId = ?' : ''}
      ${params.ruleId ? 'AND h.ruleId = ?' : ''}
      ${params.customerId ? 'AND h.customerId = ?' : ''}
      ${params.startTime ? 'AND h.requestTimestamp >= ?' : ''}
      ${params.endTime ? 'AND h.requestTimestamp <= ?' : ''}
      GROUP BY hitReason, customerTier, wouldBlock
    `;

    const summaryParams = [
      params.reportId,
      params.ruleId,
      params.customerId,
      params.startTime,
      params.endTime
    ].filter(Boolean) as string[];

    const summaryStmt = db.prepare(summarySql);
    const summaryRows = summaryStmt.all(...summaryParams) as Array<{
      hitReason: string;
      customerTier: string;
      wouldBlock: number;
      count: number;
    }>;

    const byReason: Record<HitReason, number> = {
      threshold_exceeded: 0,
      whitelist_expired: 0,
      window_overlap: 0,
      false_positive: 0
    };

    const byTier: Record<Tier, number> = {
      S: 0,
      A: 0,
      B: 0,
      C: 0
    };

    let wouldBlockCount = 0;

    for (const row of summaryRows) {
      if (row.hitReason in byReason) {
        byReason[row.hitReason as HitReason] += row.count;
      }
      if (row.customerTier in byTier) {
        byTier[row.customerTier as Tier] += row.count;
      }
      if (row.wouldBlock === 1) {
        wouldBlockCount += row.count;
      }
    }

    return {
      total: countRow.total,
      items,
      summary: {
        byReason,
        byTier,
        wouldBlockCount
      }
    };
  }
}

export default ShadowService;
