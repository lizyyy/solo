import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import { CheckReport, PlaceholderCheckResult, CLIOptions } from './types.js';

export function printTerminalSummary(report: CheckReport, verbose: boolean): void {
  const { summary, metadata, results } = report;

  console.log('\n' + chalk.bold.cyan('='.repeat(60)));
  console.log(chalk.bold.cyan('  i18n 占位符检查报告'));
  console.log(chalk.bold.cyan('='.repeat(60)) + '\n');

  console.log(chalk.bold('检查时间: ') + new Date(metadata.checkedAt).toLocaleString('zh-CN'));
  console.log(chalk.bold('源语言: ') + metadata.sourceLanguage);
  console.log(chalk.bold('目标语言: ') + (metadata.targetLanguages.length > 0 ? metadata.targetLanguages.join(', ') : '无'));
  console.log(chalk.bold('处理文件数: ') + metadata.filesProcessed.length + '\n');

  console.log(chalk.bold('--- 摘要 ---'));
  console.log(`  总键数:     ${summary.totalKeys}`);
  console.log(`  已检查:     ${summary.checkedKeys}`);
  console.log(`  通过:       ${chalk.green(summary.passed)}`);
  console.log(`  错误:       ${summary.errors > 0 ? chalk.red(summary.errors) : summary.errors}`);
  console.log(`  警告:       ${summary.warnings > 0 ? chalk.yellow(summary.warnings) : summary.warnings}`);
  console.log();

  if (results.length > 0) {
    console.log(chalk.bold('--- 问题详情 ---') + '\n');

    const errors = results.filter(r => r.severity === 'error');
    const warnings = results.filter(r => r.severity === 'warning');

    if (errors.length > 0) {
      console.log(chalk.red.bold('  错误 (缺失占位符):\n'));
      errors.forEach((result, index) => printResult(result, index + 1, verbose));
    }

    if (warnings.length > 0) {
      console.log(chalk.yellow.bold('  警告 (额外占位符):\n'));
      warnings.forEach((result, index) => printResult(result, index + 1, verbose, true));
    }
  } else {
    console.log(chalk.green.bold('  ✓ 所有翻译文件的占位符检查通过！\n'));
  }

  console.log(chalk.bold.cyan('='.repeat(60)) + '\n');
}

function printResult(
  result: PlaceholderCheckResult,
  index: number,
  verbose: boolean,
  isWarning = false
): void {
  const color = isWarning ? chalk.yellow : chalk.red;

  console.log(color(`  ${index}. 键名: ${result.key}`));
  console.log(`     语言: ${result.sourceLanguage} → ${result.targetLanguage}`);
  
  if (result.lineNumber) {
    console.log(`     位置: ${result.filePath}:${result.lineNumber}`);
  } else {
    console.log(`     文件: ${result.filePath}`);
  }

  if (verbose) {
    console.log(`     源文案: ${result.sourceText}`);
    console.log(`     译文案: ${result.targetText}`);
  }

  if (result.missingPlaceholders.length > 0) {
    console.log(color(`     缺失占位符: ${result.missingPlaceholders.map(p => p.raw).join(', ')}`));
  }

  if (result.extraPlaceholders.length > 0) {
    console.log(chalk.yellow(`     额外占位符: ${result.extraPlaceholders.map(p => p.raw).join(', ')}`));
  }

  if (result.suggestion) {
    console.log(chalk.blue(`     建议修复: ${result.suggestion}`));
  }

  console.log();
}

export async function writeJsonReport(report: CheckReport, outputDir: string): Promise<string> {
  const filePath = path.join(outputDir, 'i18n-check-report.json');
  await fs.writeFile(filePath, JSON.stringify(report, null, 2), 'utf-8');
  return filePath;
}

export async function writeMarkdownReport(report: CheckReport, outputDir: string): Promise<string> {
  const { summary, metadata, results } = report;
  const filePath = path.join(outputDir, 'i18n-check-report.md');

  const errors = results.filter(r => r.severity === 'error');
  const warnings = results.filter(r => r.severity === 'warning');

  let content = `# i18n 占位符检查报告\n\n`;
  content += `**检查时间**: ${new Date(metadata.checkedAt).toLocaleString('zh-CN')}\n\n`;
  content += `## 摘要\n\n`;
  content += `| 指标 | 数值 |\n`;
  content += `|------|------|\n`;
  content += `| 总键数 | ${summary.totalKeys} |\n`;
  content += `| 已检查 | ${summary.checkedKeys} |\n`;
  content += `| 通过 | ${summary.passed} |\n`;
  content += `| 错误 | ${summary.errors} |\n`;
  content += `| 警告 | ${summary.warnings} |\n\n`;

  content += `## 元数据\n\n`;
  content += `- **源语言**: ${metadata.sourceLanguage}\n`;
  content += `- **目标语言**: ${metadata.targetLanguages.length > 0 ? metadata.targetLanguages.join(', ') : '无'}\n`;
  content += `- **处理文件**:\n`;
  metadata.filesProcessed.forEach(file => {
    content += `  - \`${file}\`\n`;
  });
  content += '\n';

  if (errors.length > 0) {
    content += `## ❌ 错误详情 (缺失占位符)\n\n`;
    errors.forEach((result, index) => {
      content += `### ${index + 1}. ${result.key}\n\n`;
      content += `- **语言**: ${result.sourceLanguage} → ${result.targetLanguage}\n`;
      content += `- **文件**: \`${result.filePath}\`\n`;
      if (result.lineNumber) {
        content += `- **行号**: ${result.lineNumber}\n`;
      }
      content += `- **源文案**: ${result.sourceText}\n`;
      content += `- **译文案**: ${result.targetText}\n`;
      content += `- **缺失占位符**: ${result.missingPlaceholders.map(p => `\`${p.raw}\``).join(', ')}\n`;
      if (result.suggestion) {
        content += `- **建议修复**: ${result.suggestion}\n`;
      }
      content += '\n';
    });
  }

  if (warnings.length > 0) {
    content += `## ⚠️ 警告详情 (额外占位符)\n\n`;
    warnings.forEach((result, index) => {
      content += `### ${index + 1}. ${result.key}\n\n`;
      content += `- **语言**: ${result.sourceLanguage} → ${result.targetLanguage}\n`;
      content += `- **文件**: \`${result.filePath}\`\n`;
      if (result.lineNumber) {
        content += `- **行号**: ${result.lineNumber}\n`;
      }
      content += `- **源文案**: ${result.sourceText}\n`;
      content += `- **译文案**: ${result.targetText}\n`;
      content += `- **额外占位符**: ${result.extraPlaceholders.map(p => `\`${p.raw}\``).join(', ')}\n`;
      content += '\n';
    });
  }

  if (results.length === 0) {
    content += `## ✅ 检查通过\n\n所有翻译文件的占位符检查通过！\n`;
  }

  await fs.writeFile(filePath, content, 'utf-8');
  return filePath;
}

export async function writeHtmlReport(report: CheckReport, outputDir: string): Promise<string> {
  const { summary, metadata, results } = report;
  const filePath = path.join(outputDir, 'i18n-check-report.html');

  const errors = results.filter(r => r.severity === 'error');
  const warnings = results.filter(r => r.severity === 'warning');

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>i18n 占位符检查报告</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
    .container { background: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { color: #333; border-bottom: 3px solid #1890ff; padding-bottom: 15px; margin-bottom: 25px; }
    h2 { color: #555; margin: 25px 0 15px; padding-left: 10px; border-left: 4px solid #1890ff; }
    h3 { color: #666; margin: 20px 0 10px; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
    .summary-card { padding: 20px; border-radius: 8px; text-align: center; }
    .summary-card .number { font-size: 32px; font-weight: bold; display: block; }
    .summary-card .label { font-size: 14px; color: #666; margin-top: 5px; }
    .card-passed { background: #f6ffed; border: 1px solid #b7eb8f; }
    .card-passed .number { color: #52c41a; }
    .card-errors { background: #fff2f0; border: 1px solid #ffccc7; }
    .card-errors .number { color: #ff4d4f; }
    .card-warnings { background: #fffbe6; border: 1px solid #ffe58f; }
    .card-warnings .number { color: #faad14; }
    .card-total { background: #e6f7ff; border: 1px solid #91d5ff; }
    .card-total .number { color: #1890ff; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #fafafa; font-weight: 600; }
    .result-item { margin: 20px 0; padding: 20px; border-radius: 8px; border-left: 4px solid; }
    .result-error { background: #fff1f0; border-color: #ff4d4f; }
    .result-warning { background: #fffbe6; border-color: #faad14; }
    .result-title { font-size: 16px; font-weight: 600; margin-bottom: 10px; }
    .result-detail { margin: 8px 0; color: #555; }
    .result-detail strong { color: #333; }
    .placeholder { display: inline-block; background: #fff; padding: 2px 8px; border-radius: 4px; font-family: monospace; margin: 0 4px; }
    .suggestion { background: #e6f7ff; padding: 15px; border-radius: 6px; margin-top: 15px; }
    .suggestion strong { color: #1890ff; }
    .success-box { background: #f6ffed; border: 1px solid #b7eb8f; padding: 40px; border-radius: 8px; text-align: center; margin: 30px 0; }
    .success-box .emoji { font-size: 48px; margin-bottom: 15px; }
    .success-box h3 { color: #52c41a; border: none; }
    .meta-info { background: #fafafa; padding: 15px; border-radius: 6px; margin: 15px 0; }
    .meta-info ul { margin-left: 20px; margin-top: 10px; }
    .meta-info li { margin: 5px 0; }
    code { background: #f5f5f5; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📋 i18n 占位符检查报告</h1>
    
    <div class="meta-info">
      <p><strong>检查时间:</strong> ${new Date(metadata.checkedAt).toLocaleString('zh-CN')}</p>
      <p><strong>源语言:</strong> ${metadata.sourceLanguage}</p>
      <p><strong>目标语言:</strong> ${metadata.targetLanguages.length > 0 ? metadata.targetLanguages.join(', ') : '无'}</p>
      <p><strong>处理文件:</strong></p>
      <ul>
        ${metadata.filesProcessed.map(file => `<li><code>${file}</code></li>`).join('')}
      </ul>
    </div>

    <h2>📊 摘要</h2>
    <div class="summary">
      <div class="summary-card card-total">
        <span class="number">${summary.totalKeys}</span>
        <span class="label">总键数</span>
      </div>
      <div class="summary-card card-passed">
        <span class="number">${summary.passed}</span>
        <span class="label">通过</span>
      </div>
      <div class="summary-card card-errors">
        <span class="number">${summary.errors}</span>
        <span class="label">错误</span>
      </div>
      <div class="summary-card card-warnings">
        <span class="number">${summary.warnings}</span>
        <span class="label">警告</span>
      </div>
    </div>

    ${results.length === 0 ? `
    <div class="success-box">
      <div class="emoji">🎉</div>
      <h3>所有翻译文件的占位符检查通过！</h3>
      <p>未发现任何占位符不一致的问题。</p>
    </div>
    ` : ''}

    ${errors.length > 0 ? `
    <h2>❌ 错误详情 (缺失占位符)</h2>
    ${errors.map((result, index) => `
    <div class="result-item result-error">
      <div class="result-title">#${index + 1} ${result.key}</div>
      <div class="result-detail"><strong>语言:</strong> ${result.sourceLanguage} → ${result.targetLanguage}</div>
      <div class="result-detail"><strong>文件:</strong> <code>${result.filePath}</code>${result.lineNumber ? `:<strong>${result.lineNumber}</strong>` : ''}</div>
      <div class="result-detail"><strong>源文案:</strong> ${result.sourceText}</div>
      <div class="result-detail"><strong>译文案:</strong> ${result.targetText}</div>
      <div class="result-detail"><strong>缺失占位符:</strong> ${result.missingPlaceholders.map(p => `<span class="placeholder">${p.raw}</span>`).join('')}</div>
      ${result.suggestion ? `<div class="suggestion"><strong>💡 建议修复:</strong> ${result.suggestion}</div>` : ''}
    </div>
    `).join('')}
    ` : ''}

    ${warnings.length > 0 ? `
    <h2>⚠️ 警告详情 (额外占位符)</h2>
    ${warnings.map((result, index) => `
    <div class="result-item result-warning">
      <div class="result-title">#${index + 1} ${result.key}</div>
      <div class="result-detail"><strong>语言:</strong> ${result.sourceLanguage} → ${result.targetLanguage}</div>
      <div class="result-detail"><strong>文件:</strong> <code>${result.filePath}</code>${result.lineNumber ? `:<strong>${result.lineNumber}</strong>` : ''}</div>
      <div class="result-detail"><strong>源文案:</strong> ${result.sourceText}</div>
      <div class="result-detail"><strong>译文案:</strong> ${result.targetText}</div>
      <div class="result-detail"><strong>额外占位符:</strong> ${result.extraPlaceholders.map(p => `<span class="placeholder">${p.raw}</span>`).join('')}</div>
    </div>
    `).join('')}
    ` : ''}
  </div>
</body>
</html>`;

  await fs.writeFile(filePath, html, 'utf-8');
  return filePath;
}

export async function generateReports(
  report: CheckReport,
  options: CLIOptions
): Promise<{ json?: string; markdown?: string; html?: string }> {
  const outputFiles: { json?: string; markdown?: string; html?: string } = {};

  if (options.format === 'json' || options.format === 'all') {
    outputFiles.json = await writeJsonReport(report, options.outputDir);
  }

  if (options.format === 'markdown' || options.format === 'all') {
    outputFiles.markdown = await writeMarkdownReport(report, options.outputDir);
  }

  if (options.format === 'html' || options.format === 'all') {
    outputFiles.html = await writeHtmlReport(report, options.outputDir);
  }

  return outputFiles;
}
