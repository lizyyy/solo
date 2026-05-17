const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

class ReportGenerator {
  constructor(options = {}) {
    this.outputDir = options.outputDir || process.cwd();
    this.verbose = options.verbose || false;
  }

  generateTerminalSummary(results) {
    const summary = results.summary;
    const lines = [];

    lines.push('');
    lines.push(chalk.bold('='.repeat(60)));
    lines.push(chalk.bold('           时区数据巡检报告'));
    lines.push(chalk.bold('='.repeat(60)));
    lines.push('');
    lines.push(`审计时间: ${chalk.cyan(results.meta.auditTime)}`);
    lines.push(`输入路径: ${results.meta.inputPath}`);
    lines.push(`输入类型: ${results.meta.inputType}`);
    lines.push(`目标时区: ${results.meta.targetTimezone}`);
    lines.push(`时间字段: ${results.meta.timeField}`);
    lines.push('');

    lines.push(chalk.bold('--- 统计摘要 ---'));
    lines.push(`总处理行数: ${chalk.white(summary.totalRows)}`);
    lines.push(`  ${chalk.green('成功: ')}${chalk.green(summary.successRows)}`);
    lines.push(`  ${chalk.red('错误: ')}${chalk.red(summary.errorRows)}`);
    lines.push(`  ${chalk.yellow('警告: ')}${chalk.yellow(summary.warningRows)}`);
    lines.push(`  ${chalk.magenta('夏令时转换点: ')}${chalk.magenta(summary.dstTransitionRows)}`);
    lines.push('');

    summary.files.forEach(file => {
      lines.push(chalk.bold(`--- 文件: ${file.file} ---`));
      lines.push(`  总行数: ${file.totalRows}`);
      lines.push(`  成功: ${file.successRows} | 错误: ${file.errorRows} | 警告: ${file.warningRows}`);
      if (file.dstTransitionRows > 0) {
        lines.push(`  夏令时转换点: ${file.dstTransitionRows}`);
      }
      lines.push('');
    });

    if (summary.errorRows > 0) {
      lines.push(chalk.red.bold('--- 错误详情 ---'));
      results.files.forEach(file => {
        file.errors.slice(0, 10).forEach(error => {
          lines.push(chalk.red(`  [${error.rowNumber ? '行 ' + error.rowNumber : error.file}] ${error.issues[0].message}`));
        });
        if (file.errors.length > 10) {
          lines.push(chalk.red(`  ... 还有 ${file.errors.length - 10} 个错误`));
        }
      });
      lines.push('');
    }

    if (summary.warningRows > 0) {
      lines.push(chalk.yellow.bold('--- 警告详情 ---'));
      results.files.forEach(file => {
        file.warnings.slice(0, 10).forEach(warning => {
          lines.push(chalk.yellow(`  [行 ${warning.rowNumber}] ${warning.issues[0].message}`));
        });
        if (file.warnings.length > 10) {
          lines.push(chalk.yellow(`  ... 还有 ${file.warnings.length - 10} 个警告`));
        }
      });
      lines.push('');
    }

    lines.push(chalk.bold('='.repeat(60)));
    if (summary.errorRows > 0) {
      lines.push(chalk.red.bold('巡检结果: 发现错误，退出码: 1'));
    } else if (summary.warningRows > 0) {
      lines.push(chalk.yellow.bold('巡检结果: 完成，但有警告，退出码: 0'));
    } else {
      lines.push(chalk.green.bold('巡检结果: 全部通过，退出码: 0'));
    }
    lines.push(chalk.bold('='.repeat(60)));
    lines.push('');

    return lines.join('\n');
  }

  generateMachineReadable(results, outputPath) {
    const machineData = {
      meta: results.meta,
      summary: results.summary,
      exitCode: results.exitCode,
      failedRows: this.extractFailedRows(results),
      warningRows: this.extractWarningRows(results)
    };

    const jsonContent = JSON.stringify(machineData, null, 2);
    
    if (outputPath) {
      const fullPath = path.resolve(outputPath);
      fs.writeFileSync(fullPath, jsonContent, 'utf8');
      return fullPath;
    }
    
    return jsonContent;
  }

  generateHtmlReport(results, outputPath) {
    const summary = results.summary;
    const failedRows = this.extractFailedRows(results);
    const warningRows = this.extractWarningRows(results);

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>时区数据巡检报告</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 20px; color: #333; }
      .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }
      .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; }
      .header h1 { font-size: 28px; margin-bottom: 10px; }
      .header p { opacity: 0.9; }
      .content { padding: 30px; }
      .section { margin-bottom: 30px; }
      .section h2 { font-size: 20px; margin-bottom: 15px; color: #333; border-bottom: 2px solid #667eea; padding-bottom: 8px; }
      .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
      .stat-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
      .stat-card .number { font-size: 32px; font-weight: bold; margin-bottom: 5px; }
      .stat-card .label { font-size: 14px; color: #666; }
      .stat-card.success .number { color: #28a745; }
      .stat-card.error .number { color: #dc3545; }
      .stat-card.warning .number { color: #ffc107; }
      .stat-card.dst .number { color: #17a2b8; }
      table { width: 100%; border-collapse: collapse; margin-top: 15px; }
      th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #e0e0e0; }
      th { background: #f8f9fa; font-weight: 600; }
      tr:hover { background: #f5f5f5; }
      .error-row { background: #fff5f5; }
      .warning-row { background: #fffbf0; }
      .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
      .badge-error { background: #dc3545; color: white; }
      .badge-warning { background: #ffc107; color: #856404; }
      .badge-success { background: #28a745; color: white; }
      .issue-message { font-family: monospace; background: #f8f9fa; padding: 8px; border-radius: 4px; margin-top: 5px; font-size: 13px; }
      .meta-info { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
      .meta-info p { margin: 5px 0; }
      .meta-info strong { color: #667eea; }
      .footer { text-align: center; padding: 20px; color: #666; font-size: 13px; border-top: 1px solid #e0e0e0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🌐 时区数据巡检报告</h1>
            <p>跨国业务报表时区一致性检查</p>
        </div>
        <div class="content">
            <div class="section">
                <h2>📋 基本信息</h2>
                <div class="meta-info">
                    <p><strong>审计时间:</strong> ${results.meta.auditTime}</p>
                    <p><strong>输入路径:</strong> ${results.meta.inputPath}</p>
                    <p><strong>目标时区:</strong> ${results.meta.targetTimezone}</p>
                    <p><strong>时间字段:</strong> ${results.meta.timeField}</p>
                </div>
            </div>

            <div class="section">
                <h2>📊 统计摘要</h2>
                <div class="stats">
                    <div class="stat-card">
                        <div class="number">${summary.totalRows}</div>
                        <div class="label">总处理行数</div>
                    </div>
                    <div class="stat-card success">
                        <div class="number">${summary.successRows}</div>
                        <div class="label">成功</div>
                    </div>
                    <div class="stat-card error">
                        <div class="number">${summary.errorRows}</div>
                        <div class="label">错误</div>
                    </div>
                    <div class="stat-card warning">
                        <div class="number">${summary.warningRows}</div>
                        <div class="label">警告</div>
                    </div>
                    <div class="stat-card dst">
                        <div class="number">${summary.dstTransitionRows}</div>
                        <div class="label">夏令时转换点</div>
                    </div>
                </div>
            </div>

            ${failedRows.length > 0 ? `
            <div class="section">
                <h2>❌ 错误行详情</h2>
                <table>
                    <thead>
                        <tr>
                            <th>文件</th>
                            <th>行号</th>
                            <th>原始值</th>
                            <th>错误类型</th>
                            <th>错误信息</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${failedRows.map(row => `
                        <tr class="error-row">
                            <td>${row.file}</td>
                            <td>${row.rowNumber}</td>
                            <td><code>${this.escapeHtml(row.issues[0].value || '')}</code></td>
                            <td><span class="badge badge-error">${row.issues[0].type}</span></td>
                            <td>${row.issues[0].message}</td>
                        </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ` : ''}

            ${warningRows.length > 0 ? `
            <div class="section">
                <h2>⚠️ 警告行详情</h2>
                <table>
                    <thead>
                        <tr>
                            <th>文件</th>
                            <th>行号</th>
                            <th>归一化时间</th>
                            <th>警告类型</th>
                            <th>警告信息</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${warningRows.map(row => `
                        <tr class="warning-row">
                            <td>${row.file}</td>
                            <td>${row.rowNumber}</td>
                            <td><code>${row.normalized ? row.normalized.isoString : '-'}</code></td>
                            <td><span class="badge badge-warning">${row.issues[0].type}</span></td>
                            <td>
                                ${row.issues[0].message}
                                ${row.issues[0].dstInfo ? `
                                <div class="issue-message">
                                    偏移变化: ${row.issues[0].dstInfo.offsetBefore} → ${row.issues[0].dstInfo.offsetAfter}
                                </div>
                                ` : ''}
                            </td>
                        </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ` : ''}

            <div class="section">
                <h2>📁 文件列表</h2>
                <table>
                    <thead>
                        <tr>
                            <th>文件名</th>
                            <th>格式</th>
                            <th>总行数</th>
                            <th>成功</th>
                            <th>错误</th>
                            <th>警告</th>
                            <th>夏令时转换</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${summary.files.map(file => `
                        <tr>
                            <td>${file.file}</td>
                            <td>${file.format || '-'}</td>
                            <td>${file.totalRows}</td>
                            <td><span class="badge badge-success">${file.successRows}</span></td>
                            <td>${file.errorRows > 0 ? `<span class="badge badge-error">${file.errorRows}</span>` : '0'}</td>
                            <td>${file.warningRows > 0 ? `<span class="badge badge-warning">${file.warningRows}</span>` : '0'}</td>
                            <td>${file.dstTransitionRows > 0 ? `<span class="badge badge-warning">${file.dstTransitionRows}</span>` : '0'}</td>
                        </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
        <div class="footer">
            <p>时区数据巡检工具 | 报告生成时间: ${new Date().toLocaleString('zh-CN')}</p>
        </div>
    </div>
</body>
</html>`;

    if (outputPath) {
      const fullPath = path.resolve(outputPath);
      fs.writeFileSync(fullPath, html, 'utf8');
      return fullPath;
    }
    
    return html;
  }

  generateErrorReport(results, outputPath) {
    const failedRows = this.extractFailedRows(results);
    
    const csvContent = [
      'file,row_number,original_value,error_type,error_message',
      ...failedRows.map(row => {
        const issue = row.issues[0];
        return [
          `"${row.file}"`,
          row.rowNumber,
          `"${(issue.value || '').replace(/"/g, '""')}"`,
          issue.type,
          `"${issue.message.replace(/"/g, '""')}"`
        ].join(',');
      })
    ].join('\n');

    if (outputPath) {
      const fullPath = path.resolve(outputPath);
      fs.writeFileSync(fullPath, csvContent, 'utf8');
      return fullPath;
    }
    
    return csvContent;
  }

  extractFailedRows(results) {
    const failedRows = [];
    
    for (const file of results.files) {
      for (const row of file.rows) {
        if (row.status === 'error') {
          failedRows.push({
            file: file.file,
            filePath: file.filePath,
            ...row
          });
        }
      }
    }
    
    return failedRows;
  }

  extractWarningRows(results) {
    const warningRows = [];
    
    for (const file of results.files) {
      for (const row of file.rows) {
        if (row.status === 'warning') {
          warningRows.push({
            file: file.file,
            filePath: file.filePath,
            ...row
          });
        }
      }
    }
    
    return warningRows;
  }

  escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async generateAllReports(results, baseName = 'timezone-audit') {
    const outputs = {};

    outputs.terminal = this.generateTerminalSummary(results);

    outputs.jsonPath = path.join(this.outputDir, `${baseName}.json`);
    this.generateMachineReadable(results, outputs.jsonPath);

    outputs.htmlPath = path.join(this.outputDir, `${baseName}.html`);
    this.generateHtmlReport(results, outputs.htmlPath);

    if (results.summary.errorRows > 0) {
      outputs.errorsCsvPath = path.join(this.outputDir, `${baseName}-errors.csv`);
      this.generateErrorReport(results, outputs.errorsCsvPath);
    }

    return outputs;
  }
}

module.exports = ReportGenerator;