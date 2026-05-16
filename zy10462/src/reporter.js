const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

function printTerminalSummary(analysis, fixPreview = null) {
  console.log(chalk.bold('📊 检测摘要\n'));
  
  console.log(chalk.blue('📁 文件统计:'));
  console.log(`   扫描文件数: ${chalk.cyan(analysis.files.length)}`);
  console.log(`   标题锚点数: ${chalk.cyan(Object.values(analysis.allAnchors).reduce((sum, a) => sum + a.length, 0))}`);
  console.log();
  
  console.log(chalk.blue('🔗 链接统计:'));
  console.log(`   有效链接数: ${chalk.green(analysis.validLinks.length)}`);
  console.log(`   断链数量: ${chalk.red(analysis.brokenLinks.length)}`);
  console.log(`   无法处理: ${chalk.yellow(analysis.unhandledLinks.length)}`);
  console.log();
  
  if (analysis.brokenLinks.length > 0) {
    console.log(chalk.red('❌ 断链详情:\n'));
    
    const groupedByFile = {};
    for (const link of analysis.brokenLinks) {
      if (!groupedByFile[link.file]) {
        groupedByFile[link.file] = [];
      }
      groupedByFile[link.file].push(link);
    }
    
    for (const [file, links] of Object.entries(groupedByFile)) {
      console.log(chalk.underline(`📄 ${path.relative(process.cwd(), file)}`));
      for (const link of links) {
        const lineInfo = chalk.gray(`[${link.line}:${link.column}]`);
        const targetFile = link.targetFile ? path.relative(process.cwd(), link.targetFile) : '未知';
        
        console.log(`   ${lineInfo} ${chalk.red(link.raw)}`);
        console.log(`      → 目标: ${targetFile}#${link.targetAnchor}`);
        
        if (link.suggestedFix) {
          const confidence = link.suggestedFix.confidence > 70 ? chalk.green : chalk.yellow;
          console.log(`      ${chalk.blue('💡 建议:')} ${confidence(`${link.suggestedFix.confidence}%`)} 可能是 "${chalk.cyan(link.suggestedFix.newTitle)}"`);
          console.log(`         新链接: #${link.suggestedFix.newAnchor}`);
        }
        console.log();
      }
    }
  }
  
  if (fixPreview && fixPreview.fixPreviews.length > 0) {
    console.log(chalk.bold('🔧 修复预览:\n'));
    console.log(`   可自动修复: ${chalk.green(fixPreview.fixPreviews.length)} 处`);
    console.log();
    
    for (const preview of fixPreview.fixPreviews.slice(0, 10)) {
      const relativePath = path.relative(process.cwd(), preview.file);
      console.log(`📄 ${relativePath}:${preview.line}`);
      console.log(`   - ${chalk.red(preview.oldLink)}`);
      console.log(`   + ${chalk.green(preview.newLink)}`);
      console.log();
    }
    
    if (fixPreview.fixPreviews.length > 10) {
      console.log(chalk.gray(`   ... 还有 ${fixPreview.fixPreviews.length - 10} 处修复预览未显示\n`));
    }
  }
  
  if (analysis.unhandledLinks.length > 0) {
    console.log(chalk.yellow('⚠️  无法处理的链接:\n'));
    
    for (const link of analysis.unhandledLinks) {
      const relativePath = path.relative(process.cwd(), link.file);
      console.log(`   📄 ${relativePath}:${link.line} ${chalk.yellow(link.raw)}`);
      console.log(`      原因: ${link.reason}`);
      console.log();
    }
  }
}

function prepareOutputDir(outputDir, clean = true) {
  if (clean && fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  return outputDir;
}

function writeJsonReport(analysis, outputDir, options = {}) {
  const reportPath = path.join(outputDir, 'report.json');
  
  const report = {
    meta: {
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
      inputPath: options.input,
      pattern: options.pattern,
      exclude: options.exclude
    },
    summary: {
      totalFiles: analysis.files.length,
      totalAnchors: Object.values(analysis.allAnchors).reduce((sum, a) => sum + a.length, 0),
      validLinks: analysis.validLinks.length,
      brokenLinks: analysis.brokenLinks.length,
      unhandledLinks: analysis.unhandledLinks.length
    },
    brokenLinks: analysis.brokenLinks.map(link => ({
      file: link.file,
      line: link.line,
      column: link.column,
      linkText: link.text,
      linkUrl: link.url,
      targetFile: link.targetFile,
      targetAnchor: link.targetAnchor,
      suggestedFix: link.suggestedFix,
      availableAnchors: link.availableAnchors
    })),
    unhandledLinks: analysis.unhandledLinks,
    files: analysis.files,
    allAnchors: analysis.allAnchors
  };
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  return reportPath;
}

function writeMarkdownReport(analysis, outputDir, fixPreview = null, options = {}) {
  const reportPath = path.join(outputDir, 'README.md');
  
  let content = `# Markdown 锚点迁移报告

生成时间: ${new Date().toLocaleString('zh-CN')}

## 摘要

| 指标 | 数量 |
|------|------|
| 扫描文件 | ${analysis.files.length} |
| 标题锚点 | ${Object.values(analysis.allAnchors).reduce((sum, a) => sum + a.length, 0)} |
| 有效链接 | ${analysis.validLinks.length} |
| 断链数量 | ${analysis.brokenLinks.length} |
| 无法处理 | ${analysis.unhandledLinks.length} |

`;

  if (analysis.brokenLinks.length > 0) {
    content += `## 断链详情

`;
    
    const groupedByFile = {};
    for (const link of analysis.brokenLinks) {
      if (!groupedByFile[link.file]) {
        groupedByFile[link.file] = [];
      }
      groupedByFile[link.file].push(link);
    }
    
    for (const [file, links] of Object.entries(groupedByFile)) {
      const relativePath = path.relative(process.cwd(), file);
      content += `### ${relativePath}

| 行号 | 链接文本 | 目标锚点 | 建议修复 | 置信度 |
|------|----------|----------|----------|--------|
`;
      
      for (const link of links) {
        const suggestedText = link.suggestedFix 
          ? `[\`#${link.suggestedFix.newAnchor}\`](${link.targetFile}#${link.suggestedFix.newAnchor}) (${link.suggestedFix.newTitle})` 
          : '无';
        const confidence = link.suggestedFix ? `${link.suggestedFix.confidence}%` : '-';
        
        content += `| ${link.line} | \`${link.text || link.raw}\` | \`${link.targetAnchor}\` | ${suggestedText} | ${confidence} |
`;
      }
      content += `\n`;
    }
  }

  if (fixPreview && fixPreview.fixPreviews.length > 0) {
    content += `## 自动修复预览

共 ${fixPreview.fixPreviews.length} 处可自动修复:

`;
    
    for (const preview of fixPreview.fixPreviews) {
      const relativePath = path.relative(process.cwd(), preview.file);
      content += `### ${relativePath}:${preview.line}

- 原链接: \`${preview.oldLink}\`
- 新链接: \`${preview.newLink}\`
- 置信度: ${preview.confidence}%

`;
    }
  }
  
  if (analysis.unhandledLinks.length > 0) {
    content += `## 无法处理的链接

`;
    
    for (const link of analysis.unhandledLinks) {
      const relativePath = path.relative(process.cwd(), link.file);
      content += `- **${relativePath}:${link.line}**: \`${link.raw}\`
  - 原因: ${link.reason}

`;
    }
  }
  
  content += `---
*本报告由 Markdown 锚点迁移CLI工具自动生成*
`;
  
  fs.writeFileSync(reportPath, content, 'utf-8');
  return reportPath;
}

function writeHtmlReport(analysis, outputDir, options = {}) {
  const reportPath = path.join(outputDir, 'report.html');
  
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Markdown 锚点迁移报告</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 30px; }
    .header h1 { font-size: 28px; margin-bottom: 10px; }
    .header .time { opacity: 0.9; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px; }
    .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .card .number { font-size: 36px; font-weight: bold; margin-bottom: 5px; }
    .card .label { color: #666; font-size: 14px; }
    .card.success .number { color: #28a745; }
    .card.error .number { color: #dc3545; }
    .card.warning .number { color: #ffc107; }
    .card.info .number { color: #17a2b8; }
    .section { background: white; padding: 25px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .section h2 { font-size: 20px; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #667eea; }
    .file-group { margin-bottom: 25px; }
    .file-group h3 { font-size: 16px; margin-bottom: 15px; color: #333; }
    .broken-link { background: #fff5f5; border-left: 4px solid #dc3545; padding: 15px; margin-bottom: 10px; border-radius: 4px; }
    .link-location { font-size: 12px; color: #666; margin-bottom: 8px; }
    .link-raw { font-family: monospace; background: rgba(0,0,0,0.05); padding: 2px 6px; border-radius: 3px; }
    .link-target { margin: 8px 0; font-size: 14px; }
    .suggestion { background: #e8f5e9; border-left: 4px solid #28a745; padding: 12px; margin-top: 10px; border-radius: 4px; }
    .suggestion-label { font-weight: bold; color: #2e7d32; margin-bottom: 5px; }
    .confidence { display: inline-block; background: #28a745; color: white; padding: 2px 8px; border-radius: 10px; font-size: 12px; margin-left: 10px; }
    .confidence.medium { background: #ffc107; color: #333; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f8f9fa; font-weight: 600; }
    .unhandled { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; margin-bottom: 10px; border-radius: 4px; }
    .footer { text-align: center; color: #666; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="header">
    <h1>📊 Markdown 锚点迁移报告</h1>
    <div class="time">生成时间: ${new Date().toLocaleString('zh-CN')}</div>
  </div>

  <div class="summary">
    <div class="card info">
      <div class="number">${analysis.files.length}</div>
      <div class="label">扫描文件</div>
    </div>
    <div class="card info">
      <div class="number">${Object.values(analysis.allAnchors).reduce((sum, a) => sum + a.length, 0)}</div>
      <div class="label">标题锚点</div>
    </div>
    <div class="card success">
      <div class="number">${analysis.validLinks.length}</div>
      <div class="label">有效链接</div>
    </div>
    <div class="card error">
      <div class="number">${analysis.brokenLinks.length}</div>
      <div class="label">断链数量</div>
    </div>
    <div class="card warning">
      <div class="number">${analysis.unhandledLinks.length}</div>
      <div class="label">无法处理</div>
    </div>
  </div>

  ${analysis.brokenLinks.length > 0 ? `
  <div class="section">
    <h2>❌ 断链详情</h2>
    ${Object.entries(analysis.brokenLinks.reduce((acc, link) => {
      if (!acc[link.file]) acc[link.file] = [];
      acc[link.file].push(link);
      return acc;
    }, {})).map(([file, links]) => `
    <div class="file-group">
      <h3>📄 ${path.relative(process.cwd(), file)}</h3>
      ${links.map(link => `
      <div class="broken-link">
        <div class="link-location">行 ${link.line}, 列 ${link.column}</div>
        <div class="link-raw">${link.raw}</div>
        <div class="link-target">
          → 目标: ${link.targetFile ? path.relative(process.cwd(), link.targetFile) : '未知'}#${link.targetAnchor}
        </div>
        ${link.suggestedFix ? `
        <div class="suggestion">
          <div class="suggestion-label">
            💡 建议修复
            <span class="confidence ${link.suggestedFix.confidence > 70 ? '' : 'medium'}">${link.suggestedFix.confidence}%</span>
          </div>
          <div>目标标题: <strong>${link.suggestedFix.newTitle}</strong></div>
          <div>新锚点: <code>#${link.suggestedFix.newAnchor}</code></div>
        </div>
        ` : ''}
      </div>
      `).join('')}
    </div>
    `).join('')}
  </div>
  ` : ''}

  ${analysis.unhandledLinks.length > 0 ? `
  <div class="section">
    <h2>⚠️ 无法处理的链接</h2>
    ${analysis.unhandledLinks.map(link => `
    <div class="unhandled">
      <div class="link-location">📄 ${path.relative(process.cwd(), link.file)}:${link.line}</div>
      <div class="link-raw">${link.raw}</div>
      <div style="margin-top: 8px;">原因: ${link.reason}</div>
    </div>
    `).join('')}
  </div>
  ` : ''}

  <div class="footer">
    本报告由 Markdown 锚点迁移CLI工具自动生成
  </div>
</body>
</html>`;

  fs.writeFileSync(reportPath, html, 'utf-8');
  return reportPath;
}

function exportReports(analysis, outputDir, fixPreview = null, options = {}) {
  prepareOutputDir(outputDir, options.clean !== false);
  
  const jsonPath = writeJsonReport(analysis, outputDir, options);
  const mdPath = writeMarkdownReport(analysis, outputDir, fixPreview, options);
  const htmlPath = writeHtmlReport(analysis, outputDir, options);
  
  console.log(chalk.bold('\n📑 报告已导出:\n'));
  console.log(`   📄 JSON报告: ${chalk.cyan(path.relative(process.cwd(), jsonPath))}`);
  console.log(`   📄 Markdown报告: ${chalk.cyan(path.relative(process.cwd(), mdPath))}`);
  console.log(`   📄 HTML报告: ${chalk.cyan(path.relative(process.cwd(), htmlPath))}`);
  console.log();
  
  return { jsonPath, mdPath, htmlPath };
}

module.exports = {
  printTerminalSummary,
  exportReports,
  prepareOutputDir
};
