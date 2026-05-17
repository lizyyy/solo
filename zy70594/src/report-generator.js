const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

class ReportGenerator {
  constructor(options = {}) {
    this.outputDir = options.outputDir || process.cwd();
    this.baseName = options.baseName || 'cdn-sample-report';
    this.includeRawLines = options.includeRawLines !== false;
  }

  generateTerminalSummary(result) {
    const { summary, samples, invalidRecords, duplicates } = result;
    const statusCounts = this.groupByField(samples, 'status');
    const regionCounts = this.groupByField(samples, 'region');
    const resourceTypeCounts = this.groupByField(samples, 'resourceType');

    console.log('\n' + chalk.bold.blue('='.repeat(60)));
    console.log(chalk.bold.blue('CDN 访问日志抽样报告 - 摘要'));
    console.log(chalk.bold.blue('='.repeat(60)) + '\n');

    console.log(chalk.bold('📊 处理统计:'));
    console.log(`  总行数: ${chalk.yellow(summary.totalProcessed.toLocaleString())}`);
    console.log(`  有效行数: ${chalk.green(summary.totalValid.toLocaleString())}`);
    console.log(`  抽样数量: ${chalk.cyan(summary.totalSampled.toLocaleString())}`);
    console.log(`  抽样比例: ${chalk.magenta((summary.samplingRatio * 100).toFixed(2))}%`);
    console.log(`  分层数量: ${chalk.blue(summary.totalStrata)}`);
    console.log(`  异常行数: ${chalk.red(invalidRecords.length.toLocaleString())}`);
    console.log(`  重复行数: ${chalk.gray(duplicates.length.toLocaleString())}\n`);

    console.log(chalk.bold('📈 状态码分布:'));
    this.printDistribution(statusCounts, 15);

    console.log(chalk.bold('\n🌍 地区分布:'));
    this.printDistribution(regionCounts, 15);

    console.log(chalk.bold('\n📁 资源类型分布:'));
    this.printDistribution(resourceTypeCounts, 15);

    if (invalidRecords.length > 0) {
      console.log(chalk.bold('\n⚠️  异常类型统计:'));
      const errorCounts = this.groupBy(invalidRecords, 'error');
      this.printDistribution(errorCounts, 20);
    }

    console.log('\n' + chalk.bold.blue('='.repeat(60)) + '\n');
  }

  printDistribution(counts, maxLabelWidth = 15) {
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const total = sorted.reduce((sum, [_, count]) => sum + count, 0);
    const maxCount = Math.max(...sorted.map(([_, count]) => count));
    const maxBarWidth = 30;

    for (const [key, count] of sorted.slice(0, 10)) {
      const percentage = ((count / total) * 100).toFixed(1);
      const barWidth = Math.round((count / maxCount) * maxBarWidth);
      const bar = '█'.repeat(barWidth) + '░'.repeat(maxBarWidth - barWidth);
      const label = key.toString().padEnd(maxLabelWidth).slice(0, maxLabelWidth);
      console.log(`  ${label} ${chalk.cyan(bar)} ${chalk.yellow(String(count).padStart(6))} (${percentage}%)`);
    }

    if (sorted.length > 10) {
      const others = sorted.slice(10).reduce((sum, [_, count]) => sum + count, 0);
      const percentage = ((others / total) * 100).toFixed(1);
      console.log(`  ${'...其他'.padEnd(maxLabelWidth)} ${' '.repeat(maxBarWidth)} ${chalk.yellow(String(others).padStart(6))} (${percentage}%)`);
    }
  }

  groupByField(samples, field) {
    return samples.reduce((acc, s) => {
      const value = s.data?.[field] || 'unknown';
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});
  }

  groupBy(items, field) {
    return items.reduce((acc, item) => {
      const value = item[field] || 'unknown';
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});
  }

  generateJsonReport(result) {
    const { summary, samples, invalidRecords, duplicates, metadata } = result;
    
    const report = {
      metadata: {
        ...metadata,
        generatedAt: new Date().toISOString(),
        version: '1.0.0'
      },
      summary,
      samples: samples.map(s => ({
        lineNumber: s.lineNumber,
        stratum: s.stratum,
        selectionMethod: s.selectionMethod,
        sampleWeight: s.sampleWeight,
        data: s.data,
        raw: this.includeRawLines ? s.raw : undefined
      })),
      anomalies: invalidRecords.map(r => ({
        lineNumber: r.lineNumber,
        error: r.error,
        errorMessage: r.errorMessage,
        raw: this.includeRawLines ? r.raw : undefined
      })),
      duplicates: duplicates.map(r => ({
        lineNumber: r.record?.lineNumber,
        stratum: r.stratum,
        raw: this.includeRawLines ? r.record?.raw : undefined
      })),
      distributions: {
        status: this.groupByField(samples, 'status'),
        region: this.groupByField(samples, 'region'),
        resourceType: this.groupByField(samples, 'resourceType')
      }
    };

    return JSON.stringify(report, null, 2);
  }

  generateMarkdownReport(result) {
    const { summary, samples, invalidRecords, duplicates, metadata } = result;
    const statusCounts = this.groupByField(samples, 'status');
    const regionCounts = this.groupByField(samples, 'region');
    const resourceTypeCounts = this.groupByField(samples, 'resourceType');

    let md = `# CDN 访问日志抽样报告\n\n`;
    md += `**生成时间**: ${new Date().toLocaleString('zh-CN')}\n`;
    md += `**源文件**: ${metadata.sourceFile || 'N/A'}\n\n`;

    md += `## 📊 处理统计\n\n`;
    md += `| 指标 | 数值 |\n`;
    md += `|------|------|\n`;
    md += `| 总行数 | ${summary.totalProcessed.toLocaleString()} |\n`;
    md += `| 有效行数 | ${summary.totalValid.toLocaleString()} |\n`;
    md += `| 抽样数量 | ${summary.totalSampled.toLocaleString()} |\n`;
    md += `| 抽样比例 | ${(summary.samplingRatio * 100).toFixed(2)}% |\n`;
    md += `| 分层数量 | ${summary.totalStrata} |\n`;
    md += `| 异常行数 | ${invalidRecords.length.toLocaleString()} |\n`;
    md += `| 重复行数 | ${duplicates.length.toLocaleString()} |\n\n`;

    md += `## 📈 分布统计\n\n`;
    md += `### 状态码分布\n\n`;
    md += this.generateMarkdownTable(statusCounts);
    md += `\n### 地区分布\n\n`;
    md += this.generateMarkdownTable(regionCounts);
    md += `\n### 资源类型分布\n\n`;
    md += this.generateMarkdownTable(resourceTypeCounts);

    if (invalidRecords.length > 0) {
      md += `\n## ⚠️ 异常记录详情\n\n`;
      md += `| 行号 | 错误类型 | 错误信息 | 原始内容 |\n`;
      md += `|------|----------|----------|----------|\n`;
      for (const record of invalidRecords.slice(0, 50)) {
        const raw = (record.raw || '').replace(/\|/g, '\\|').substring(0, 100);
        const errorMsg = (record.errorMessage || '-').replace(/\|/g, '\\|');
        md += `| ${record.lineNumber} | ${record.error} | ${errorMsg} | ${raw} |\n`;
      }
      if (invalidRecords.length > 50) {
        md += `\n> 仅显示前 50 条异常记录，完整记录请查看 JSON 报告\n`;
      }
    }

    md += `\n## 🎯 抽样样本示例\n\n`;
    md += `| 行号 | 分层 | 状态码 | 地区 | 资源类型 | URL |\n`;
    md += `|------|------|--------|------|----------|-----|\n`;
    for (const s of samples.slice(0, 30)) {
      const stratumEscaped = (s.stratum || '').replace(/\|/g, '\\|');
      const url = (s.data?.url || '').replace(/\|/g, '\\|').substring(0, 60);
      md += `| ${s.lineNumber} | ${stratumEscaped} | ${s.data?.status || '-'} | ${s.data?.region || '-'} | ${s.data?.resourceType || '-'} | ${url} |\n`;
    }
    if (samples.length > 30) {
      md += `\n> 仅显示前 30 条样本，完整样本请查看 JSON 报告\n`;
    }

    return md;
  }

  generateMarkdownTable(counts) {
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const total = sorted.reduce((sum, [_, count]) => sum + count, 0);

    let table = `| 分类 | 数量 | 占比 |\n`;
    table += `|------|------|------|\n`;
    for (const [key, count] of sorted) {
      const percentage = ((count / total) * 100).toFixed(1);
      table += `| ${key} | ${count} | ${percentage}% |\n`;
    }
    return table;
  }

  async writeReports(result) {
    const jsonContent = this.generateJsonReport(result);
    const markdownContent = this.generateMarkdownReport(result);

    const jsonPath = path.join(this.outputDir, `${this.baseName}.json`);
    const mdPath = path.join(this.outputDir, `${this.baseName}.md`);

    await Promise.all([
      fs.promises.writeFile(jsonPath, jsonContent, 'utf8'),
      fs.promises.writeFile(mdPath, markdownContent, 'utf8')
    ]);

    return { jsonPath, mdPath };
  }
}

module.exports = { ReportGenerator };
