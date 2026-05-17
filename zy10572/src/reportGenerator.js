const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

function analyzeLines(text, charCleaner) {
  const lines = text.split(/\r?\n/);
  const badLines = [];
  const lineIssues = [];

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const invisibleChars = charCleaner.findInvisibleChars(line);
    const mojibake = charCleaner.findMojibake(line);
    const fullwidth = charCleaner.replaceFullwidthChars(line).replacements;

    const hasIssues = invisibleChars.length > 0 || mojibake.length > 0 || fullwidth.length > 0;
    
    if (hasIssues) {
      lineIssues.push({
        lineNumber,
        original: line,
        invisibleChars,
        mojibake,
        fullwidth,
        issueCount: invisibleChars.length + mojibake.length + fullwidth.length
      });
    }

    const hasTooManyIssues = (invisibleChars.length + mojibake.length) > 10;
    const isCorrupted = mojibake.length > 5;
    
    if (hasTooManyIssues || isCorrupted) {
      badLines.push({
        lineNumber,
        reason: hasTooManyIssues ? '异常字符过多' : '乱码严重',
        original: line
      });
    }
  });

  return { lines, badLines, lineIssues, totalLines: lines.length };
}

function generateTerminalSummary(result, filePath) {
  const { encodingInfo, cleanResult, lineAnalysis } = result;
  const fileName = path.basename(filePath);

  console.log('\n' + chalk.bold.blue('='.repeat(60)));
  console.log(chalk.bold.blue(`  文本编码修复报告 - ${fileName}`));
  console.log(chalk.bold.blue('='.repeat(60)) + '\n');

  console.log(chalk.bold('📊 编码检测结果:'));
  console.log(`  检测到编码: ${chalk.green(encodingInfo.encoding)}`);
  console.log(`  置信度: ${chalk.yellow((encodingInfo.confidence * 100).toFixed(0) + '%')}`);
  const candidates = Array.isArray(encodingInfo.candidates) 
    ? encodingInfo.candidates.map(c => typeof c === 'object' ? c.name : c).join(', ')
    : String(encodingInfo.candidates);
  console.log(`  候选编码: ${candidates}\n`);

  console.log(chalk.bold('🔍 字符问题统计:'));
  console.log(`  不可见字符: ${chalk.red(cleanResult.stats.invisibleCount + ' 个')}`);
  console.log(`  乱码字符: ${chalk.red(cleanResult.stats.mojibakeCount + ' 个')}`);
  console.log(`  全角字符: ${chalk.yellow(cleanResult.stats.fullwidthCount + ' 个')}\n`);

  console.log(chalk.bold('📄 行分析结果:'));
  console.log(`  总行数: ${chalk.blue(lineAnalysis.totalLines)}`);
  console.log(`  问题行数: ${chalk.yellow(lineAnalysis.lineIssues.length)}`);
  console.log(`  坏行数: ${chalk.red(lineAnalysis.badLines.length)}\n`);

  if (lineAnalysis.badLines.length > 0) {
    console.log(chalk.bold('⚠️  坏行列表 (已保留原始位置):'));
    lineAnalysis.badLines.slice(0, 5).forEach(bad => {
      console.log(`  行${bad.lineNumber}: ${chalk.gray(bad.reason)}`);
    });
    if (lineAnalysis.badLines.length > 5) {
      console.log(`  ...还有 ${lineAnalysis.badLines.length - 5} 个坏行\n`);
    }
  }

  console.log(chalk.bold.green('✅ 修复完成!'));
  console.log(chalk.gray('='.repeat(60)) + '\n');
}

function generateJsonResult(result, filePath) {
  return {
    fileName: path.basename(filePath),
    filePath: filePath,
    timestamp: new Date().toISOString(),
    encoding: result.encodingInfo,
    stats: result.cleanResult.stats,
    lineAnalysis: {
      totalLines: result.lineAnalysis.totalLines,
      badLineCount: result.lineAnalysis.badLines.length,
      issueLineCount: result.lineAnalysis.lineIssues.length,
      badLines: result.lineAnalysis.badLines,
      lineIssues: result.lineAnalysis.lineIssues.slice(0, 50)
    },
    issues: {
      invisibleChars: result.cleanResult.issues.invisibleChars.slice(0, 50),
      mojibake: result.cleanResult.issues.mojibake.slice(0, 50),
      fullwidthChars: result.cleanResult.issues.fullwidthChars.slice(0, 50)
    }
  };
}

function generateHtmlReport(result, filePath, outputDir) {
  const { encodingInfo, cleanResult, lineAnalysis } = result;
  const fileName = path.basename(filePath);
  
  const badLinesHtml = lineAnalysis.badLines.map(bad => `
    <tr>
      <td>${bad.lineNumber}</td>
      <td>${bad.reason}</td>
      <td><code>${escapeHtml(bad.original.substring(0, 100))}</code></td>
    </tr>
  `).join('');

  const lineIssuesHtml = lineAnalysis.lineIssues.slice(0, 20).map(issue => `
    <tr>
      <td>${issue.lineNumber}</td>
      <td>
        ${issue.invisibleChars.length > 0 ? `<span class="badge badge-danger">不可见: ${issue.invisibleChars.length}</span> ` : ''}
        ${issue.mojibake.length > 0 ? `<span class="badge badge-warning">乱码: ${issue.mojibake.length}</span> ` : ''}
        ${issue.fullwidth.length > 0 ? `<span class="badge badge-info">全角: ${issue.fullwidth.length}</span>` : ''}
      </td>
      <td><code>${escapeHtml(issue.original.substring(0, 100))}</code></td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>文本编码修复报告 - ${fileName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 20px; }
    .header h1 { font-size: 24px; margin-bottom: 10px; }
    .header p { opacity: 0.9; }
    .card { background: white; border-radius: 10px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .card h2 { font-size: 18px; margin-bottom: 15px; color: #333; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
    .stat-box { padding: 15px; border-radius: 8px; text-align: center; }
    .stat-box .number { font-size: 32px; font-weight: bold; }
    .stat-box .label { font-size: 14px; color: #666; margin-top: 5px; }
    .stat-danger { background: #fff5f5; }
    .stat-danger .number { color: #e53e3e; }
    .stat-warning { background: #fffaf0; }
    .stat-warning .number { color: #dd6b20; }
    .stat-info { background: #ebf8ff; }
    .stat-info .number { color: #3182ce; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
    th { background: #f7fafc; font-weight: 600; color: #4a5568; }
    tr:hover { background: #f7fafc; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; margin-right: 4px; }
    .badge-danger { background: #fed7d7; color: #c53030; }
    .badge-warning { background: #feebc8; color: #c05621; }
    .badge-info { background: #bee3f8; color: #2b6cb0; }
    code { background: #f7fafc; padding: 2px 6px; border-radius: 4px; font-family: 'SFMono-Regular', monospace; font-size: 12px; }
    .footer { text-align: center; color: #718096; margin-top: 30px; padding: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>📋 文本编码修复报告</h1>
    <p>文件名: ${fileName} | 生成时间: ${new Date().toLocaleString('zh-CN')}</p>
  </div>

  <div class="card">
    <h2>🔍 编码检测结果</h2>
    <div class="stats-grid">
      <div class="stat-box stat-info">
        <div class="number">${encodingInfo.encoding}</div>
        <div class="label">检测到的编码</div>
      </div>
      <div class="stat-box stat-info">
        <div class="number">${(encodingInfo.confidence * 100).toFixed(0)}%</div>
        <div class="label">置信度</div>
      </div>
    </div>
  </div>

  <div class="card">
    <h2>📊 问题统计</h2>
    <div class="stats-grid">
      <div class="stat-box stat-danger">
        <div class="number">${cleanResult.stats.invisibleCount}</div>
        <div class="label">不可见字符</div>
      </div>
      <div class="stat-box stat-danger">
        <div class="number">${cleanResult.stats.mojibakeCount}</div>
        <div class="label">乱码字符</div>
      </div>
      <div class="stat-box stat-warning">
        <div class="number">${cleanResult.stats.fullwidthCount}</div>
        <div class="label">全角字符</div>
      </div>
    </div>
  </div>

  <div class="card">
    <h2>📄 行分析</h2>
    <div class="stats-grid">
      <div class="stat-box stat-info">
        <div class="number">${lineAnalysis.totalLines}</div>
        <div class="label">总行数</div>
      </div>
      <div class="stat-box stat-warning">
        <div class="number">${lineAnalysis.lineIssues.length}</div>
        <div class="label">问题行数</div>
      </div>
      <div class="stat-box stat-danger">
        <div class="number">${lineAnalysis.badLines.length}</div>
        <div class="label">坏行数</div>
      </div>
    </div>
  </div>

  ${lineAnalysis.badLines.length > 0 ? `
  <div class="card">
    <h2>⚠️ 坏行列表 (保留原始位置)</h2>
    <table>
      <thead>
        <tr><th>行号</th><th>原因</th><th>内容预览</th></tr>
      </thead>
      <tbody>${badLinesHtml}</tbody>
    </table>
  </div>
  ` : ''}

  ${lineAnalysis.lineIssues.length > 0 ? `
  <div class="card">
    <h2>🔧 问题行详情 (前20条)</h2>
    <table>
      <thead>
        <tr><th>行号</th><th>问题类型</th><th>内容预览</th></tr>
      </thead>
      <tbody>${lineIssuesHtml}</tbody>
    </table>
  </div>
  ` : ''}

  <div class="footer">
    <p>此报告由文本编码修复CLI工具生成 | ${new Date().toLocaleString('zh-CN')}</p>
  </div>
</body>
</html>`;

  return html;
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function saveReports(result, filePath, outputDir, timestamp) {
  const fileName = path.basename(filePath, path.extname(filePath));
  const baseName = `${fileName}_${timestamp}`;

  const jsonResult = generateJsonResult(result, filePath);
  const jsonPath = path.join(outputDir, `${baseName}_result.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(jsonResult, null, 2), 'utf8');

  const htmlReport = generateHtmlReport(result, filePath, outputDir);
  const htmlPath = path.join(outputDir, `${baseName}_report.html`);
  fs.writeFileSync(htmlPath, htmlReport, 'utf8');

  const cleanedPath = path.join(outputDir, `${baseName}_cleaned.txt`);
  fs.writeFileSync(cleanedPath, result.cleanResult.cleaned, 'utf8');

  if (result.lineAnalysis.badLines.length > 0) {
    const badLinesContent = result.lineAnalysis.badLines
      .map(b => `行${b.lineNumber} [${b.reason}]: ${b.original}`)
      .join('\n');
    const badLinesPath = path.join(outputDir, `${baseName}_badlines.txt`);
    fs.writeFileSync(badLinesPath, badLinesContent, 'utf8');
  }

  return {
    jsonPath,
    htmlPath,
    cleanedPath,
    badLinesPath: result.lineAnalysis.badLines.length > 0 ? path.join(outputDir, `${baseName}_badlines.txt`) : null
  };
}

module.exports = {
  analyzeLines,
  generateTerminalSummary,
  generateJsonResult,
  generateHtmlReport,
  saveReports
};
