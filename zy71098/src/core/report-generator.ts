import {
  BounceRecord,
  BounceCategory,
  AnalysisReport,
  BatchAggregation
} from '../types';

export class ReportGenerator {
  generateReport(records: BounceRecord[]): AnalysisReport {
    const batches = this.aggregateByBatch(records);
    const overallBreakdown = this.calculateOverallBreakdown(records);
    const uniqueRecipients = new Set(records.map(r => r.recipient)).size;

    return {
      generatedAt: Date.now(),
      totalRecords: records.length,
      uniqueRecipients,
      batches,
      overallBreakdown,
      topReasons: this.getTopReasons(records),
      summary: this.calculateSummary(records),
      recommendations: this.generateRecommendations(records, batches)
    };
  }

  private aggregateByBatch(records: BounceRecord[]): Record<string, BatchAggregation> {
    const batchMap = new Map<string, BounceRecord[]>();
    
    for (const record of records) {
      const batchId = record.batchId || 'unknown';
      if (!batchMap.has(batchId)) {
        batchMap.set(batchId, []);
      }
      batchMap.get(batchId)!.push(record);
    }

    const result: Record<string, BatchAggregation> = {};
    for (const [batchId, batchRecords] of batchMap) {
      result[batchId] = this.analyzeBatch(batchId, batchRecords);
    }
    return result;
  }

  private analyzeBatch(batchId: string, records: BounceRecord[]): BatchAggregation {
    const categoryBreakdown = this.initCategoryBreakdown();
    const providerBreakdown: Record<string, number> = {};
    const recipientMap = new Map<string, BounceRecord[]>();
    let retryEligibleCount = 0;

    for (const record of records) {
      categoryBreakdown[record.category]++;
      
      const provider = record.provider || 'unknown';
      providerBreakdown[provider] = (providerBreakdown[provider] || 0) + 1;
      
      if (!recipientMap.has(record.recipient)) {
        recipientMap.set(record.recipient, []);
      }
      recipientMap.get(record.recipient)!.push(record);

      if (record.retrySuggestion.shouldRetry) {
        retryEligibleCount++;
      }
    }

    const repeatedBounces = Array.from(recipientMap.entries())
      .filter(([_, rs]) => rs.length > 1)
      .map(([recipient, rs]) => ({
        recipient,
        count: rs.length,
        firstBounce: Math.min(...rs.map(r => r.timestamp)),
        lastBounce: Math.max(...rs.map(r => r.timestamp)),
        categories: [...new Set(rs.map(r => r.category))]
      }))
      .sort((a, b) => b.count - a.count);

    return {
      batchId,
      totalBounces: records.length,
      categoryBreakdown,
      uniqueRecipients: recipientMap.size,
      repeatedBounces,
      providerBreakdown,
      retryEligibleCount
    };
  }

  private initCategoryBreakdown(): Record<BounceCategory, number> {
    return {
      [BounceCategory.MAILBOX_NOT_EXIST]: 0,
      [BounceCategory.POLICY_REJECTION]: 0,
      [BounceCategory.CONTENT_BLOCKED]: 0,
      [BounceCategory.TEMPORARY_FAILURE]: 0,
      [BounceCategory.UNKNOWN]: 0
    };
  }

  private calculateOverallBreakdown(records: BounceRecord[]): Record<BounceCategory, number> {
    const breakdown = this.initCategoryBreakdown();
    for (const record of records) {
      breakdown[record.category]++;
    }
    return breakdown;
  }

  private getTopReasons(records: BounceRecord[]): Array<{ reason: string; count: number; category: BounceCategory }> {
    const reasonMap = new Map<string, { count: number; category: BounceCategory }>();
    
    for (const record of records) {
      const key = record.reason;
      if (!reasonMap.has(key)) {
        reasonMap.set(key, { count: 0, category: record.category });
      }
      reasonMap.get(key)!.count++;
    }

    return Array.from(reasonMap.entries())
      .map(([reason, data]) => ({ reason, count: data.count, category: data.category }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private calculateSummary(records: BounceRecord[]): AnalysisReport['summary'] {
    const total = records.length;
    if (total === 0) {
      return {
        hardBounceRate: 0,
        policyRejectionRate: 0,
        contentBlockRate: 0,
        temporaryFailureRate: 0
      };
    }

    const countCategory = (cat: BounceCategory) => 
      records.filter(r => r.category === cat).length;

    return {
      hardBounceRate: countCategory(BounceCategory.MAILBOX_NOT_EXIST) / total,
      policyRejectionRate: countCategory(BounceCategory.POLICY_REJECTION) / total,
      contentBlockRate: countCategory(BounceCategory.CONTENT_BLOCKED) / total,
      temporaryFailureRate: countCategory(BounceCategory.TEMPORARY_FAILURE) / total
    };
  }

  private generateRecommendations(
    records: BounceRecord[],
    batches: Record<string, BatchAggregation>
  ): string[] {
    const recommendations: string[] = [];
    const total = records.length;
    
    const summary = this.calculateSummary(records);

    if (summary.hardBounceRate > 0.3) {
      recommendations.push(`⚠️  高硬退信率 (${(summary.hardBounceRate * 100).toFixed(1)}%)，建议清洗邮件列表，验证邮箱有效性`);
    }

    if (summary.policyRejectionRate > 0.2) {
      recommendations.push(`⚠️  高策略拒收率 (${(summary.policyRejectionRate * 100).toFixed(1)}%)，请检查：1) SPF/DKIM/DMARC配置 2) 发件IP信誉 3) 发送频率`);
    }

    if (summary.contentBlockRate > 0.15) {
      recommendations.push(`⚠️  高内容拦截率 (${(summary.contentBlockRate * 100).toFixed(1)}%)，建议优化邮件内容，避免触发垃圾邮件规则`);
    }

    const repeatedBouncesTotal = Object.values(batches).reduce(
      (sum, b) => sum + b.repeatedBounces.length, 0
    );
    if (repeatedBouncesTotal > 0) {
      recommendations.push(`📋 发现 ${repeatedBouncesTotal} 个邮箱多次退信，建议加入抑制列表避免继续发送`);
    }

    const retryRecords = records.filter(r => r.retrySuggestion.shouldRetry);
    if (retryRecords.length > 0) {
      recommendations.push(`🔄 ${retryRecords.length} 封退信可重试，请参考各条目的重试建议时间`);
    }

    const providerStats = this.getProviderStats(records);
    const problematicProviders = Object.entries(providerStats)
      .filter(([_, data]) => data.rate > 0.5)
      .map(([provider]) => provider);
    
    if (problematicProviders.length > 0) {
      recommendations.push(`🏢 以下供应商退信率超过50%：${problematicProviders.join('、')}，建议针对性检查配置`);
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ 退信情况在正常范围内，继续保持监控');
    }

    return recommendations;
  }

  private getProviderStats(records: BounceRecord[]): Record<string, { total: number; rate: number }> {
    const providerMap = new Map<string, { total: number; bounces: number }>();
    
    for (const record of records) {
      const provider = record.provider || 'unknown';
      if (!providerMap.has(provider)) {
        providerMap.set(provider, { total: 0, bounces: 0 });
      }
      providerMap.get(provider)!.total++;
      providerMap.get(provider)!.bounces++;
    }

    const result: Record<string, { total: number; rate: number }> = {};
    for (const [provider, data] of providerMap) {
      result[provider] = {
        total: data.total,
        rate: data.bounces / data.total
      };
    }
    return result;
  }
}
