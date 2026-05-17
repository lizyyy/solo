const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const Table = require('cli-table3');
const { ensureDir, formatSize, formatPercent, getTimestamp } = require('./utils');

class Reporter {
  constructor(config) {
    this.config = config;
    this.timestamp = getTimestamp();
  }

  generateAll(result, comparison) {
    ensureDir(this.config.outputDir);

    const terminalReport = this.generateTerminalReport(result, comparison);
    const jsonReport = this.generateJsonReport(result, comparison);
    const htmlReport = this.generateHtmlReport(result, comparison);

    const baseName = `${this.config.reportName}-${this.timestamp}`;
    
    const jsonPath = path.join(this.config.outputDir, `${baseName}.json`);
    const htmlPath = path.join(this.config.outputDir, `${baseName}.html`);
    
    fs.writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2), 'utf-8');
    fs.writeFileSync(htmlPath, htmlReport, 'utf-8');

    const latestJson = path.join(this.config.outputDir, 'latest.json');
    const latestHtml = path.join(this.config.outputDir, 'latest.html');
    fs.writeFileSync(latestJson, JSON.stringify(jsonReport, null, 2), 'utf-8');
    fs.writeFileSync(latestHtml, htmlReport, 'utf-8');

    return {
      terminal: terminalReport,
      json: jsonPath,
      html: htmlPath
    };
  }

  generateTerminalReport(result, comparison) {
    console.log('\n' + chalk.cyan.bold('═'.repeat(80)));
    console.log(chalk.cyan.bold('                        📦 前端包体来源分析报告'));
    console.log(chalk.cyan.bold('═'.repeat(80)) + '\n');

    this.printSummary(result, comparison);
    this.printChunks(result);
    this.printDependencies(result);
    this.printComparison(comparison);
    this.printAnomalies(result);

    console.log('\n' + chalk.cyan('详细报告已生成: ') + this.config.outputDir);
    console.log(chalk.cyan('═'.repeat(80)) + '\n');
  }

  printSummary(result, comparison) {
    const { summary } = result;
    
    console.log(chalk.bold('📊 总体统计'));
    console.log(chalk.gray('─'.repeat(50)));
    
    const summaryTable = new Table({
      head: ['指标', '数值'],
      colWidths: [30, 30]
    });

    summaryTable.push(
      ['Chunks 总数', summary.totalChunks],
      ['模块总数', summary.totalModules],
      ['依赖包总数', summary.dependenciesCount],
      ['总大小', formatSize(summary.totalSize)],
      ['Gzip 后大小', summary.totalGzippedSize ? formatSize(summary.totalGzippedSize) : 'N/A']
    );

    if (comparison.hasComparison) {
      const diffStr = comparison.totals.diff >= 0 
        ? chalk.red(`+${formatSize(comparison.totals.diff)}`)
        : chalk.green(`-${formatSize(Math.abs(comparison.totals.diff))}`);
      summaryTable.push(['较上次变化', diffStr]);
    }

    console.log(summaryTable.toString() + '\n');
  }

  printChunks(result) {
    console.log(chalk.bold('📁 最大 Chunks (前 10 个)'));
    console.log(chalk.gray('─'.repeat(60)));

    const chunksTable = new Table({
      head: ['名称', '大小', '占比'],
      colWidths: [35, 15, 10]
    });

    const topChunks = result.chunks.slice(0, 10);
    topChunks.forEach(chunk => {
      const percent = chunk.size / result.summary.totalSize;
      const sizeColor = chunk.size > 500 * 1024 ? chalk.red : chalk.yellow;
      chunksTable.push([
        chunk.name,
        sizeColor(formatSize(chunk.size)),
        formatPercent(percent)
      ]);
    });

    console.log(chunksTable.toString() + '\n');
  }

  printDependencies(result) {
    console.log(chalk.bold('📦 依赖包体积排名 (前 15 个)'));
    console.log(chalk.gray('─'.repeat(70)));

    const depsTable = new Table({
      head: ['依赖包', '大小', '模块数', 'Chunks', '占比'],
      colWidths: [30, 12, 10, 8, 8]
    });

    const topDeps = result.dependenciesArray.slice(0, 15);
    topDeps.forEach(dep => {
      const percent = dep.size / result.summary.totalSize;
      const sizeColor = dep.size > 100 * 1024 ? chalk.red : chalk.white;
      depsTable.push([
        dep.name,
        sizeColor(formatSize(dep.size)),
        dep.modulesCount,
        dep.chunksCount,
        formatPercent(percent)
      ]);
    });

    console.log(depsTable.toString() + '\n');
  }

  printComparison(comparison) {
    if (!comparison.hasComparison) {
      console.log(chalk.gray('ℹ 暂无历史数据可对比，本次为首次分析\n'));
      return;
    }

    console.log(chalk.bold(`🔄 历史对比 (vs ${comparison.previousTimestamp})`));
    console.log(chalk.gray('─'.repeat(70)));

    if (comparison.newDependencies.length > 0) {
      console.log(chalk.green.bold(`\n✅ 新增依赖 (${comparison.newDependencies.length}个):`));
      comparison.newDependencies.slice(0, 5).forEach(dep => {
        console.log(`   + ${dep.name} (${formatSize(dep.currentSize)})`);
      });
    }

    if (comparison.increasedDependencies.length > 0) {
      console.log(chalk.red.bold(`\n⚠ 体积增加的依赖 (前 5 个):`));
      comparison.increasedDependencies.slice(0, 5).forEach(dep => {
        console.log(`   ▲ ${dep.name} (+${formatSize(dep.diff)}, +${formatPercent(dep.diffPercent)})`);
      });
    }

    if (comparison.decreasedDependencies.length > 0) {
      console.log(chalk.green.bold(`\n✅ 体积减少的依赖 (前 5 个):`));
      comparison.decreasedDependencies.slice(0, 5).forEach(dep => {
        console.log(`   ▼ ${dep.name} (-${formatSize(Math.abs(dep.diff))}, ${formatPercent(dep.diffPercent)})`);
      });
    }

    if (comparison.removedDependencies.length > 0) {
      console.log(chalk.gray.bold(`\n🗑  已移除的依赖 (${comparison.removedDependencies.length}个):`));
      comparison.removedDependencies.slice(0, 5).forEach(dep => {
        console.log(`   - ${dep.name}`);
      });
    }

    console.log('');
  }

  printAnomalies(result) {
    if (result.anomalies.length === 0) return;

    console.log(chalk.yellow.bold('⚠ 异常记录'));
    console.log(chalk.gray('─'.repeat(60)));

    result.anomalies.forEach(anomaly => {
      console.log(chalk.yellow(`  文件: ${anomaly.file}`));
      console.log(chalk.gray(`   类型: ${anomaly.type}`));
      console.log(chalk.gray(`   原因: ${anomaly.reason}`));
      console.log('');
    });
  }

  generateJsonReport(result, comparison) {
    return {
      version: '1.0',
      timestamp: new Date().toISOString(),
      summary: result.summary,
      comparison: comparison.hasComparison ? {
        previousTimestamp: comparison.previousTimestamp,
        totals: comparison.totals,
        topChanges: comparison.changes.slice(0, 50)
      } : null,
      chunks: result.chunks.slice(0, 50).map(c => ({
        name: c.name,
        relativePath: c.relativePath,
        size: c.size,
        gzippedSize: c.gzippedSize
      })),
      dependencies: result.dependenciesArray.slice(0, 100).map(d => ({
        name: d.name,
        size: d.size,
        modulesCount: d.modulesCount,
        chunksCount: d.chunksCount,
        isExternal: d.isExternal
      })),
      topModules: result.modules.slice(0, 50).map(m => ({
        path: m.path,
        name: m.name,
        package: m.package,
        chunk: m.chunk,
        size: m.size
      })),
      anomalies: result.anomalies,
      config: {
        inputDir: this.config.inputDir,
        outputDir: this.config.outputDir
      }
    };
  }

  generateHtmlReport(result, comparison) {
    const { summary } = result;
    
    const depsRows = result.dependenciesArray.slice(0, 30).map(dep => {
      const percent = ((dep.size / summary.totalSize) * 100).toFixed(1);
      return `
        <tr>
          <td><code>${dep.name}</code></td>
          <td>${formatSize(dep.size)}</td>
          <td>${dep.modulesCount}</td>
          <td>${dep.chunksCount}</td>
          <td>
            <div style="background:#e0e0e0;border-radius:4px;height:20px;width:100px;">
              <div style="background:#4CAF50;height:100%;width:${Math.min(percent * 2, 100)}%;border-radius:4px;"></div>
            </div>
            <small>${percent}%</small>
          </td>
        </tr>
      `;
    }).join('');

    const comparisonSection = comparison.hasComparison ? `
      <div class="section">
        <h2>🔄 历史对比</h2>
        <p>对比时间: ${comparison.previousTimestamp}</p>
        <p>总体变化: <strong style="color:${comparison.totals.diff >= 0 ? '#f44336' : '#4CAF50'}">${comparison.totals.diff >= 0 ? '+' : ''}${formatSize(comparison.totals.diff)}</strong> (${(comparison.totals.diffPercent * 100).toFixed(2)}%)</p>
        
        ${comparison.newDependencies.length > 0 ? `
          <h3>✅ 新增依赖 (${comparison.newDependencies.length}个)</h3>
          <ul>
            ${comparison.newDependencies.slice(0, 10).map(d => `
              <li><code>${d.name}</code> - ${formatSize(d.currentSize)}</li>
            `).join('')}
          </ul>
        ` : ''}
        
        ${comparison.increasedDependencies.length > 0 ? `
          <h3>⚠ 体积增加的依赖 (前 10 个)</h3>
          <ul>
            ${comparison.increasedDependencies.slice(0, 10).map(d => `
              <li><code>${d.name}</code> - +${formatSize(d.diff)} (${(d.diffPercent * 100).toFixed(1)}%)</li>
            `).join('')}
          </ul>
        ` : ''}
      </div>
    ` : '<p>ℹ 暂无历史数据可对比，本次为首次分析</p>';

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>📦 包体来源分析报告</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 20px; }
    .header h1 { font-size: 28px; margin-bottom: 10px; }
    .header .meta { opacity: 0.9; }
    .section { background: white; padding: 25px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .section h2 { font-size: 20px; margin-bottom: 15px; color: #333; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
    .section h3 { font-size: 16px; margin: 20px 0 10px; color: #555; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
    .stat-card { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; }
    .stat-card .value { font-size: 24px; font-weight: bold; color: #667eea; }
    .stat-card .label { font-size: 12px; color: #666; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e0e0e0; }
    th { background: #f8f9fa; font-weight: 600; }
    tr:hover { background: #fafafa; }
    code { background: #f0f0f0; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
    ul { padding-left: 25px; }
    li { margin: 8px 0; }
    .anomaly { background: #fff3cd; padding: 15px; border-radius: 8px; margin-top: 10px; }
    .anomaly .reason { color: #856404; font-family: monospace; }
  </style>
</head>
<body>
  <div class="header">
    <h1>📦 前端包体来源分析报告</h1>
    <div class="meta">
      生成时间: ${new Date().toLocaleString('zh-CN')} | 
      分析目录: ${this.config.inputDir}
    </div>
  </div>

  <div class="section">
    <h2>📊 总体统计</h2>
    <div class="stats-grid">
      <div class="stat-card"><div class="value">${summary.totalChunks}</div><div class="label">Chunks 总数</div></div>
      <div class="stat-card"><div class="value">${summary.totalModules}</div><div class="label">模块总数</div></div>
      <div class="stat-card"><div class="value">${summary.dependenciesCount}</div><div class="label">依赖包总数</div></div>
      <div class="stat-card"><div class="value">${formatSize(summary.totalSize)}</div><div class="label">总大小</div></div>
      ${summary.totalGzippedSize ? `<div class="stat-card"><div class="value">${formatSize(summary.totalGzippedSize)}</div><div class="label">Gzip 后</div></div>` : ''}
    </div>
  </div>

  ${comparisonSection}

  <div class="section">
    <h2>📦 依赖包体积排名 (前 30 个)</h2>
    <table>
      <thead>
        <tr><th>依赖包</th><th>大小</th><th>模块数</th><th>Chunks</th><th>占比</th></tr>
      </thead>
      <tbody>${depsRows}</tbody>
    </table>
  </div>

  ${result.anomalies.length > 0 ? `
    <div class="section">
      <h2>⚠ 异常记录</h2>
      ${result.anomalies.map(a => `
        <div class="anomaly">
          <div><strong>文件:</strong> <code>${a.file}</code></div>
          <div><strong>类型:</strong> ${a.type}</div>
          <div class="reason"><strong>原因:</strong> ${a.reason}</div>
        </div>
      `).join('')}
    </div>
  ` : ''}
</body>
</html>`;
  }
}

module.exports = Reporter;
