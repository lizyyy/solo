const moment = require('moment');

class ReportGenerator {
  generateJSON(experiment) {
    const summary = experiment.getSummary();
    const details = experiment.getFullDetails();
    
    return {
      generatedAt: moment().toISOString(),
      experiment: {
        id: summary.id,
        name: summary.name,
        description: summary.description,
        status: summary.status,
        config: summary.config
      },
      simulation: details.simulationResults ? {
        completedAt: details.simulationResults.completedAt,
        stepCount: details.simulationResults.stepResults.length,
        stats: details.simulationResults.finalStats.stats,
        risks: {
          consistency: details.simulationResults.risks.consistency,
          penetration: details.simulationResults.risks.penetration,
          breakdown: details.simulationResults.risks.breakdown,
          avalanche: details.simulationResults.risks.avalanche
        }
      } : null,
      rawEvents: details.simulationResults?.events || []
    };
  }

  generateMarkdown(experiment) {
    const summary = experiment.getSummary();
    const details = experiment.getFullDetails();
    const results = details.simulationResults;
    
    let md = `# 缓存链路实验报告\n\n`;
    md += `## 实验基本信息\n\n`;
    md += `- **实验名称**: ${summary.name}\n`;
    md += `- **实验ID**: ${summary.id}\n`;
    md += `- **实验状态**: ${summary.status}\n`;
    md += `- **创建时间**: ${summary.createdAt}\n`;
    md += `- **流量步骤数**: ${summary.trafficPlanCount}\n\n`;
    
    if (summary.description) {
      md += `## 实验描述\n\n${summary.description}\n\n`;
    }
    
    md += `## 配置参数\n\n`;
    md += `### 缓存层配置\n\n`;
    md += `- **L1缓存**: 容量 ${summary.config.l1Capacity} 项, TTL ${summary.config.l1Ttl} 秒, 抖动 ${summary.config.l1TtlJitter} 秒\n`;
    md += `- **L2缓存**: 容量 ${summary.config.l2Capacity} 项, TTL ${summary.config.l2Ttl} 秒, 抖动 ${summary.config.l2TtlJitter} 秒\n`;
    md += `- **数据库**: 查询延迟 ${summary.config.dbQueryLatencyMs} ms\n\n`;
    
    md += `### 缓存策略\n\n`;
    md += `- **读取策略**: ${summary.config.strategy}\n`;
    md += `- **写入策略**: ${summary.config.writeStrategy}\n`;
    md += `- **延迟双删**: ${summary.config.delayDoubleDelete ? '启用 (' + summary.config.delayDeleteMs + 'ms)' : '禁用'}\n`;
    md += `- **互斥锁**: ${summary.config.useMutex ? '启用 (' + summary.config.mutexTimeoutMs + 'ms 超时)' : '禁用'}\n`;
    md += `- **布隆过滤器**: ${summary.config.useBloomFilter ? '启用' : '禁用'}\n`;
    md += `- **预热**: ${summary.config.enablePreheating ? '启用 (' + summary.config.preheatKeys.length + ' 个key)' : '禁用'}\n\n`;
    
    if (results) {
      md += `## 模拟结果\n\n`;
      md += `### 性能指标\n\n`;
      md += `- **总请求数**: ${results.finalStats.stats.totalRequests}\n`;
      md += `- **读取请求**: ${results.finalStats.stats.totalReads}\n`;
      md += `- **写入请求**: ${results.finalStats.stats.totalWrites}\n`;
      md += `- **删除请求**: ${results.finalStats.stats.totalDeletes}\n\n`;
      
      md += `### 命中率分析\n\n`;
      md += `- **总缓存命中**: ${results.finalStats.stats.cacheHits}\n`;
      md += `- **总缓存未命中**: ${results.finalStats.stats.cacheMisses}\n`;
      md += `- **命中率**: ${(results.finalStats.stats.hitRate * 100).toFixed(2)}%\n`;
      md += `- **未命中率**: ${(results.finalStats.stats.missRate * 100).toFixed(2)}%\n\n`;
      
      md += `### 数据源分布\n\n`;
      md += `- **L1缓存命中**: ${results.finalStats.stats.sourceRatio.l1} 次\n`;
      md += `- **L2缓存命中**: ${results.finalStats.stats.sourceRatio.l2} 次\n`;
      md += `- **数据库回源**: ${results.finalStats.stats.dbReads} 次\n`;
      md += `- **数据库写入**: ${results.finalStats.stats.dbWrites} 次\n\n`;
      
      md += `### 风险分析\n\n`;
      
      md += `#### 一致性风险\n\n`;
      md += `- **一致性窗口数量**: ${results.risks.consistency.count}\n`;
      if (results.risks.consistency.windows.length > 0) {
        md += `\n**不一致详情**:\n`;
        results.risks.consistency.windows.forEach((w, i) => {
          md += `${i + 1}. Key \`${w.key}\` - ${w.l1Inconsistent ? 'L1不一致' : ''}${w.l2Inconsistent ? ' L2不一致' : ''}\n`;
          md += `   - L1值: ${JSON.stringify(w.l1Value)}\n`;
          md += `   - L2值: ${JSON.stringify(w.l2Value)}\n`;
          md += `   - DB值: ${JSON.stringify(w.dbValue)}\n\n`;
        });
      }
      
      md += `#### 缓存穿透风险\n\n`;
      md += `- **穿透事件数量**: ${results.risks.penetration.count}\n`;
      if (Object.keys(results.risks.penetration.byReason).length > 0) {
        md += `\n**按原因分布**:\n`;
        Object.entries(results.risks.penetration.byReason).forEach(([reason, count]) => {
          md += `- ${reason}: ${count} 次\n`;
        });
        md += `\n`;
      }
      
      md += `#### 缓存击穿风险\n\n`;
      md += `- **击穿事件数量**: ${results.risks.breakdown.count}\n\n`;
      
      md += `#### 缓存雪崩风险\n\n`;
      md += `- **雪崩事件数量**: ${results.risks.avalanche.count}\n`;
      if (results.risks.avalanche.highRiskBuckets.length > 0) {
        md += `\n**高风险TTL时间桶**:\n`;
        results.risks.avalanche.highRiskBuckets.forEach((bucket, i) => {
          md += `${i + 1}. 时间戳 ${bucket.bucket} - ${bucket.keys} 个key同时过期\n`;
        });
        md += `\n`;
      }
      
      md += `## 结论与建议\n\n`;
      
      const issues = [];
      if (results.risks.consistency.count > 0) {
        issues.push('- 存在缓存一致性问题，建议检查缓存更新策略');
      }
      if (results.risks.penetration.count > 0) {
        issues.push('- 存在缓存穿透风险，建议启用布隆过滤器或空值缓存');
      }
      if (results.risks.breakdown.count > 0) {
        issues.push('- 存在缓存击穿风险，建议启用互斥锁或永不过期策略');
      }
      if (results.risks.avalanche.count > 0) {
        issues.push('- 存在缓存雪崩风险，建议增加TTL抖动或分层过期');
      }
      
      if (issues.length > 0) {
        md += `**发现的问题**:\n${issues.join('\n')}\n\n`;
      } else {
        md += `本次实验未发现明显的缓存问题。\n\n`;
      }
      
      md += `---\n\n`;
      md += `报告生成时间: ${moment().format('YYYY-MM-DD HH:mm:ss')}\n`;
    } else {
      md += `## 模拟结果\n\n`;
      md += `实验尚未运行，暂无模拟结果。\n\n`;
    }
    
    return md;
  }
}

module.exports = new ReportGenerator();
