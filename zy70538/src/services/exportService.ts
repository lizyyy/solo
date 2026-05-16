import { createObjectCsvWriter } from 'csv-writer';
import { CacheExplanation, CacheExplanationStatus } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export class ExportService {
  private exportDir: string;

  constructor() {
    this.exportDir = path.join(process.cwd(), 'exports');
    this.ensureExportDir();
  }

  private ensureExportDir(): void {
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
  }

  exportToCSV(explanations: CacheExplanation[]): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `cache-explanations-${timestamp}.csv`;
    const filePath = path.join(this.exportDir, filename);

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'id', title: 'ID' },
        { id: 'apiPath', title: 'API路径' },
        { id: 'cacheKey', title: '缓存键' },
        { id: 'ruleId', title: '规则ID' },
        { id: 'ruleName', title: '规则名称' },
        { id: 'status', title: '状态' },
        { id: 'generatedAt', title: '生成时间' },
        { id: 'expiresAt', title: '失效时间' },
        { id: 'ttlSeconds', title: 'TTL(秒)' },
        { id: 'hitCount', title: '命中次数' },
        { id: 'reportSummary', title: '报告摘要' },
        { id: 'hasFailure', title: '是否失败' },
        { id: 'createdBy', title: '创建人' }
      ]
    });

    const records = explanations.map(exp => ({
      id: exp.id,
      apiPath: exp.apiPath,
      cacheKey: exp.cacheKey,
      ruleId: exp.matchedRule.id,
      ruleName: exp.matchedRule.name,
      status: this.getStatusDisplayName(exp.status),
      generatedAt: exp.generatedAt.toISOString(),
      expiresAt: exp.expiration.expiresAt.toISOString(),
      ttlSeconds: exp.expiration.ttlSeconds,
      hitCount: exp.hitHistory.length,
      reportSummary: exp.explanationReport.summary,
      hasFailure: exp.failureDetails ? '是' : '否',
      createdBy: exp.metadata.createdBy || '-'
    }));

    csvWriter.writeRecords(records);
    return filePath;
  }

  exportToJSON(explanations: CacheExplanation[]): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `cache-explanations-${timestamp}.json`;
    const filePath = path.join(this.exportDir, filename);

    fs.writeFileSync(filePath, JSON.stringify(explanations, null, 2), 'utf8');
    return filePath;
  }

  private getStatusDisplayName(status: CacheExplanationStatus): string {
    const statusMap: Record<CacheExplanationStatus, string> = {
      [CacheExplanationStatus.PENDING]: '待处理',
      [CacheExplanationStatus.CONFIRMED]: '已确认',
      [CacheExplanationStatus.BLOCKED]: '被拦截',
      [CacheExplanationStatus.REVOKED]: '已撤销',
      [CacheExplanationStatus.COMPENSATED]: '已补偿'
    };
    return statusMap[status] || status;
  }

  generateDetailedReport(explanation: CacheExplanation): Record<string, unknown> {
    return {
      id: explanation.id,
      basicInfo: {
        apiPath: explanation.apiPath,
        cacheKey: explanation.cacheKey,
        status: this.getStatusDisplayName(explanation.status),
        generatedAt: explanation.generatedAt,
        ageInSeconds: Math.floor((Date.now() - explanation.generatedAt.getTime()) / 1000)
      },
      cacheKeyAnalysis: {
        algorithm: explanation.cacheKeyCalculation.algorithm,
        factors: explanation.cacheKeyCalculation.factors,
        rawValue: explanation.cacheKeyCalculation.rawValue
      },
      matchedRule: {
        id: explanation.matchedRule.id,
        name: explanation.matchedRule.name,
        description: explanation.matchedRule.description,
        ttl: explanation.matchedRule.ttl,
        priority: explanation.matchedRule.priority,
        conditions: explanation.matchedRule.conditions
      },
      expirationInfo: {
        expiresAt: explanation.expiration.expiresAt,
        ttlSeconds: explanation.expiration.ttlSeconds,
        remainingSeconds: Math.max(0, Math.floor(
          (explanation.expiration.expiresAt.getTime() - Date.now()) / 1000
        )),
        conditions: explanation.expiration.conditions
      },
      hitStatistics: {
        totalHits: explanation.hitHistory.length,
        firstHitAt: explanation.hitHistory[0]?.hitAt || null,
        lastHitAt: explanation.hitHistory[explanation.hitHistory.length - 1]?.hitAt || null
      },
      explanationReport: explanation.explanationReport,
      failureDetails: explanation.failureDetails || null,
      metadata: explanation.metadata
    };
  }
}

export const exportService = new ExportService();
