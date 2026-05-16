const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const Table = require('cli-table3');
const { createObjectCsvWriter } = require('csv-writer');

class Reporter {
  constructor(args) {
    this.args = args;
    this.outputDir = args.outputDir;
    this.formats = args.formats;
  }

  async generateAll(analysis) {
    if (this.formats.includes('terminal')) {
      this.printTerminalSummary(analysis);
    }
    if (this.formats.includes('json')) {
      await this.generateJsonReport(analysis);
    }
    if (this.formats.includes('csv')) {
      await this.generateCsvReport(analysis);
    }
    if (this.formats.includes('html')) {
      await this.generateHtmlReport(analysis);
    }
  }

  printTerminalSummary(analysis) {
    const { summary, groups } = analysis;

    console.log('\n' + chalk.bold.cyan('='.repeat(60)));
    console.log(chalk.bold.cyan('    GitHub Actions 矩阵抖动分析报告'));
    console.log(chalk.bold.cyan('='.repeat(60)) + '\n');

    console.log(chalk.bold('📊 总体统计'));
    console.log(`  总日志数: ${summary.totalLogs}`);
    console.log(`  失败数: ${chalk.red(summary.totalFailed)}`);
    console.log(`  成功数: ${chalk.green(summary.totalSuccess)}`);
    console.log(`  总重跑次数: ${summary.totalReruns}`);
    console.log(`  总体失败率: ${(summary.overallFailureRate * 100).toFixed(1)}%`);
    console.log(`  矩阵组合数: ${summary.totalMatrixGroups}`);
    console.log(`  ${chalk.red('CRITICAL')} 级别: ${summary.criticalGroups}`);
    console.log(`  ${chalk.yellow('HIGH')} 级别: ${summary.highGroups}`);
    console.log();

    if (summary.mostUnstable) {
      console.log(chalk.bold('⚠️  最不稳定的矩阵组合'));
      console.log(`  组合: ${JSON.stringify(summary.mostUnstable.matrix)}`);
      console.log(`  抖动分数: ${this.getScoreColor(summary.mostUnstable.flakeScore)}`);
      console.log(`  级别: ${this.getLevelColor(summary.mostUnstable.flakeLevel)}`);
      console.log();
    }

    const table = new Table({
      head: [
        chalk.bold('矩阵组合'),
        chalk.bold('总次数'),
        chalk.bold('失败'),
        chalk.bold('失败率'),
        chalk.bold('平均重跑'),
        chalk.bold('抖动分数'),
        chalk.bold('级别')
      ],
      colWidths: [30, 10, 10, 12, 12, 12, 10]
    });

    for (const group of groups) {
      const matrixStr = Object.values(group.matrix).join(', ');
      table.push([
        matrixStr.substring(0, 28),
        group.totalRuns,
        group.failedRuns,
        `${(group.failureRate * 100).toFixed(1)}%`,
        group.avgReruns.toFixed(2),
        this.getScoreColor(group.flakeScore),
        this.getLevelColor(group.flakeLevel)
      ]);
    }

    console.log(chalk.bold('📋 矩阵组合详细统计'));
    console.log(table.toString());
    console.log();

    const criticalGroups = groups.filter(g => g.flakeLevel === 'CRITICAL' || g.flakeLevel === 'HIGH');
    if (criticalGroups.length > 0) {
      console.log(chalk.bold('🔍 失败详情样本'));
      for (const group of criticalGroups.slice(0, 3)) {
        if (group.failureSnippets.length > 0) {
          console.log(`\n  ${chalk.underline(JSON.stringify(group.matrix))}`);
          for (const snippet of group.failureSnippets.slice(0, 2)) {
            console.log(`    - ${chalk.gray(`文件: ${snippet.logFile}, 行: ${snippet.lineNumber}`)}`);
            console.log(`      ${snippet.snippet.split('\n')[0].substring(0, 80)}...`);
          }
        }
      }
      console.log();
    }

    console.log(chalk.bold('📁 输出文件'));
    for (const format of this.formats.filter(f => f !== 'terminal')) {
      const ext = format === 'json' ? 'json' : format;
      console.log(`  - ${path.join(this.outputDir, `matrix-flake-report.${ext}`)}`);
    }
  }

  getScoreColor(score) {
    if (score >= 70) return chalk.red(score.toFixed(1));
    if (score >= 40) return chalk.yellow(score.toFixed(1));
    if (score >= 20) return chalk.blue(score.toFixed(1));
    return chalk.green(score.toFixed(1));
  }

  getLevelColor(level) {
    switch (level) {
      case 'CRITICAL': return chalk.red(level);
      case 'HIGH': return chalk.yellow(level);
      case 'MEDIUM': return chalk.blue(level);
      default: return chalk.green(level);
    }
  }

  async generateJsonReport(analysis) {
    const filePath = path.join(this.outputDir, 'matrix-flake-report.json');
    const jsonData = {
      generatedAt: new Date().toISOString(),
      summary: analysis.summary,
      groups: analysis.groups.map(g => ({
        key: g.key,
        matrix: g.matrix,
        totalRuns: g.totalRuns,
        failedRuns: g.failedRuns,
        successRuns: g.successRuns,
        failureRate: g.failureRate,
        totalReruns: g.totalReruns,
        avgReruns: g.avgReruns,
        flakeScore: g.flakeScore,
        flakeLevel: g.flakeLevel,
        failureSnippets: g.failureSnippets
      }))
    };
    fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2));
  }

  async generateCsvReport(analysis) {
    const filePath = path.join(this.outputDir, 'matrix-flake-report.csv');
    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'matrix', title: '矩阵组合' },
        { id: 'totalRuns', title: '总运行次数' },
        { id: 'failedRuns', title: '失败次数' },
        { id: 'failureRate', title: '失败率(%)' },
        { id: 'avgReruns', title: '平均重跑次数' },
        { id: 'flakeScore', title: '抖动分数' },
        { id: 'flakeLevel', title: '抖动级别' },
        { id: 'sampleError', title: '样本错误' }
      ]
    });

    const records = analysis.groups.map(g => ({
      matrix: JSON.stringify(g.matrix),
      totalRuns: g.totalRuns,
      failedRuns: g.failedRuns,
      failureRate: (g.failureRate * 100).toFixed(2),
      avgReruns: g.avgReruns.toFixed(2),
      flakeScore: g.flakeScore.toFixed(2),
      flakeLevel: g.flakeLevel,
      sampleError: g.failureSnippets.length > 0 
        ? g.failureSnippets[0].snippet.split('\n')[0].substring(0, 200)
        : ''
    }));

    await csvWriter.writeRecords(records);
  }

  async generateHtmlReport(analysis) {
    const filePath = path.join(this.outputDir, 'matrix-flake-report.html');
    
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GitHub Actions 矩阵抖动分析报告</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 30px; }
        .header h1 { font-size: 28px; margin-bottom: 10px; }
        .header .subtitle { opacity: 0.9; }
        .summary-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px; }
        .card { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .card .value { font-size: 32px; font-weight: bold; color: #333; }
        .card .label { font-size: 14px; color: #666; margin-top: 5px; }
        .card.critical .value { color: #dc3545; }
        .card.high .value { color: #ffc107; }
        .section { background: white; border-radius: 10px; padding: 25px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .section h2 { font-size: 20px; margin-bottom: 20px; color: #333; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f8f9fa; padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #dee2e6; }
        td { padding: 12px; border-bottom: 1px solid #dee2e6; }
        tr:hover { background: #f8f9fa; }
        .badge { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        .badge-critical { background: #dc3545; color: white; }
        .badge-high { background: #ffc107; color: #333; }
        .badge-medium { background: #007bff; color: white; }
        .badge-low { background: #28a745; color: white; }
        .error-snippet { background: #2d2d2d; color: #f8f8f2; padding: 15px; border-radius: 8px; font-family: 'Fira Code', monospace; font-size: 13px; overflow-x: auto; margin: 10px 0; white-space: pre-wrap; }
        .error-meta { font-size: 12px; color: #666; margin-bottom: 5px; }
        .score-bar { height: 8px; background: #e9ecef; border-radius: 4px; overflow: hidden; margin-top: 5px; }
        .score-bar-fill { height: 100%; border-radius: 4px; }
        .footer { text-align: center; color: #666; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔍 GitHub Actions 矩阵抖动分析报告</h1>
        <div class="subtitle">生成时间: ${new Date().toLocaleString('zh-CN')}</div>
    </div>

    <div class="summary-cards">
        <div class="card">
            <div class="value">${analysis.summary.totalLogs}</div>
            <div class="label">总日志数</div>
        </div>
        <div class="card critical">
            <div class="value">${analysis.summary.totalFailed}</div>
            <div class="label">失败次数</div>
        </div>
        <div class="card">
            <div class="value">${(analysis.summary.overallFailureRate * 100).toFixed(1)}%</div>
            <div class="label">总体失败率</div>
        </div>
        <div class="card critical">
            <div class="value">${analysis.summary.criticalGroups}</div>
            <div class="label">CRITICAL 级别</div>
        </div>
        <div class="card high">
            <div class="value">${analysis.summary.highGroups}</div>
            <div class="label">HIGH 级别</div>
        </div>
        <div class="card">
            <div class="value">${analysis.summary.totalReruns}</div>
            <div class="label">总重跑次数</div>
        </div>
    </div>

    ${analysis.summary.mostUnstable ? `
    <div class="section">
        <h2>⚠️ 最不稳定的矩阵组合</h2>
        <div style="font-size: 16px;">
            <strong>组合:</strong> ${JSON.stringify(analysis.summary.mostUnstable.matrix)}<br>
            <strong>抖动分数:</strong> ${analysis.summary.mostUnstable.flakeScore.toFixed(1)}<br>
            <strong>级别:</strong> <span class="badge badge-${analysis.summary.mostUnstable.flakeLevel.toLowerCase()}">${analysis.summary.mostUnstable.flakeLevel}</span>
        </div>
    </div>
    ` : ''}

    <div class="section">
        <h2>📊 矩阵组合详细统计</h2>
        <table>
            <thead>
                <tr>
                    <th>矩阵组合</th>
                    <th>总次数</th>
                    <th>失败</th>
                    <th>失败率</th>
                    <th>平均重跑</th>
                    <th>抖动分数</th>
                    <th>级别</th>
                </tr>
            </thead>
            <tbody>
                ${analysis.groups.map(g => `
                <tr>
                    <td><code>${JSON.stringify(g.matrix)}</code></td>
                    <td>${g.totalRuns}</td>
                    <td>${g.failedRuns}</td>
                    <td>${(g.failureRate * 100).toFixed(1)}%</td>
                    <td>${g.avgReruns.toFixed(2)}</td>
                    <td>
                        ${g.flakeScore.toFixed(1)}
                        <div class="score-bar">
                            <div class="score-bar-fill" style="width: ${g.flakeScore}%; background: ${
                                g.flakeScore >= 70 ? '#dc3545' : 
                                g.flakeScore >= 40 ? '#ffc107' : 
                                g.flakeScore >= 20 ? '#007bff' : '#28a745'
                            }"></div>
                        </div>
                    </td>
                    <td><span class="badge badge-${g.flakeLevel.toLowerCase()}">${g.flakeLevel}</span></td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <div class="section">
        <h2>🔍 失败详情样本</h2>
        ${analysis.groups.filter(g => g.failureSnippets.length > 0).slice(0, 5).map(g => `
        <div style="margin-bottom: 25px;">
            <h3 style="margin-bottom: 10px; color: #333;">${JSON.stringify(g.matrix)}</h3>
            ${g.failureSnippets.slice(0, 3).map(s => `
            <div class="error-meta">📁 文件: ${s.logFile} | 行号: ${s.lineNumber}</div>
            <div class="error-snippet">${this.escapeHtml(s.snippet)}</div>
            `).join('')}
        </div>
        `).join('')}
    </div>

    <div class="footer">
        <p>由 matrix-flake CLI 工具生成 | GitHub Actions Matrix Flake Analyzer</p>
    </div>
</body>
</html>`;

    fs.writeFileSync(filePath, html);
  }

  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }
}

module.exports = { Reporter };
