const fs = require('fs');
const Table = require('cli-table3');

class ConsoleOutput {
  constructor(options = {}) {
    this.options = {
      color: options.color !== false,
      maxSQLWidth: options.maxSQLWidth || 80,
      ...options
    };
  }

  render(report, errors = []) {
    const output = [];
    
    output.push(this.renderHeader());
    output.push(this.renderOverall(report.overall));
    output.push(this.renderTimeBuckets(report.bucketStats));
    output.push(this.renderTypeStats(report.typeStats));
    output.push(this.renderTopFingerprints(report.fingerprintGroups));
    output.push(this.renderTableStats(report.tableStats.slice(0, 5)));
    
    if (errors && errors.length > 0) {
      output.push(this.renderErrors(errors));
    }
    
    output.push(this.renderFooter(report.overall));
    
    return output.join('\n');
  }

  renderHeader() {
    return `
╔══════════════════════════════════════════════════════════════╗
║              SQL 慢查询指纹分析报告                             ║
╚══════════════════════════════════════════════════════════════╝
`;
  }

  renderOverall(overall) {
    const table = new Table({
      head: ['统计项', '数值'],
      colWidths: [30, 30]
    });

    table.push(
      ['总查询数', overall.count.toLocaleString()],
      ['唯一指纹数', overall.uniqueFingerprints],
      ['涉及表数', overall.tablesCount],
      ['总耗时 (s)', overall.sum.toFixed(2)],
      ['平均耗时 (s)', overall.avg.toFixed(4)],
      ['P50 耗时 (s)', overall.p50.toFixed(4)],
      ['P95 耗时 (s)', overall.p95.toFixed(4)],
      ['P99 耗时 (s)', overall.p99.toFixed(4)],
      ['最大耗时 (s)', overall.max.toFixed(4)]
    );

    return `\n【总体统计】\n${table.toString()}`;
  }

  renderTimeBuckets(bucketStats) {
    const table = new Table({
      head: ['耗时区间', '查询数', '占比', '总耗时(s)'],
      colWidths: [20, 15, 15, 15]
    });

    const totalCount = bucketStats.reduce((sum, b) => sum + b.count, 0);

    for (const bucket of bucketStats) {
      const percentage = totalCount > 0 ? ((bucket.count / totalCount) * 100) : 0;
      table.push([
        bucket.bucket,
        bucket.count,
        percentage.toFixed(1) + '%',
        bucket.totalTime.toFixed(2)
      ]);
    }

    return `\n【耗时分桶】\n${table.toString()}`;
  }

  renderTypeStats(typeStats) {
    const table = new Table({
      head: ['查询类型', '数量', '占比', '总耗时(s)', '平均耗时(s)'],
      colWidths: [15, 12, 12, 15, 15]
    });

    const totalCount = typeStats.reduce((sum, t) => sum + t.count, 0);

    for (const stat of typeStats) {
      const percentage = totalCount > 0 ? ((stat.count / totalCount) * 100) : 0;
      table.push([
        stat.type,
        stat.count,
        percentage.toFixed(1) + '%',
        stat.totalTime.toFixed(2),
        stat.avgTime.toFixed(4)
      ]);
    }

    return `\n【查询类型统计】\n${table.toString()}`;
  }

  renderTopFingerprints(fingerprintGroups) {
    const output = ['\n【Top 慢查询指纹】'];

    for (let i = 0; i < fingerprintGroups.length; i++) {
      const group = fingerprintGroups[i];
      output.push(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      output.push(`排名: ${i + 1} | 指纹: ${group.fingerprint.substring(0, 16)}...`);
      output.push(`类型: ${group.queryType} | 表: ${group.tables.join(', ') || '未知'}`);
      output.push(`次数: ${group.count} | 总耗时: ${group.totalTime.toFixed(2)}s | 平均: ${group.avgTime.toFixed(4)}s`);
      output.push(`P50: ${group.timeStats.p50}s | P95: ${group.timeStats.p95}s | P99: ${group.timeStats.p99}s`);
      output.push(`\n归一化 SQL:`);
      output.push(this.truncateSQL(group.normalizedSQL));
      
      if (group.topSamples.length > 0) {
        output.push(`\n最慢样本 (行 ${group.topSamples[0].startLine}-${group.topSamples[0].endLine}):`);
        output.push(`  耗时: ${group.topSamples[0].queryTime}s`);
        output.push(this.truncateSQL(group.topSamples[0].sql, 2));
      }
    }

    return output.join('\n');
  }

  renderTableStats(tableStats) {
    const table = new Table({
      head: ['表名', '查询数', '指纹数', '总耗时(s)', '平均耗时(s)'],
      colWidths: [25, 12, 12, 15, 15]
    });

    for (const stat of tableStats) {
      table.push([
        stat.table,
        stat.count,
        stat.fingerprintCount,
        stat.totalTime.toFixed(2),
        stat.avgTime.toFixed(4)
      ]);
    }

    return `\n【Top 慢查询表】\n${table.toString()}`;
  }

  renderErrors(errors) {
    const output = ['\n【解析异常】'];
    
    for (let i = 0; i < Math.min(errors.length, 10); i++) {
      const error = errors[i];
      output.push(`\n异常 ${i + 1}: ${error.type}`);
      output.push(`  原因: ${error.reason}`);
      output.push(`  位置: 行 ${error.startLine}-${error.endLine}`);
      if (error.rawLines && error.rawLines.length > 0) {
        output.push(`  内容: ${this.truncateSQL(error.rawLines[0], 2)}`);
      }
    }
    
    if (errors.length > 10) {
      output.push(`\n... 还有 ${errors.length - 10} 个异常未显示`);
    }
    
    return output.join('\n');
  }

  renderFooter(overall) {
    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  共分析 ${overall.count} 条慢查询，发现 ${overall.uniqueFingerprints} 个唯一指纹
`;
  }

  truncateSQL(sql, indent = 0) {
    const indentStr = '  '.repeat(indent);
    const lines = [];
    let current = indentStr;
    
    for (const word of sql.split(/\s+/)) {
      if (current.length + word.length > this.options.maxSQLWidth) {
        lines.push(current);
        current = indentStr + '  ' + word;
      } else {
        current += (current.length > indentStr.length ? ' ' : '') + word;
      }
    }
    
    if (current.trim()) {
      lines.push(current);
    }
    
    return lines.join('\n');
  }
}

class JsonOutput {
  constructor(options = {}) {
    this.options = options;
  }

  render(report, errors = [], parseResult = null) {
    const output = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalQueries: report.overall.count,
        uniqueFingerprints: report.overall.uniqueFingerprints,
        tablesCount: report.overall.tablesCount,
        totalTime: report.overall.sum,
        avgTime: report.overall.avg,
        p50: report.overall.p50,
        p95: report.overall.p95,
        p99: report.overall.p99
      },
      timeBuckets: report.bucketStats,
      queryTypes: report.typeStats,
      topFingerprints: report.fingerprintGroups.map(g => ({
        fingerprint: g.fingerprint,
        queryType: g.queryType,
        tables: g.tables,
        count: g.count,
        totalTime: g.totalTime,
        avgTime: g.avgTime,
        timeStats: g.timeStats,
        normalizedSQL: g.normalizedSQL,
        topSamples: g.topSamples.map(s => ({
          queryTime: s.queryTime,
          startLine: s.startLine,
          endLine: s.endLine,
          sql: s.sql
        }))
      })),
      tableStats: report.tableStats,
      errors: errors.map(e => ({
        type: e.type,
        reason: e.reason,
        startLine: e.startLine,
        endLine: e.endLine,
        rawLines: e.rawLines
      }))
    };

    if (parseResult) {
      output.parseInfo = {
        totalLines: parseResult.totalLines,
        parsedEntries: parseResult.entries.length,
        errorCount: parseResult.errors.length
      };
    }

    return JSON.stringify(output, null, 2);
  }

  writeToFile(report, errors, parseResult, filePath) {
    const content = this.render(report, errors, parseResult);
    fs.writeFileSync(filePath, content, 'utf8');
    return filePath;
  }
}

class MarkdownOutput {
  constructor(options = {}) {
    this.options = {
      title: options.title || 'SQL 慢查询指纹分析报告',
      ...options
    };
  }

  render(report, errors = [], parseResult = null) {
    const output = [];

    output.push(`# ${this.options.title}`);
    output.push('');
    output.push(`生成时间: ${new Date().toLocaleString('zh-CN')}`);
    output.push('');

    output.push('## 总体统计');
    output.push('');
    output.push('| 统计项 | 数值 |');
    output.push('|--------|------|');
    output.push(`| 总查询数 | ${report.overall.count.toLocaleString()} |`);
    output.push(`| 唯一指纹数 | ${report.overall.uniqueFingerprints} |`);
    output.push(`| 涉及表数 | ${report.overall.tablesCount} |`);
    output.push(`| 总耗时 (s) | ${report.overall.sum.toFixed(2)} |`);
    output.push(`| 平均耗时 (s) | ${report.overall.avg.toFixed(4)} |`);
    output.push(`| P50 耗时 (s) | ${report.overall.p50.toFixed(4)} |`);
    output.push(`| P95 耗时 (s) | ${report.overall.p95.toFixed(4)} |`);
    output.push(`| P99 耗时 (s) | ${report.overall.p99.toFixed(4)} |`);
    output.push(`| 最大耗时 (s) | ${report.overall.max.toFixed(4)} |`);
    output.push('');

    output.push('## 耗时分桶');
    output.push('');
    output.push('| 耗时区间 | 查询数 | 占比 | 总耗时(s) |');
    output.push('|----------|--------|------|------------|');
    
    const totalCount = report.bucketStats.reduce((sum, b) => sum + b.count, 0);
    for (const bucket of report.bucketStats) {
      const percentage = totalCount > 0 ? ((bucket.count / totalCount) * 100).toFixed(1) : 0;
      output.push(`| ${bucket.bucket} | ${bucket.count} | ${percentage}% | ${bucket.totalTime.toFixed(2)} |`);
    }
    output.push('');

    output.push('## 查询类型统计');
    output.push('');
    output.push('| 查询类型 | 数量 | 占比 | 总耗时(s) | 平均耗时(s) |');
    output.push('|----------|------|------|------------|------------|');
    
    const typeTotal = report.typeStats.reduce((sum, t) => sum + t.count, 0);
    for (const stat of report.typeStats) {
      const percentage = typeTotal > 0 ? ((stat.count / typeTotal) * 100).toFixed(1) : 0;
      output.push(`| ${stat.type} | ${stat.count} | ${percentage}% | ${stat.totalTime.toFixed(2)} | ${stat.avgTime.toFixed(4)} |`);
    }
    output.push('');

    output.push('## Top 慢查询指纹');
    output.push('');
    
    for (let i = 0; i < report.fingerprintGroups.length; i++) {
      const group = report.fingerprintGroups[i];
      output.push(`### ${i + 1}. 指纹 \`${group.fingerprint.substring(0, 16)}...\``);
      output.push('');
      output.push(`- **类型**: ${group.queryType}`);
      output.push(`- **涉及表**: ${group.tables.join(', ') || '未知'}`);
      output.push(`- **执行次数**: ${group.count}`);
      output.push(`- **总耗时**: ${group.totalTime.toFixed(2)}s`);
      output.push(`- **平均耗时**: ${group.avgTime.toFixed(4)}s`);
      output.push(`- **耗时分布**: P50=${group.timeStats.p50}s, P95=${group.timeStats.p95}s, P99=${group.timeStats.p99}s`);
      output.push('');
      output.push('#### 归一化 SQL');
      output.push('```sql');
      output.push(group.normalizedSQL);
      output.push('```');
      output.push('');
      
      if (group.topSamples.length > 0) {
        output.push('#### 最慢样本');
        output.push('');
        
        for (let j = 0; j < Math.min(group.topSamples.length, 3); j++) {
          const sample = group.topSamples[j];
          output.push(`${j + 1}. **耗时**: ${sample.queryTime}s (行 ${sample.startLine}-${sample.endLine})`);
          output.push('   ```sql');
          output.push('   ' + sample.sql.substring(0, 200) + (sample.sql.length > 200 ? '...' : ''));
          output.push('   ```');
          output.push('');
        }
      }
    }

    output.push('## 表统计');
    output.push('');
    output.push('| 表名 | 查询数 | 指纹数 | 总耗时(s) | 平均耗时(s) |');
    output.push('|------|--------|--------|------------|------------|');
    
    for (const stat of report.tableStats.slice(0, 10)) {
      output.push(`| ${stat.table} | ${stat.count} | ${stat.fingerprintCount} | ${stat.totalTime.toFixed(2)} | ${stat.avgTime.toFixed(4)} |`);
    }
    output.push('');

    if (errors && errors.length > 0) {
      output.push('## 解析异常');
      output.push('');
      
      for (let i = 0; i < Math.min(errors.length, 20); i++) {
        const error = errors[i];
        output.push(`### ${i + 1}. ${error.type}`);
        output.push('');
        output.push(`- **原因**: ${error.reason}`);
        output.push(`- **位置**: 行 ${error.startLine}-${error.endLine}`);
        if (error.rawLines && error.rawLines.length > 0) {
          output.push('- **内容**:');
          output.push('```');
          output.push(error.rawLines[0].substring(0, 200));
          output.push('```');
        }
        output.push('');
      }
      
      if (errors.length > 20) {
        output.push(`> 还有 ${errors.length - 20} 个异常未列出`);
        output.push('');
      }
    }

    if (parseResult) {
      output.push('## 解析信息');
      output.push('');
      output.push(`- 总行数: ${parseResult.totalLines}`);
      output.push(`- 成功解析: ${parseResult.entries.length}`);
      output.push(`- 解析异常: ${parseResult.errors.length}`);
      output.push('');
    }

    return output.join('\n');
  }

  writeToFile(report, errors, parseResult, filePath) {
    const content = this.render(report, errors, parseResult);
    fs.writeFileSync(filePath, content, 'utf8');
    return filePath;
  }
}

module.exports = {
  ConsoleOutput,
  JsonOutput,
  MarkdownOutput
};
