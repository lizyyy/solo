import * as path from 'path';
import chalk from 'chalk';
import Table from 'cli-table3';
import { GeneratedSample, GenerationSummary, GeneratorOptions, ReportData } from '../types';
import { writeJsonFile, formatErrorForReport, ensureDir } from '../utils/helpers';

export class Reporter {
  private summary: GenerationSummary;
  private samples: GeneratedSample[];
  private schema: Record<string, unknown>;
  private options: GeneratorOptions;

  constructor(
    summary: GenerationSummary,
    samples: GeneratedSample[],
    schema: Record<string, unknown>,
    options: GeneratorOptions
  ) {
    this.summary = summary;
    this.samples = samples;
    this.schema = schema;
    this.options = options;
  }

  printConsoleSummary(): void {
    console.log('\n');
    console.log(chalk.cyan.bold('════════════════════════════════════════════════════'));
    console.log(chalk.cyan.bold('           JSON Schema 样本生成报告'));
    console.log(chalk.cyan.bold('════════════════════════════════════════════════════'));
    console.log('\n');

    this.printOverview();
    this.printSampleBreakdown();
    this.printValidationStats();
    this.printErrors();
    this.printOutputInfo();

    console.log('\n');
  }

  private printOverview(): void {
    console.log(chalk.yellow.bold('📊 概览'));
    console.log(chalk.gray('────────────────────────────────────────────────────'));
    
    const overviewTable = new Table({
      head: [chalk.white('指标'), chalk.white('数值')],
      colWidths: [30, 30]
    });

    overviewTable.push(
      ['总样本数', this.summary.totalSamples.toString()],
      ['耗时', `${this.summary.duration}ms`],
      ['Schema文件', path.basename(this.options.schemaPath)]
    );

    console.log(overviewTable.toString());
    console.log('');
  }

  private printSampleBreakdown(): void {
    console.log(chalk.yellow.bold('📦 样本分类统计'));
    console.log(chalk.gray('────────────────────────────────────────────────────'));

    const breakdownTable = new Table({
      head: [chalk.white('类型'), chalk.white('数量'), chalk.white('占比')],
      colWidths: [20, 10, 20]
    });

    const { totalSamples, validCount, boundaryCount, invalidCount } = this.summary;
    const calcPct = (count: number) => ((count / totalSamples) * 100).toFixed(1) + '%';

    breakdownTable.push(
      [chalk.green('有效样本'), validCount.toString(), calcPct(validCount)],
      [chalk.blue('边界样本'), boundaryCount.toString(), calcPct(boundaryCount)],
      [chalk.red('非法样本'), invalidCount.toString(), calcPct(invalidCount)]
    );

    console.log(breakdownTable.toString());
    console.log('');
  }

  private printValidationStats(): void {
    console.log(chalk.yellow.bold('✅ 验证结果统计'));
    console.log(chalk.gray('────────────────────────────────────────────────────'));

    const validByType = {
      valid: this.samples.filter(s => s.metadata.type === 'valid' && s.validationResult.isValid).length,
      boundary: this.samples.filter(s => s.metadata.type === 'boundary' && s.validationResult.isValid).length,
      invalid: this.samples.filter(s => s.metadata.type === 'invalid' && !s.validationResult.isValid).length
    };

    const validationTable = new Table({
      head: [chalk.white('类型'), chalk.white('期望结果'), chalk.white('实际匹配'), chalk.white('状态')],
      colWidths: [15, 15, 15, 15]
    });

    validationTable.push(
      [
        chalk.green('有效样本'),
        '通过验证',
        `${validByType.valid}/${this.summary.validCount}`,
        validByType.valid === this.summary.validCount ? chalk.green('✓ 正常') : chalk.red('✗ 异常')
      ],
      [
        chalk.blue('边界样本'),
        '边缘值',
        `${validByType.boundary}/${this.summary.boundaryCount}`,
        chalk.yellow('⚠ 看情况')
      ],
      [
        chalk.red('非法样本'),
        '不通过验证',
        `${validByType.invalid}/${this.summary.invalidCount}`,
        validByType.invalid >= this.summary.invalidCount * 0.8 ? chalk.green('✓ 正常') : chalk.yellow('⚠ 偏低')
      ]
    );

    console.log(validationTable.toString());
    console.log('');

    if (validByType.valid !== this.summary.validCount) {
      console.log(chalk.yellow('⚠ 提示: 部分有效样本未通过验证，可能是Schema约束过于严格'));
      console.log('');
    }
  }

  private printErrors(): void {
    if (this.summary.errors.length === 0) return;

    console.log(chalk.yellow.bold('⚠ 生成错误'));
    console.log(chalk.gray('────────────────────────────────────────────────────'));

    this.summary.errors.forEach((err, i) => {
      console.log(chalk.red(`  ${i + 1}. ${err}`));
    });
    console.log('');
  }

  private printOutputInfo(): void {
    console.log(chalk.yellow.bold('📁 输出目录'));
    console.log(chalk.gray('────────────────────────────────────────────────────'));
    console.log(chalk.green(`  ${this.summary.outputPath}`));
    console.log('');

    console.log(chalk.dim('  目录结构:'));
    console.log(chalk.dim('  ├── valid/     - 有效样本'));
    console.log(chalk.dim('  ├── boundary/  - 边界样本'));
    console.log(chalk.dim('  ├── invalid/   - 非法样本'));
    console.log(chalk.dim('  └── index.json - 索引文件'));
    console.log('');
  }

  exportJsonReport(): string {
    const reportData: ReportData = {
      summary: this.summary,
      samples: this.samples.map(s => ({
        ...s,
        data: this.sanitizeForJson(s.data)
      })),
      schema: this.schema,
      options: this.options,
      generatedAt: new Date().toISOString()
    };

    const reportPath = path.join(this.options.outputDir, 'report.json');
    writeJsonFile(reportPath, reportData);
    return reportPath;
  }

  exportHtmlReport(): string {
    const html = this.buildHtmlReport();
    const reportPath = path.join(this.options.outputDir, 'report.html');
    ensureDir(path.dirname(reportPath));
    import('fs').then(fs => {
      fs.writeFileSync(reportPath, html, 'utf-8');
    });
    return reportPath;
  }

  private buildHtmlReport(): string {
    const samplesByType = {
      valid: this.samples.filter(s => s.metadata.type === 'valid'),
      boundary: this.samples.filter(s => s.metadata.type === 'boundary'),
      invalid: this.samples.filter(s => s.metadata.type === 'invalid')
    };

    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>JSON Schema 样本生成报告</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fa; color: #333; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        h1 { text-align: center; color: #2c3e50; margin-bottom: 30px; }
        .card { background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .card h2 { color: #3498db; border-bottom: 2px solid #eee; padding-bottom: 10px; margin-bottom: 15px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
        .stat-item { text-align: center; padding: 15px; border-radius: 8px; }
        .stat-item.valid { background: #d4edda; }
        .stat-item.boundary { background: #cce5ff; }
        .stat-item.invalid { background: #f8d7da; }
        .stat-number { font-size: 2em; font-weight: bold; }
        .stat-label { font-size: 0.9em; color: #666; }
        .sample-grid { display: grid; gap: 15px; }
        .sample-card { border: 1px solid #ddd; border-radius: 6px; padding: 15px; }
        .sample-card.valid { border-left: 4px solid #28a745; }
        .sample-card.boundary { border-left: 4px solid #17a2b8; }
        .sample-card.invalid { border-left: 4px solid #dc3545; }
        .sample-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .sample-id { font-family: monospace; color: #666; }
        .sample-badge { padding: 4px 8px; border-radius: 4px; font-size: 0.8em; font-weight: bold; }
        .sample-badge.valid { background: #d4edda; color: #155724; }
        .sample-badge.invalid { background: #f8d7da; color: #721c24; }
        .sample-reason { color: #666; font-size: 0.9em; margin-bottom: 10px; }
        .sample-data { background: #f8f9fa; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 0.85em; overflow-x: auto; max-height: 200px; }
        .errors { background: #fff3cd; padding: 15px; border-radius: 6px; }
        .error-item { padding: 5px 0; border-bottom: 1px solid #ffeaa7; }
        .error-item:last-child { border-bottom: none; }
        pre { white-space: pre-wrap; word-wrap: break-word; }
        .timestamp { text-align: center; color: #999; font-size: 0.85em; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>📋 JSON Schema 样本生成报告</h1>
        
        <div class="card">
            <h2>📊 概览统计</h2>
            <div class="stats">
                <div class="stat-item valid">
                    <div class="stat-number">${this.summary.validCount}</div>
                    <div class="stat-label">有效样本</div>
                </div>
                <div class="stat-item boundary">
                    <div class="stat-number">${this.summary.boundaryCount}</div>
                    <div class="stat-label">边界样本</div>
                </div>
                <div class="stat-item invalid">
                    <div class="stat-number">${this.summary.invalidCount}</div>
                    <div class="stat-label">非法样本</div>
                </div>
            </div>
            <p style="margin-top: 15px; text-align: center;">
                总计 <strong>${this.summary.totalSamples}</strong> 个样本，
                耗时 <strong>${this.summary.duration}ms</strong>
            </p>
        </div>

        ${this.summary.errors.length > 0 ? `
        <div class="card errors">
            <h2>⚠ 生成错误</h2>
            ${this.summary.errors.map(err => `<div class="error-item">• ${this.escapeHtml(err)}</div>`).join('')}
        </div>
        ` : ''}

        <div class="card">
            <h2>✅ 有效样本 (${samplesByType.valid.length})</h2>
            <div class="sample-grid">
                ${samplesByType.valid.slice(0, 5).map(s => this.buildSampleCard(s)).join('')}
                ${samplesByType.valid.length > 5 ? `<p style="text-align: center; color: #666;">... 还有 ${samplesByType.valid.length - 5} 个样本，请查看 index.json</p>` : ''}
            </div>
        </div>

        <div class="card">
            <h2>🔵 边界样本 (${samplesByType.boundary.length})</h2>
            <div class="sample-grid">
                ${samplesByType.boundary.slice(0, 5).map(s => this.buildSampleCard(s)).join('')}
                ${samplesByType.boundary.length > 5 ? `<p style="text-align: center; color: #666;">... 还有 ${samplesByType.boundary.length - 5} 个样本，请查看 index.json</p>` : ''}
            </div>
        </div>

        <div class="card">
            <h2>❌ 非法样本 (${samplesByType.invalid.length})</h2>
            <div class="sample-grid">
                ${samplesByType.invalid.slice(0, 5).map(s => this.buildSampleCard(s)).join('')}
                ${samplesByType.invalid.length > 5 ? `<p style="text-align: center; color: #666;">... 还有 ${samplesByType.invalid.length - 5} 个样本，请查看 index.json</p>` : ''}
            </div>
        </div>

        <div class="timestamp">
            生成时间: ${new Date().toLocaleString('zh-CN')} | Schema: ${path.basename(this.options.schemaPath)}
        </div>
    </div>
</body>
</html>`;
  }

  private buildSampleCard(sample: GeneratedSample): string {
    const dataStr = JSON.stringify(sample.data, null, 2);
    const isValid = sample.validationResult.isValid;
    const errorDetails = sample.validationResult.errors
      .map(e => formatErrorForReport(e))
      .join('<br>');

    return `
        <div class="sample-card ${sample.metadata.type}">
            <div class="sample-header">
                <span class="sample-id">#${sample.metadata.id}</span>
                <span class="sample-badge ${isValid ? 'valid' : 'invalid'}">
                    ${isValid ? '✓ 通过' : '✗ 不通过'}
                </span>
            </div>
            <div class="sample-reason">${this.escapeHtml(sample.metadata.reason)}</div>
            ${!isValid && sample.validationResult.errors.length > 0 ? `
                <div style="background: #fff5f5; padding: 8px; border-radius: 4px; margin-bottom: 10px; font-size: 0.85em;">
                    <strong>验证错误:</strong><br>${this.escapeHtml(errorDetails)}
                </div>
            ` : ''}
            <div class="sample-data">
                <pre>${this.escapeHtml(dataStr)}</pre>
            </div>
        </div>`;
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private sanitizeForJson(data: unknown): unknown {
    if (typeof data === 'symbol') {
      return data.toString();
    }
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeForJson(item));
    }
    if (data && typeof data === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        result[key] = this.sanitizeForJson(value);
      }
      return result;
    }
    return data;
  }
}
