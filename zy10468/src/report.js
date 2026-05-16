import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';

export async function generateReport(result, config, outputDir) {
  const reports = {};

  if (config.output.formats.includes('terminal')) {
    reports.terminal = generateTerminalReport(result);
  }

  if (config.output.formats.includes('json')) {
    const jsonPath = path.join(outputDir, 'report.json');
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(jsonPath, JSON.stringify(result, null, 2));
    reports.json = jsonPath;
  }

  if (config.output.formats.includes('html')) {
    const htmlPath = path.join(outputDir, 'report.html');
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(htmlPath, generateHtmlReport(result));
    reports.html = htmlPath;
  }

  return reports;
}

function generateTerminalReport(result) {
  const lines = [];
  
  lines.push('');
  lines.push(chalk.bold('═'.repeat(60)));
  lines.push(chalk.bold('            MONOREPO 边界检查报告'));
  lines.push(chalk.bold('═'.repeat(60)));
  lines.push('');

  lines.push(chalk.cyan('📦 扫描摘要'));
  lines.push(`   包数量: ${result.summary.packageCount}`);
  lines.push(`   文件数量: ${result.summary.fileCount}`);
  lines.push(`   跨包依赖数量: ${result.summary.dependencyCount}`);
  lines.push('');

  lines.push(chalk.cyan('⚠️  违规统计'));
  lines.push(`   边界违规: ${result.summary.violationCount}`);
  lines.push(`   循环依赖: ${result.summary.cycleCount}`);
  lines.push('');

  if (result.violations.length > 0) {
    lines.push(chalk.red('❌ 边界违规详情'));
    lines.push('');
    
    const grouped = {};
    for (const v of result.violations) {
      const key = `${v.from}->${v.to}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(v);
    }

    for (const [key, items] of Object.entries(grouped)) {
      lines.push(`   ${chalk.red(key)}: ${items.length} 处违规`);
      for (const item of items.slice(0, 3)) {
        lines.push(`     - ${chalk.gray(item.relativeFile)}:${item.line}`);
        lines.push(`       ${chalk.dim(item.source)}`);
      }
      if (items.length > 3) {
        lines.push(`     ... 还有 ${items.length - 3} 处`);
      }
      lines.push('');
    }
  }

  if (result.cycles.length > 0) {
    lines.push(chalk.yellow('🔄 循环依赖'));
    for (const cycle of result.cycles) {
      lines.push(`   ${cycle.join(' → ')}`);
    }
    lines.push('');
  }

  if (result.summary.violationCount === 0 && result.summary.cycleCount === 0) {
    lines.push(chalk.green('✅ 所有检查通过！'));
    lines.push('');
  }

  lines.push(chalk.dim('─'.repeat(60)));
  lines.push(chalk.dim(`报告生成时间: ${new Date().toLocaleString()}`));
  lines.push('');

  return lines.join('\n');
}

function generateHtmlReport(result) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Monorepo 边界检查报告</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 20px; }
    .header h1 { font-size: 28px; margin-bottom: 10px; }
    .header p { opacity: 0.9; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
    .summary-card { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .summary-card .value { font-size: 36px; font-weight: bold; color: #333; }
    .summary-card .label { color: #666; margin-top: 5px; }
    .summary-card.error .value { color: #e53e3e; }
    .summary-card.warning .value { color: #d69e2e; }
    .section { background: white; border-radius: 12px; padding: 24px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .section h2 { font-size: 20px; margin-bottom: 16px; color: #333; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
    .violation-item { padding: 16px; background: #fff5f5; border-left: 4px solid #e53e3e; margin-bottom: 12px; border-radius: 0 8px 8px 0; }
    .violation-header { font-weight: 600; color: #c53030; margin-bottom: 8px; }
    .violation-location { font-family: 'SF Mono', Monaco, monospace; font-size: 13px; color: #666; margin-bottom: 8px; }
    .violation-code { background: #2d3748; color: #e2e8f0; padding: 10px 14px; border-radius: 6px; font-family: 'SF Mono', Monaco, monospace; font-size: 13px; overflow-x: auto; }
    .violation-reason { color: #742a2a; margin-top: 8px; font-size: 14px; }
    .cycle-item { padding: 14px; background: #fffbeb; border-left: 4px solid #d69e2e; margin-bottom: 10px; border-radius: 0 8px 8px 0; font-family: 'SF Mono', Monaco, monospace; color: #744210; }
    .timestamp { text-align: center; color: #999; font-size: 13px; margin-top: 20px; }
    .empty-state { text-align: center; padding: 40px; color: #999; }
    .empty-state .icon { font-size: 48px; margin-bottom: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔐 Monorepo 边界检查报告</h1>
      <p>保护你的代码架构，防止边界被打穿</p>
    </div>

    <div class="summary-grid">
      <div class="summary-card">
        <div class="value">${result.summary.packageCount}</div>
        <div class="label">📦 扫描的包数量</div>
      </div>
      <div class="summary-card">
        <div class="value">${result.summary.fileCount}</div>
        <div class="label">📄 扫描的文件数量</div>
      </div>
      <div class="summary-card">
        <div class="value">${result.summary.dependencyCount}</div>
        <div class="label">🔗 跨包依赖数量</div>
      </div>
      <div class="summary-card ${result.summary.violationCount > 0 ? 'error' : ''}">
        <div class="value">${result.summary.violationCount}</div>
        <div class="label">❌ 边界违规数量</div>
      </div>
      <div class="summary-card ${result.summary.cycleCount > 0 ? 'warning' : ''}">
        <div class="value">${result.summary.cycleCount}</div>
        <div class="label">🔄 循环依赖数量</div>
      </div>
    </div>

    ${result.violations.length > 0 ? `
    <div class="section">
      <h2>❌ 边界违规详情</h2>
      ${result.violations.map(v => `
        <div class="violation-item">
          <div class="violation-header">${v.from} → ${v.to}</div>
          <div class="violation-location">📁 ${v.relativeFile}:${v.line}</div>
          <div class="violation-code">${escapeHtml(v.source)}</div>
          <div class="violation-reason">💡 ${escapeHtml(v.reason)}</div>
        </div>
      `).join('')}
    </div>
    ` : `
    <div class="section">
      <div class="empty-state">
        <div class="icon">✅</div>
        <div>没有发现边界违规！</div>
      </div>
    </div>
    `}

    ${result.cycles.length > 0 ? `
    <div class="section">
      <h2>🔄 循环依赖</h2>
      ${result.cycles.map(c => `
        <div class="cycle-item">
          ${c.join(' → ')}
        </div>
      `).join('')}
    </div>
    ` : ''}

    <div class="timestamp">
      报告生成时间: ${new Date().toLocaleString()}
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
