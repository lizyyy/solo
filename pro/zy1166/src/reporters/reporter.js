const fs = require('fs');
const path = require('path');
const { Parser } = require('json2csv');

class Reporter {
  constructor(analysisData, outputDir) {
    this.data = analysisData;
    this.outputDir = outputDir;
    this.generatedFiles = [];
  }

  async export(format) {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    const formats = format === 'all' 
      ? ['markdown', 'json', 'csv'] 
      : [format.toLowerCase()];

    for (const fmt of formats) {
      switch (fmt) {
        case 'markdown':
          await this.exportMarkdown();
          break;
        case 'json':
          await this.exportJSON();
          break;
        case 'csv':
          await this.exportCSV();
          break;
      }
    }

    return this.generatedFiles;
  }

  async exportMarkdown() {
    const content = this.generateMarkdown();
    const filePath = path.join(this.outputDir, 'memory-analysis-report.md');
    fs.writeFileSync(filePath, content, 'utf-8');
    this.generatedFiles.push(filePath);
  }

  async exportJSON() {
    const content = this.generateJSON();
    const filePath = path.join(this.outputDir, 'memory-analysis-report.json');
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf-8');
    this.generatedFiles.push(filePath);
  }

  async exportCSV() {
    const files = this.generateCSVFiles();
    for (const [filename, data] of Object.entries(files)) {
      const filePath = path.join(this.outputDir, filename);
      if (Array.isArray(data) && data.length > 0) {
        try {
          const parser = new Parser();
          const csv = parser.parse(data);
          fs.writeFileSync(filePath, csv, 'utf-8');
          this.generatedFiles.push(filePath);
        } catch (e) {
          console.error(`Failed to generate CSV for ${filename}:`, e.message);
        }
      }
    }
  }

  generateMarkdown() {
    const lines = [];

    lines.push('# Node.js 内存分析报告');
    lines.push('');
    lines.push(`**分析时间**: ${new Date(this.data.meta.analysisTime).toLocaleString()}`);
    lines.push(`**工具版本**: ${this.data.meta.toolVersion}`);
    lines.push('');

    lines.push('## 执行摘要');
    lines.push('');
    
    const criticalIssues = this.data.issues.filter(i => i.severity === 'critical');
    const warningIssues = this.data.issues.filter(i => i.severity === 'warning');
    const infoIssues = this.data.issues.filter(i => i.severity === 'info');

    lines.push('| 指标 | 数值 |');
    lines.push('|------|------|');
    lines.push(`| **严重问题** | ${criticalIssues.length} 个 |`);
    lines.push(`| **警告问题** | ${warningIssues.length} 个 |`);
    lines.push(`| **提示信息** | ${infoIssues.length} 个 |`);
    lines.push(`| **优化建议** | ${this.data.recommendations.length} 条 |`);
    lines.push('');

    if (criticalIssues.length > 0) {
      lines.push('### 🔴 关键问题');
      lines.push('');
      lines.push('<span style="color:red">**注意：发现严重内存问题，需要立即关注！**</span>');
      lines.push('');
      
      for (const issue of criticalIssues) {
        lines.push(`#### ${issue.title}`);
        lines.push('');
        lines.push(`**描述**: ${issue.description}`);
        lines.push('');
        if (issue.details) {
          lines.push('**详情**:');
          lines.push('```json');
          lines.push(JSON.stringify(issue.details, null, 2));
          lines.push('```');
          lines.push('');
        }
        if (issue.suggestion) {
          lines.push(`**建议**: ${issue.suggestion}`);
          lines.push('');
        }
      }
    }

    if (warningIssues.length > 0) {
      lines.push('### 🟡 警告问题');
      lines.push('');
      
      for (const issue of warningIssues) {
        lines.push(`#### ${issue.title}`);
        lines.push('');
        lines.push(`**描述**: ${issue.description}`);
        lines.push('');
        if (issue.suggestion) {
          lines.push(`**建议**: ${issue.suggestion}`);
          lines.push('');
        }
      }
    }

    lines.push('## GC 日志分析');
    lines.push('');

    if (this.data.gcLog) {
      const gcStats = this.data.gcLog.stats;
      const gcSummary = this.data.gcLog.summary;

      lines.push('### 事件统计');
      lines.push('');
      lines.push('| 指标 | 数值 |');
      lines.push('|------|------|');
      lines.push(`| 总 GC 次数 | ${gcSummary.totalGCEvents} |`);
      lines.push(`| Scavenge 次数 | ${gcSummary.scavengeEvents} |`);
      lines.push(`| Mark-Sweep 次数 | ${gcSummary.marksweepEvents} |`);
      lines.push(`| 总 GC 耗时 | ${gcSummary.totalGCTime} |`);
      lines.push(`| 平均 GC 耗时 | ${gcSummary.avgGCTime} |`);
      lines.push(`| 最大 GC 耗时 | ${gcSummary.maxGCTime} |`);
      lines.push('');

      lines.push('### 内存变化');
      lines.push('');
      lines.push('| 指标 | 数值 |');
      lines.push('|------|------|');
      lines.push(`| 老年代增长 | ${gcSummary.oldSpaceGrowth || 'N/A'} |`);
      lines.push(`| 总晋升量 | ${gcSummary.totalPromoted || 'N/A'} |`);
      lines.push(`| 平均存活率 | ${gcSummary.avgSurvivalRate || 'N/A'} |`);
      lines.push(`| 总回收量 | ${gcSummary.totalReclaimed || 'N/A'} |`);
      lines.push(`| 最后一次 Major GC 回收率 | ${gcSummary.lastMajorGCReclamationRate || 'N/A'} |`);
      lines.push('');

      if (gcStats.lastMajorGCReclamationRate !== undefined && gcStats.lastMajorGCReclamationRate < 30) {
        lines.push('> ⚠️ **警告**: 最后一次 Major GC 回收率低于 30%，这是内存泄漏的典型特征！');
        lines.push('');
      }
    } else {
      lines.push('*未提供 GC 日志数据*');
      lines.push('');
    }

    lines.push('## Heap 快照分析');
    lines.push('');

    if (this.data.heapSummary) {
      const heap = this.data.heapSummary;

      lines.push('### 内存使用概览');
      lines.push('');
      
      if (heap.summary) {
        const summary = heap.summary;
        lines.push('| 指标 | 数值 |');
        lines.push('|------|------|');
        if (summary.totalHeapSize) lines.push(`| 总堆大小 | ${(summary.totalHeapSize / (1024 * 1024)).toFixed(2)} MB |`);
        if (summary.usedHeapSize) lines.push(`| 已使用堆大小 | ${(summary.usedHeapSize / (1024 * 1024)).toFixed(2)} MB |`);
        if (summary.heapSizeLimit) lines.push(`| 堆大小限制 | ${(summary.heapSizeLimit / (1024 * 1024)).toFixed(2)} MB |`);
        lines.push('');
      }

      if (heap.topTypes && heap.topTypes.length > 0) {
        lines.push('### 主要对象类型');
        lines.push('');
        lines.push('| 类型 | 数量 | 总大小 | 平均大小 |');
        lines.push('|------|------|--------|----------|');
        for (const type of heap.topTypes.slice(0, 10)) {
          lines.push(`| ${type.type} | ${type.count} | ${(type.totalSize / 1024).toFixed(2)} KB | ${type.avgSize} B |`);
        }
        lines.push('');
      }

      if (heap.bufferAnalysis) {
        const buffer = heap.bufferAnalysis;
        lines.push('### Buffer 分析');
        lines.push('');
        lines.push('| 指标 | 数值 |');
        lines.push('|------|------|');
        lines.push(`| Buffer 总数 | ${buffer.totalBuffers} |`);
        lines.push(`| 总大小 | ${(buffer.totalBufferSize / (1024 * 1024)).toFixed(2)} MB |`);
        lines.push(`| 平均大小 | ${(buffer.avgBufferSize / 1024).toFixed(2)} KB |`);
        lines.push(`| 最大 Buffer | ${(buffer.largestBuffer / (1024 * 1024)).toFixed(2)} MB |`);
        lines.push('');
      }

      if (heap.nativeMemory && heap.nativeMemory.totalExternal > 0) {
        lines.push('### 原生内存分析');
        lines.push('');
        lines.push(`| 外部内存总计 | ${(heap.nativeMemory.totalExternal / (1024 * 1024)).toFixed(2)} MB |`);
        lines.push('');
      }
    } else {
      lines.push('*未提供 Heap 摘要数据*');
      lines.push('');
    }

    lines.push('## 引用链分析');
    lines.push('');

    if (this.data.retainerPaths) {
      const retainer = this.data.retainerPaths;
      
      lines.push('### 统计信息');
      lines.push('');
      lines.push('| 指标 | 数值 |');
      lines.push('|------|------|');
      lines.push(`| 总引用链数 | ${retainer.statistics.totalPaths} |`);
      lines.push(`| 可疑路径数 | ${retainer.statistics.suspiciousPaths} |`);
      lines.push(`| 严重路径数 | ${retainer.statistics.criticalPaths} |`);
      lines.push(`| 警告路径数 | ${retainer.statistics.warningPaths} |`);
      lines.push('');

      if (retainer.keyRoots && retainer.keyRoots.length > 0) {
        lines.push('### 主要根对象');
        lines.push('');
        lines.push('| 根类型 | 引用数 |');
        lines.push('|--------|--------|');
        for (const root of retainer.keyRoots.slice(0, 10)) {
          lines.push(`| ${root.type} | ${root.count} |`);
        }
        lines.push('');
      }
    } else {
      lines.push('*未提供 Retainer 路径数据*');
      lines.push('');
    }

    lines.push('## 接口流量分析');
    lines.push('');

    if (this.data.endpointTraffic) {
      const traffic = this.data.endpointTraffic;
      const summary = traffic.summary;

      lines.push('### 性能概览');
      lines.push('');
      lines.push('| 指标 | 数值 |');
      lines.push('|------|------|');
      lines.push(`| 总请求数 | ${summary.overview.totalRequests} |`);
      lines.push(`| 平均吞吐量 | ${summary.overview.avgThroughput} |`);
      lines.push(`| 平均延迟 | ${summary.overview.avgLatency} |`);
      lines.push(`| 错误率 | ${summary.overview.errorRate} |`);
      lines.push('');

      if (summary.endpoints && summary.endpoints.length > 0) {
        lines.push('### 热门接口');
        lines.push('');
        lines.push('| 接口 | 请求数 | 平均延迟 |');
        lines.push('|------|--------|----------|');
        for (const ep of summary.endpoints.slice(0, 10)) {
          lines.push(`| ${ep.endpoint} | ${ep.requestCount} | ${ep.avgLatency} |`);
        }
        lines.push('');
      }

      if (traffic.memoryTrends && traffic.memoryTrends.hasMemoryData) {
        lines.push('### 内存趋势');
        lines.push('');
        lines.push('| 指标 | 数值 |');
        lines.push('|------|------|');
        lines.push(`| 趋势 | ${traffic.memoryTrends.trend} |`);
        lines.push(`| 总内存增长 | ${(traffic.memoryTrends.totalMemoryIncrease / (1024 * 1024)).toFixed(2)} MB |`);
        lines.push(`| 平均每次请求内存变化 | ${(traffic.memoryTrends.avgMemoryPerRequest / 1024).toFixed(2)} KB |`);
        lines.push('');

        if (traffic.memoryTrends.leakIndicators && traffic.memoryTrends.leakIndicators.length > 0) {
          lines.push('### 内存泄漏指示器');
          lines.push('');
          for (const indicator of traffic.memoryTrends.leakIndicators) {
            lines.push(`- **${indicator.type}**: ${indicator.description}`);
          }
          lines.push('');
        }
      }
    } else {
      lines.push('*未提供接口流量数据*');
      lines.push('');
    }

    lines.push('## 配置分析');
    lines.push('');

    if (this.data.config) {
      const config = this.data.config;
      const summary = config.summary;

      lines.push('### 配置概览');
      lines.push('');
      lines.push('| 配置项 | 数量 |');
      lines.push('|--------|------|');
      lines.push(`| 缓存配置 | ${summary.overview.cacheCount} |`);
      lines.push(`| 对象池配置 | ${summary.overview.objectPoolCount} |`);
      lines.push(`| 批处理配置 | ${summary.overview.batchProcessingCount} |`);
      lines.push(`| WeakRef 配置 | ${summary.overview.weakRefCount} |`);
      lines.push(`| FinalizationRegistry 配置 | ${summary.overview.finalizationRegistryCount} |`);
      lines.push('');

      if (summary.v8Config && Object.keys(summary.v8Config).length > 0) {
        lines.push('### V8 配置');
        lines.push('');
        lines.push('| 配置项 | 数值 |');
        lines.push('|--------|------|');
        for (const [key, value] of Object.entries(summary.v8Config)) {
          lines.push(`| ${key} | ${value} |`);
        }
        lines.push('');
      }

      if (summary.cacheSummary && summary.cacheSummary.length > 0) {
        lines.push('### 缓存配置详情');
        lines.push('');
        lines.push('| 名称 | 最大容量 | TTL | 当前大小 | 问题数 |');
        lines.push('|------|----------|-----|----------|--------|');
        for (const cache of summary.cacheSummary) {
          lines.push(`| ${cache.name} | ${cache.maxSize} | ${cache.ttl} | ${cache.currentSize} | ${cache.issues} |`);
        }
        lines.push('');
      }

      if (summary.poolSummary && summary.poolSummary.length > 0) {
        lines.push('### 对象池配置详情');
        lines.push('');
        lines.push('| 名称 | 对象类型 | 最大容量 | 当前大小 | 空闲数 | 问题数 |');
        lines.push('|------|----------|----------|----------|--------|--------|');
        for (const pool of summary.poolSummary) {
          lines.push(`| ${pool.name} | ${pool.objectType} | ${pool.maxSize} | ${pool.currentSize} | ${pool.idleCount} | ${pool.issues} |`);
        }
        lines.push('');
      }

      if (config.potentialIssues && config.potentialIssues.length > 0) {
        lines.push('### 配置问题');
        lines.push('');
        for (const issue of config.potentialIssues) {
          const severityEmoji = issue.severity === 'critical' ? '🔴' : '🟡';
          lines.push(`${severityEmoji} **${issue.type}** (${issue.category}): ${issue.message}`);
        }
        lines.push('');
      }
    } else {
      lines.push('*未提供配置数据*');
      lines.push('');
    }

    lines.push('## 模拟分析');
    lines.push('');

    if (this.data.simulations) {
      const sims = this.data.simulations;

      lines.push('### V8 参数模拟');
      lines.push('');
      if (sims.v8Flags && sims.v8Flags.scenarios.length > 0) {
        lines.push('| 场景 | 预计峰值内存 | GC 频率 | 风险等级 |');
        lines.push('|------|--------------|---------|----------|');
        for (const scenario of sims.v8Flags.scenarios) {
          const result = scenario.result;
          const riskEmoji = result.riskLevel === 'low' ? '🟢' : result.riskLevel === 'medium' ? '🟡' : '🔴';
          lines.push(`| ${scenario.label} | ${result.estimatedPeakMemoryMB.toFixed(1)} MB | ${result.gcFrequency.toFixed(2)}/min | ${riskEmoji} ${result.riskLevel} |`);
        }
        lines.push('');

        if (sims.v8Flags.recommendation) {
          lines.push(`**推荐配置**: ${sims.v8Flags.recommendation.label}`);
          lines.push('');
        }
      }

      lines.push('### 缓存 TTL 模拟');
      lines.push('');
      if (sims.cache && sims.cache.scenarios.length > 0) {
        lines.push('| 场景 | 预计峰值内存 | 缓存效率 | 风险等级 |');
        lines.push('|------|--------------|----------|----------|');
        for (const scenario of sims.cache.scenarios) {
          const result = scenario.result;
          const riskEmoji = result.riskLevel === 'low' ? '🟢' : result.riskLevel === 'medium' ? '🟡' : '🔴';
          lines.push(`| ${scenario.label} | ${result.estimatedPeakMemoryMB.toFixed(1)} MB | ${(result.cacheEfficiency * 100).toFixed(1)}% | ${riskEmoji} ${result.riskLevel} |`);
        }
        lines.push('');
      }

      lines.push('### 对象池模拟');
      lines.push('');
      if (sims.objectPool && sims.objectPool.scenarios.length > 0) {
        lines.push('| 场景 | 预计峰值内存 | 对象池效率 | 风险等级 |');
        lines.push('|------|--------------|------------|----------|');
        for (const scenario of sims.objectPool.scenarios) {
          const result = scenario.result;
          const riskEmoji = result.riskLevel === 'low' ? '🟢' : result.riskLevel === 'medium' ? '🟡' : '🔴';
          lines.push(`| ${scenario.label} | ${result.estimatedPeakMemoryMB.toFixed(1)} MB | ${(result.poolEfficiency * 100).toFixed(1)}% | ${riskEmoji} ${result.riskLevel} |`);
        }
        lines.push('');
      }
    } else {
      lines.push('*无模拟分析数据*');
      lines.push('');
    }

    lines.push('## 优化建议');
    lines.push('');

    if (this.data.recommendations && this.data.recommendations.length > 0) {
      for (let i = 0; i < this.data.recommendations.length; i++) {
        const rec = this.data.recommendations[i];
        const priorityEmoji = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
        
        lines.push(`### ${i + 1}. ${rec.title}`);
        lines.push('');
        lines.push(`**优先级**: ${priorityEmoji} ${rec.priority}`);
        lines.push('');
        lines.push(`**描述**: ${rec.description}`);
        lines.push('');
        
        if (rec.suggestedValues) {
          lines.push('**建议配置值**:');
          lines.push('```json');
          lines.push(JSON.stringify(rec.suggestedValues, null, 2));
          lines.push('```');
          lines.push('');
        }

        if (rec.expectedBenefit) {
          lines.push(`**预期收益**: ${rec.expectedBenefit}`);
          lines.push('');
        }

        if (rec.checkList) {
          lines.push('**检查清单**:');
          for (const item of rec.checkList) {
            lines.push(`- [ ] ${item}`);
          }
          lines.push('');
        }

        if (rec.recommendedActions) {
          lines.push('**推荐操作**:');
          for (const action of rec.recommendedActions) {
            lines.push(`- ${action}`);
          }
          lines.push('');
        }
      }
    } else {
      lines.push('*暂无优化建议*');
      lines.push('');
    }

    lines.push('---');
    lines.push('');
    lines.push('*报告由 memory-analyzer-cli 自动生成*');

    return lines.join('\n');
  }

  generateJSON() {
    return {
      meta: this.data.meta,
      summary: {
        criticalIssues: this.data.issues.filter(i => i.severity === 'critical').length,
        warningIssues: this.data.issues.filter(i => i.severity === 'warning').length,
        infoIssues: this.data.issues.filter(i => i.severity === 'info').length,
        recommendationCount: this.data.recommendations.length
      },
      issues: this.data.issues,
      gcLog: this.data.gcLog ? {
        summary: this.data.gcLog.summary,
        stats: this.data.gcLog.stats
      } : null,
      heapSummary: this.data.heapSummary ? {
        summary: this.data.heapSummary.summary,
        topTypes: this.data.heapSummary.topTypes,
        bufferAnalysis: this.data.heapSummary.bufferAnalysis,
        nativeMemory: this.data.heapSummary.nativeMemory,
        stats: this.data.heapSummary.stats
      } : null,
      retainerPaths: this.data.retainerPaths ? {
        statistics: this.data.retainerPaths.statistics,
        keyRoots: this.data.retainerPaths.keyRoots,
        suspiciousPaths: this.data.retainerPaths.suspiciousPaths.slice(0, 20)
      } : null,
      endpointTraffic: this.data.endpointTraffic ? {
        summary: this.data.endpointTraffic.summary,
        memoryTrends: this.data.endpointTraffic.memoryTrends,
        statistics: this.data.endpointTraffic.statistics
      } : null,
      config: this.data.config ? {
        summary: this.data.config.summary,
        potentialIssues: this.data.config.potentialIssues
      } : null,
      simulations: this.data.simulations,
      recommendations: this.data.recommendations
    };
  }

  generateCSVFiles() {
    const files = {};

    if (this.data.issues && this.data.issues.length > 0) {
      files['issues.csv'] = this.data.issues.map(issue => ({
        id: issue.id,
        severity: issue.severity,
        category: issue.category,
        type: issue.type,
        title: issue.title,
        description: issue.description,
        suggestion: issue.suggestion || ''
      }));
    }

    if (this.data.recommendations && this.data.recommendations.length > 0) {
      files['recommendations.csv'] = this.data.recommendations.map((rec, idx) => ({
        order: idx + 1,
        priority: rec.priority,
        title: rec.title,
        description: rec.description,
        expectedBenefit: rec.expectedBenefit || ''
      }));
    }

    if (this.data.gcLog && this.data.gcLog.events) {
      files['gc-events.csv'] = this.data.gcLog.events.slice(0, 1000).map(event => ({
        type: event.type,
        gcType: event.gcType,
        timestamp: event.timestamp,
        beforeSize: event.beforeSize,
        afterSize: event.afterSize,
        totalSize: event.totalSize,
        duration: event.duration
      }));
    }

    if (this.data.simulations) {
      const simRows = [];
      
      if (this.data.simulations.v8Flags) {
        for (const scenario of this.data.simulations.v8Flags.scenarios) {
          simRows.push({
            category: 'V8 Flags',
            scenario: scenario.label,
            estimatedPeakMemoryMB: scenario.result.estimatedPeakMemoryMB.toFixed(2),
            estimatedSteadyStateMemoryMB: scenario.result.estimatedSteadyStateMemoryMB.toFixed(2),
            gcFrequency: scenario.result.gcFrequency.toFixed(2),
            riskLevel: scenario.result.riskLevel
          });
        }
      }

      if (this.data.simulations.cache) {
        for (const scenario of this.data.simulations.cache.scenarios) {
          simRows.push({
            category: 'Cache TTL',
            scenario: scenario.label,
            estimatedPeakMemoryMB: scenario.result.estimatedPeakMemoryMB.toFixed(2),
            estimatedSteadyStateMemoryMB: scenario.result.estimatedSteadyStateMemoryMB.toFixed(2),
            cacheEfficiency: (scenario.result.cacheEfficiency * 100).toFixed(1) + '%',
            riskLevel: scenario.result.riskLevel
          });
        }
      }

      if (this.data.simulations.objectPool) {
        for (const scenario of this.data.simulations.objectPool.scenarios) {
          simRows.push({
            category: 'Object Pool',
            scenario: scenario.label,
            estimatedPeakMemoryMB: scenario.result.estimatedPeakMemoryMB.toFixed(2),
            estimatedSteadyStateMemoryMB: scenario.result.estimatedSteadyStateMemoryMB.toFixed(2),
            poolEfficiency: (scenario.result.poolEfficiency * 100).toFixed(1) + '%',
            riskLevel: scenario.result.riskLevel
          });
        }
      }

      if (simRows.length > 0) {
        files['simulations.csv'] = simRows;
      }
    }

    if (this.data.endpointTraffic && this.data.endpointTraffic.byEndpoint) {
      const endpointRows = [];
      for (const [endpoint, data] of Object.entries(this.data.endpointTraffic.byEndpoint)) {
        endpointRows.push({
          endpoint: endpoint,
          requestCount: data.count,
          avgLatencyMs: data.avgLatency.toFixed(2),
          maxLatencyMs: data.maxLatency,
          minLatencyMs: data.minLatency
        });
      }
      if (endpointRows.length > 0) {
        files['endpoints.csv'] = endpointRows;
      }
    }

    return files;
  }
}

module.exports = Reporter;
