const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { table } = require('table');

class ReportGenerator {
  constructor(options) {
    this.options = options || {};
    this.chalk = new chalk.Instance({ level: 3 });
  }

  generateConsoleReport(matrix) {
    let output = '';
    output += this.chalk.bold.blue('\n╔══════════════════════════════════════════════════════════════╗\n');
    output += this.chalk.bold.blue('║') + '                    gRPC 错误码矩阵报告                         ' + this.chalk.bold.blue('║\n');
    output += this.chalk.bold.blue('╚══════════════════════════════════════════════════════════════╝\n\n');
    output += this.generateSummarySection(matrix);
    output += this.generateCategorySection(matrix);
    output += this.generateErrorCodesTable(matrix);
    return output;
  }

  generateSummarySection(matrix) {
    let output = '';
    output += this.chalk.bold.yellow('📊 摘要信息\n');
    output += this.chalk.gray('─────────────────────────────────────────────────────────────\n');
    const summary = matrix.summary;
    const summaryData = [
      ['总错误码数量', summary.totalCodes.toString()],
      ['含重试策略', summary.withRetryStrategy.toString()],
      ['不含重试策略', summary.withoutRetryStrategy.toString()]
    ];
    for (const [category, count] of Object.entries(summary.categories)) {
      summaryData.push([this.getCategoryDisplayName(category), count.toString()]);
    }
    output += table(summaryData, {
      columns: [{ width: 20 }, { width: 10 }],
      border: {
        topBody: '─', topJoin: '┬', topLeft: '┌', topRight: '┐',
        bottomBody: '─', bottomJoin: '┴', bottomLeft: '└', bottomRight: '┘',
        bodyLeft: '│', bodyRight: '│', bodyJoin: '│',
        joinBody: '─', joinLeft: '├', joinRight: '┤', joinJoin: '┼'
      }
    });
    output += '\n';
    return output;
  }

  generateCategorySection(matrix) {
    let output = '';
    output += this.chalk.bold.yellow('📂 错误分类\n');
    output += this.chalk.gray('─────────────────────────────────────────────────────────────\n\n');
    for (const [key, category] of Object.entries(matrix.categories)) {
      const color = category.retryable ? this.chalk.green : this.chalk.red;
      output += color.bold('◆ ' + category.name + ' (' + category.count + ')\n');
      output += this.chalk.gray('  ' + category.description + '\n');
      output += this.chalk.gray('  可重试: ' + (category.retryable ? '是 ✓' : '否 ✗') + '\n\n');
    }
    return output;
  }

  generateErrorCodesTable(matrix) {
    let output = '';
    output += this.chalk.bold.yellow('📋 错误码详情\n');
    output += this.chalk.gray('─────────────────────────────────────────────────────────────\n\n');
    const tableData = [
      ['错误码', '名称', '分类', '可重试', '最大重试次数']
    ];
    for (const ec of matrix.errorCodes) {
      tableData.push([
        ec.code.toString(),
        ec.name,
        this.getCategoryDisplayName(ec.category),
        ec.retryable ? '✓' : '✗',
        ec.retryStrategy.maxRetries.toString()
      ]);
    }
    output += table(tableData, {
      columns: [
        { width: 10 }, { width: 30 }, { width: 15 }, { width: 8 }, { width: 12 }
      ]
    });
    return output;
  }

  getCategoryDisplayName(category) {
    const names = {
      TRANSIENT: '临时错误',
      PERMANENT: '永久错误',
      CLIENT_ERROR: '客户端错误',
      SERVER_ERROR: '服务端错误'
    };
    return names[category] || category;
  }

  generateJsonReport(matrix, outputPath) {
    const jsonContent = JSON.stringify(matrix, null, 2);
    if (outputPath) {
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(outputPath, jsonContent, 'utf8');
    }
    return jsonContent;
  }

  generateMarkdownReport(matrix, outputPath) {
    let md = '# gRPC 错误码矩阵报告\n\n';
    md += '*生成时间: ' + new Date(matrix.timestamp).toLocaleString() + '*\n\n';
    md += '## 摘要\n\n';
    md += '| 指标 | 数值 |\n';
    md += '|------|------|\n';
    md += '| 总错误码数量 | ' + matrix.summary.totalCodes + ' |\n';
    md += '| 含重试策略 | ' + matrix.summary.withRetryStrategy + ' |\n';
    md += '| 不含重试策略 | ' + matrix.summary.withoutRetryStrategy + ' |\n\n';
    md += '## 错误分类统计\n\n';
    md += '| 分类 | 数量 | 可重试 | 描述 |\n';
    md += '|------|------|--------|------|\n';
    for (const [key, category] of Object.entries(matrix.categories)) {
      md += '| ' + category.name + ' | ' + category.count + ' | ' + (category.retryable ? '是' : '否') + ' | ' + category.description + ' |\n';
    }
    md += '\n';
    md += '## 错误码详情\n\n';
    md += '| 错误码 | 名称 | 分类 | 可重试 | 最大重试次数 | 退避策略 |\n';
    md += '|--------|------|------|--------|--------------|----------|\n';
    for (const ec of matrix.errorCodes) {
      md += '| ' + ec.code + ' | ' + ec.name + ' | ' + this.getCategoryDisplayName(ec.category) + ' | ' + (ec.retryable ? '是' : '否') + ' | ' + ec.retryStrategy.maxRetries + ' | ' + ec.retryStrategy.backoff + ' |\n';
    }
    md += '\n';
    if (outputPath) {
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(outputPath, md, 'utf8');
    }
    return md;
  }

  generateAllReports(matrix, outputDir) {
    const reports = {};
    reports.console = this.generateConsoleReport(matrix);
    if (outputDir) {
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
      reports.jsonPath = path.join(outputDir, 'error-matrix.json');
      reports.json = this.generateJsonReport(matrix, reports.jsonPath);
      reports.markdownPath = path.join(outputDir, 'error-matrix.md');
      reports.markdown = this.generateMarkdownReport(matrix, reports.markdownPath);
    }
    return reports;
  }
}

module.exports = ReportGenerator;
