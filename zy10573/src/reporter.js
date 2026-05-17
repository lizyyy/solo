const fs = require('fs');

class Reporter {
  constructor(analysisResult, options = {}) {
    this.result = analysisResult;
    this.options = {
      outputDir: options.outputDir || './reports',
      ...options
    };
  }

  generateAllReports() {
    return {
      terminal: this.generateTerminalReport(),
      json: this.generateJSONReport(),
      markdown: this.generateMarkdownReport()
    };
  }

  generateTerminalReport() {
    const { summary, conflicts, stats } = this.result;
    const lines = [];
    
    lines.push('');
    lines.push('┌' + '─'.repeat(60) + '┐');
    lines.push('│' + ' OpenTelemetry 属性规范化报告 '.padStart(40, ' ').padEnd(60, ' ') + '│');
    lines.push('├' + '─'.repeat(60) + '┤');
    lines.push(this.formatTerminalLine('服务总数', summary.totalServices));
    lines.push(this.formatTerminalLine('属性总数', summary.totalAttributes));
    lines.push(this.formatTerminalLine('命名冲突', summary.namingConflicts));
    lines.push(this.formatTerminalLine('命名违规', summary.namingViolations));
    lines.push(this.formatTerminalLine('解析错误', stats.parseErrors));
    lines.push('├' + '─'.repeat(60) + '┤');
    lines.push(this.formatTerminalLine('每服务属性数', 
      `${summary.attributesPerService.min} ~ ${summary.attributesPerService.max} (avg: ${summary.attributesPerService.avg})`));
    lines.push('└' + '─'.repeat(60) + '┘');
    
    if (conflicts.length > 0) {
      lines.push('');
      lines.push('⚠️  命名冲突详情:');
      lines.push('');
      
      conflicts.forEach((conflict, idx) => {
        if (conflict.type === 'naming_conflict') {
          lines.push(`  ${idx + 1}. ${conflict.normalizedName} [${conflict.severity.toUpperCase()}]`);
          lines.push(`     变体: ${conflict.variants.join(', ')}`);
          lines.push(`     服务: ${conflict.services.join(', ')}`);
          lines.push('');
        }
      });
    }

    if (this.result.errors.length > 0) {
      lines.push('');
      lines.push('❌ 解析错误 (保留原始位置):');
      lines.push('');
      
      this.result.errors.slice(0, 10).forEach(err => {
        lines.push(`  行 ${err.line}: ${err.error}`);
        if (err.raw) {
          lines.push(`       原始: ${err.raw.substring(0, 60)}${err.raw.length > 60 ? '...' : ''}`);
        }
      });
      
      if (this.result.errors.length > 10) {
        lines.push(`  ... 还有 ${this.result.errors.length - 10} 个错误`);
      }
    }

    lines.push('');
    return lines.join('\n');
  }

  formatTerminalLine(label, value) {
    const valueStr = String(value);
    return '│  ' + label.padEnd(25, ' ') + valueStr.padStart(31, ' ') + ' │';
  }

  generateJSONReport() {
    return JSON.stringify({
      generatedAt: new Date().toISOString(),
      summary: this.result.summary,
      stats: this.result.stats,
      conflicts: this.result.conflicts,
      errors: this.result.errors,
      serviceBreakdown: this.result.serviceBreakdown,
      semanticGroups: this.result.semanticGroups.map(g => ({
        ...g,
        variants: Array.from(g.variants || []),
        services: Array.from(g.services || [])
      })),
      samples: this.result.samples
    }, null, 2);
  }

  generateMarkdownReport() {
    const { summary, conflicts, stats, serviceBreakdown } = this.result;
    const lines = [];

    lines.push('# OpenTelemetry 属性规范化报告');
    lines.push('');
    lines.push(`**生成时间**: ${new Date().toLocaleString('zh-CN')}`);
    lines.push('');
    lines.push('## 📊 概览');
    lines.push('');
    lines.push('| 指标 | 数值 |');
    lines.push('|------|------|');
    lines.push(`| 服务总数 | ${summary.totalServices} |`);
    lines.push(`| 属性总数 | ${summary.totalAttributes} |`);
    lines.push(`| 命名冲突 | ${summary.namingConflicts} |`);
    lines.push(`| 命名违规 | ${summary.namingViolations} |`);
    lines.push(`| 解析错误 | ${stats.parseErrors} |`);
    lines.push(`| 有效Span | ${stats.validSpans} |`);
    lines.push('');

    if (conflicts.some(c => c.type === 'naming_conflict')) {
      lines.push('## ⚠️  命名冲突');
      lines.push('');
      lines.push('| 标准化名称 | 严重程度 | 属性变体 | 涉及服务 |');
      lines.push('|------------|----------|----------|----------|');
      
      conflicts
        .filter(c => c.type === 'naming_conflict')
        .sort((a, b) => {
          const severityOrder = { critical: 0, warning: 1, info: 2 };
          return severityOrder[a.severity] - severityOrder[b.severity];
        })
        .forEach(conflict => {
          const badge = this.getSeverityBadge(conflict.severity);
          lines.push(`| \`${conflict.normalizedName}\` | ${badge} | \`${conflict.variants.join('`, `')}\` | ${conflict.services.join(', ')} |`);
        });
      lines.push('');
    }

    lines.push('## 📋 服务详情');
    lines.push('');

    Object.keys(serviceBreakdown).forEach(serviceName => {
      const service = serviceBreakdown[serviceName];
      lines.push(`### ${serviceName}`);
      lines.push('');
      lines.push(`- **Span数量**: ${service.spanCount}`);
      lines.push(`- **属性数量**: ${service.attributeCount}`);
      lines.push('');
      lines.push('| 属性名 | 出现次数 | 值类型 | 样本值 |');
      lines.push('|--------|----------|--------|--------|');
      
      Object.keys(service.attributes).forEach(attrKey => {
        const attr = service.attributes[attrKey];
        const types = attr.types.join(', ');
        const samples = attr.sampleValues.map(v => 
          String(v).length > 30 ? String(v).substring(0, 27) + '...' : String(v)
        ).join('; ');
        lines.push(`| \`${attrKey}\` | ${attr.count} | ${types} | \`${samples || '-'}\` |`);
      });
      lines.push('');
    });

    if (this.result.errors.length > 0) {
      lines.push('## ❌ 解析错误');
      lines.push('');
      lines.push('| 行号 | 错误信息 | 原始内容 |');
      lines.push('|------|----------|----------|');
      
      this.result.errors.forEach(err => {
        const raw = err.raw ? 
          (err.raw.length > 50 ? err.raw.substring(0, 47) + '...' : err.raw) : 
          '-';
        lines.push(`| ${err.line} | ${err.error} | \`${raw}\` |`);
      });
      lines.push('');
    }

    lines.push('## 📝 建议');
    lines.push('');
    lines.push('1. **统一命名规范**: 使用 `snake_case` 或点分隔的小写命名');
    lines.push('2. **标准化业务属性**: 租户ID统一使用 `tenant.id`，用户ID统一使用 `user.id`');
    lines.push('3. **遵循语义约定**: 参考 OpenTelemetry 官方语义约定命名属性');
    lines.push('4. **定期检查**: 建议每月运行此检查，确保属性命名一致性');
    lines.push('');

    return lines.join('\n');
  }

  getSeverityBadge(severity) {
    const badges = {
      critical: '🔴 严重',
      warning: '🟡 警告',
      info: '🔵 提示'
    };
    return badges[severity] || severity;
  }

  writeReports() {
    if (!fs.existsSync(this.options.outputDir)) {
      fs.mkdirSync(this.options.outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    
    const jsonPath = `${this.options.outputDir}/otel-attr-report-${timestamp}.json`;
    fs.writeFileSync(jsonPath, this.generateJSONReport());

    const mdPath = `${this.options.outputDir}/otel-attr-report-${timestamp}.md`;
    fs.writeFileSync(mdPath, this.generateMarkdownReport());

    return {
      json: jsonPath,
      markdown: mdPath
    };
  }

  printTerminal() {
    console.log(this.generateTerminalReport());
  }
}

module.exports = { Reporter };
