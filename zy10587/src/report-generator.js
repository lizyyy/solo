const chalk = require('chalk');
const Table = require('cli-table3');
const fs = require('fs');
const path = require('path');

class ReportGenerator {
  constructor(results, options = {}) {
    this.results = results;
    this.options = {
      outputDir: options.outputDir || './reports',
      timestamp: options.timestamp || new Date().toISOString().replace(/[:.]/g, '-'),
      filename: options.filename || 'formula-check'
    };
  }

  generateConsoleSummary() {
    const { summary, errors } = this.results;
    
    console.log('\n' + '='.repeat(70));
    console.log(chalk.bold.blue('                    Excel 公式引用检查报告'));
    console.log('='.repeat(70) + '\n');

    console.log(chalk.bold('📊 检查摘要'));
    console.log('─'.repeat(40));
    console.log(`  工作表数量:     ${summary.totalSheets}`);
    console.log(`  公式总数:       ${summary.totalFormulas}`);
    console.log(`  引用总数:       ${summary.totalReferences}`);
    console.log(`  错误数量:       ${summary.totalErrors > 0 ? chalk.red.bold(summary.totalErrors) : chalk.green(summary.totalErrors)}`);
    console.log(`  警告数量:       ${summary.totalWarnings > 0 ? chalk.yellow(summary.totalWarnings) : chalk.green(summary.totalWarnings)}`);
    console.log();

    if (Object.keys(summary.errorByType).length > 0) {
      console.log(chalk.bold('❌ 错误类型分布'));
      console.log('─'.repeat(40));
      for (const [type, count] of Object.entries(summary.errorByType)) {
        console.log(`  ${this._formatErrorType(type)}: ${chalk.red(count)} 个`);
      }
      console.log();
    }

    if (errors.length > 0) {
      console.log(chalk.bold('🔍 错误详情'));
      console.log('─'.repeat(70));
      
      const table = new Table({
        head: [
          chalk.cyan('序号'),
          chalk.cyan('源工作表'),
          chalk.cyan('单元格'),
          chalk.cyan('错误类型'),
          chalk.cyan('错误描述')
        ],
        colWidths: [6, 15, 10, 20, 35],
        wordWrap: true
      });

      errors.slice(0, 20).forEach((error, idx) => {
        table.push([
          idx + 1,
          error.sourceSheet,
          error.sourceCell,
          this._formatErrorType(error.errorType),
          error.message
        ]);
      });

      console.log(table.toString());
      
      if (errors.length > 20) {
        console.log(chalk.gray(`  ... 还有 ${errors.length - 20} 个错误，请查看完整报告`));
      }
      console.log();
    }

    if (summary.totalErrors === 0) {
      console.log(chalk.green.bold('✅ 检查完成 - 未发现公式引用错误！'));
    } else {
      console.log(chalk.red.bold(`⚠️  检查完成 - 发现 ${summary.totalErrors} 个错误需要修复`));
    }
    console.log();
  }

  _formatErrorType(type) {
    const typeMap = {
      SHEET_NOT_FOUND: '工作表不存在',
      CELL_OUT_OF_RANGE: '单元格超出范围',
      RANGE_OUT_OF_BOUNDS: '范围越界',
      CIRCULAR_REFERENCE: '循环引用',
      INVALID_REFERENCE: '无效引用格式',
      EMPTY_SHEET_REFERENCE: '空工作表引用'
    };
    return typeMap[type] || type;
  }

  generateJsonReport() {
    const reportPath = path.join(this.options.outputDir, `${this.options.filename}-${this.options.timestamp}.json`);
    this._ensureDir(this.options.outputDir);
    
    const report = {
      metadata: {
        generatedAt: new Date().toISOString(),
        version: '1.0.0',
        checkType: 'excel-formula-reference'
      },
      ...this.results
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    return reportPath;
  }

  generateHtmlReport() {
    const reportPath = path.join(this.options.outputDir, `${this.options.filename}-${this.options.timestamp}.html`);
    this._ensureDir(this.options.outputDir);
    
    const { summary, errors, sheets } = this.results;
    
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Excel 公式引用检查报告</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fa; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 24px; }
        .header h1 { font-size: 28px; margin-bottom: 8px; }
        .header p { opacity: 0.9; }
        .summary-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
        .card { background: white; padding: 24px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
        .card-value { font-size: 36px; font-weight: bold; color: #333; }
        .card-label { color: #666; margin-top: 4px; }
        .card.error .card-value { color: #e74c3c; }
        .card.success .card-value { color: #27ae60; }
        .section { background: white; border-radius: 12px; padding: 24px; margin-bottom: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
        .section-title { font-size: 18px; font-weight: 600; color: #333; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #eee; }
        .error-table { width: 100%; border-collapse: collapse; }
        .error-table th { background: #f8f9fa; text-align: left; padding: 12px 16px; font-weight: 600; color: #555; border-bottom: 2px solid #eee; }
        .error-table td { padding: 12px 16px; border-bottom: 1px solid #f0f0f0; }
        .error-table tr:hover { background: #fafbfc; }
        .error-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; }
        .error-badge.SHEET_NOT_FOUND { background: #fee; color: #c33; }
        .error-badge.CELL_OUT_OF_RANGE { background: #fef5e7; color: #e67e22; }
        .error-badge.RANGE_OUT_OF_BOUNDS { background: #fef5e7; color: #e67e22; }
        .error-badge.INVALID_REFERENCE { background: #f0f0f0; color: #666; }
        .cell-ref { font-family: 'SFMono-Regular', Consolas, monospace; background: #f6f8fa; padding: 2px 8px; border-radius: 4px; color: #0366d6; }
        .sheet-list { display: flex; flex-wrap: wrap; gap: 8px; }
        .sheet-item { padding: 8px 16px; background: #f6f8fa; border-radius: 20px; font-size: 14px; }
        .no-errors { text-align: center; padding: 40px; color: #27ae60; }
        .no-errors svg { width: 64px; height: 64px; margin-bottom: 16px; }
        .footer { text-align: center; color: #999; padding: 20px; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Excel 公式引用检查报告</h1>
            <p>生成时间: ${new Date().toLocaleString('zh-CN')}</p>
        </div>

        <div class="summary-cards">
            <div class="card">
                <div class="card-value">${summary.totalSheets}</div>
                <div class="card-label">工作表数量</div>
            </div>
            <div class="card">
                <div class="card-value">${summary.totalFormulas}</div>
                <div class="card-label">公式总数</div>
            </div>
            <div class="card">
                <div class="card-value">${summary.totalReferences}</div>
                <div class="card-label">引用总数</div>
            </div>
            <div class="card ${summary.totalErrors === 0 ? 'success' : 'error'}">
                <div class="card-value">${summary.totalErrors}</div>
                <div class="card-label">错误数量</div>
            </div>
        </div>

        <div class="section">
            <h2 class="section-title">📑 检查的工作表</h2>
            <div class="sheet-list">
                ${Object.keys(sheets).map(name => `<span class="sheet-item">${name} (${sheets[name].formulaCount} 个公式)</span>`).join('')}
            </div>
        </div>

        <div class="section">
            <h2 class="section-title">❌ 错误详情 (${errors.length})</h2>
            ${errors.length === 0 ? `
                <div class="no-errors">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    <h3>太棒了！未发现任何公式引用错误</h3>
                </div>
            ` : `
                <table class="error-table">
                    <thead>
                        <tr>
                            <th>序号</th>
                            <th>源工作表</th>
                            <th>单元格</th>
                            <th>错误类型</th>
                            <th>引用内容</th>
                            <th>错误描述</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${errors.map((e, i) => `
                            <tr>
                                <td>${i + 1}</td>
                                <td><span class="cell-ref">${e.sourceSheet}</span></td>
                                <td><span class="cell-ref">${e.sourceCell}</span></td>
                                <td><span class="error-badge ${e.errorType}">${this._formatErrorType(e.errorType)}</span></td>
                                <td><span class="cell-ref">${e.reference}</span></td>
                                <td>${e.message}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `}
        </div>

        <div class="footer">
            <p>Excel Formula Linter v1.0.0 | 报告生成时间: ${new Date().toLocaleString('zh-CN')}</p>
        </div>
    </div>
</body>
</html>`;

    fs.writeFileSync(reportPath, html, 'utf8');
    return reportPath;
  }

  generateCsvReport() {
    const reportPath = path.join(this.options.outputDir, `${this.options.filename}-${this.options.timestamp}.csv`);
    this._ensureDir(this.options.outputDir);
    
    const { errors } = this.results;
    
    const headers = ['序号', '源工作表', '单元格', '错误类型', '引用内容', '目标工作表', '目标单元格', '错误描述', '时间戳'];
    const rows = errors.map((e, i) => [
      i + 1,
      e.sourceSheet,
      e.sourceCell,
      this._formatErrorType(e.errorType),
      e.reference,
      e.targetSheet,
      e.targetCell,
      e.message,
      e.timestamp
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    fs.writeFileSync(reportPath, '\uFEFF' + csv, 'utf8');
    return reportPath;
  }

  generateAllReports() {
    const reports = {
      json: this.generateJsonReport(),
      html: this.generateHtmlReport(),
      csv: this.generateCsvReport()
    };

    console.log(chalk.bold('\n📄 报告文件已生成:'));
    console.log('─'.repeat(50));
    console.log(`  JSON: ${chalk.cyan(reports.json)}`);
    console.log(`  HTML: ${chalk.cyan(reports.html)}`);
    console.log(`  CSV:  ${chalk.cyan(reports.csv)}`);
    console.log();

    return reports;
  }

  _ensureDir(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

module.exports = ReportGenerator;
