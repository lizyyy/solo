import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import {
  ValidationResult,
  FuzzRule,
  CoverageStats,
  FuzzReport,
  CLIOptions,
} from '../types';

const packageJson = require('../../package.json');

export class ReportGenerator {
  private outputDir: string;
  private options: CLIOptions;

  constructor(outputDir: string, options: CLIOptions) {
    this.outputDir = outputDir;
    this.options = options;
  }

  public generateReport(
    validationResults: ValidationResult[],
    rules: FuzzRule[],
    coverage: CoverageStats,
    inputFile: string
  ): FuzzReport {
    const passed = validationResults.filter(r => r.valid).length;
    const failed = validationResults.filter(r => !r.valid).length;
    const totalDuration = validationResults.reduce((sum, r) => sum + r.durationMs, 0);

    return {
      metadata: {
        timestamp: new Date().toISOString(),
        version: packageJson.version,
        inputFile,
        command: process.argv.join(' '),
      },
      summary: {
        totalTests: validationResults.length,
        passed,
        failed,
        passRate: validationResults.length > 0 ? passed / validationResults.length : 0,
        durationMs: totalDuration,
      },
      coverage,
      failures: validationResults.filter(r => !r.valid),
      allResults: validationResults,
      rules,
    };
  }

  public printSummary(report: FuzzReport): void {
    const { summary, coverage, failures } = report;

    console.log('');
    console.log(chalk.bold('═══════════════════════════════════════════'));
    console.log(chalk.bold('           OpenAPI Fuzz Results'));
    console.log(chalk.bold('═══════════════════════════════════════════'));
    console.log('');

    console.log(chalk.cyan('📊 Summary'));
    console.log(`  Total Tests:     ${summary.totalTests}`);
    console.log(`  ${chalk.green('✓ Passed:')}        ${summary.passed}`);
    console.log(`  ${chalk.red('✗ Failed:')}        ${summary.failed}`);
    console.log(`  Pass Rate:       ${(summary.passRate * 100).toFixed(1)}%`);
    console.log(`  Duration:        ${summary.durationMs}ms`);
    console.log('');

    console.log(chalk.cyan('📈 Coverage'));
    console.log(`  Rules Applied:   ${coverage.appliedRules}/${coverage.totalRules}`);
    console.log(`  Samples Found:   ${coverage.totalSamples}`);
    console.log(`  Perturbations:   ${coverage.perturbedSamples}`);
    console.log(`  Schema Paths:    ${coverage.schemaPathsCovered.length}`);
    console.log('');

    if (Object.keys(coverage.ruleCoverage).length > 0) {
      console.log(chalk.gray('  Rule Coverage Details:'));
      for (const [ruleId, count] of Object.entries(coverage.ruleCoverage)) {
        const rule = report.rules.find(r => r.id === ruleId);
        if (rule && count > 0) {
          console.log(chalk.gray(`    - ${rule.name}: ${count} applications`));
        }
      }
      console.log('');
    }

    if (failures.length > 0) {
      console.log(chalk.red('❌ Failures'));
      failures.slice(0, 10).forEach((failure, idx) => {
        const sample = failure.sample;
        console.log(`\n  ${idx + 1}. ${chalk.bold(sample.ruleName)}`);
        console.log(`     Location:    ${sample.original.location.jsonPath}`);
        console.log(`     Operation:   ${sample.perturbationDescription}`);
        console.log(`     Original:    ${JSON.stringify(sample.original.value).slice(0, 100)}`);
        console.log(`     Perturbed:   ${JSON.stringify(sample.perturbedValue).slice(0, 100)}`);
        console.log(`     Errors:`);
        failure.errors.forEach(err => {
          console.log(`       - ${err.keyword}: ${err.message || 'validation failed'}`);
          if (err.instancePath) {
            console.log(`         Path: ${err.instancePath}`);
          }
        });
      });

      if (failures.length > 10) {
        console.log(`\n  ... and ${failures.length - 10} more failures. See full report for details.`);
      }
      console.log('');
    } else {
      console.log(chalk.green('✅ All tests passed!'));
      console.log('');
    }
  }

  public writeJsonReport(report: FuzzReport): void {
    const filePath = path.join(this.outputDir, 'fuzz-report.json');
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(chalk.gray(`  JSON report: ${filePath}`));
  }

  public writeHtmlReport(report: FuzzReport): void {
    const filePath = path.join(this.outputDir, 'fuzz-report.html');
    const html = this.generateHtml(report);
    fs.writeFileSync(filePath, html, 'utf-8');
    console.log(chalk.gray(`  HTML report: ${filePath}`));
  }

  private generateHtml(report: FuzzReport): string {
    const { summary, coverage, failures, allResults, metadata } = report;
    const passClass = summary.failed === 0 ? 'status-pass' : 'status-fail';
    const passIcon = summary.failed === 0 ? '✅' : '⚠️';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OpenAPI Fuzz Report</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; padding: 20px; }
      .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }
      .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; }
      .header h1 { font-size: 28px; margin-bottom: 10px; }
      .header p { opacity: 0.9; }
      .content { padding: 30px; }
      .section { margin-bottom: 30px; }
      .section h2 { font-size: 20px; margin-bottom: 15px; color: #2d3748; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
      .status-pass { color: #48bb78; }
      .status-fail { color: #f56565; }
      .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
      .card { background: #f7fafc; border-radius: 6px; padding: 15px; border-left: 4px solid #667eea; }
      .card .label { font-size: 12px; text-transform: uppercase; color: #718096; letter-spacing: 0.5px; }
      .card .value { font-size: 24px; font-weight: bold; color: #2d3748; }
      .failure-item { background: #fff5f5; border: 1px solid #fed7d7; border-radius: 6px; padding: 15px; margin-bottom: 10px; }
      .failure-item h4 { color: #c53030; margin-bottom: 10px; }
      .error-list { margin-left: 20px; color: #742a2a; }
      .error-list li { margin: 5px 0; }
      .code { background: #2d3748; color: #e2e8f0; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 13px; overflow-x: auto; margin: 10px 0; }
      .metadata { font-size: 12px; color: #718096; margin-top: 10px; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      th, td { text-align: left; padding: 10px; border-bottom: 1px solid #e2e8f0; }
      th { background: #f7fafc; font-weight: 600; }
      .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 12px; font-weight: 500; }
      .badge-pass { background: #c6f6d5; color: #22543d; }
      .badge-fail { background: #fed7d7; color: #742a2a; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${passIcon} OpenAPI Fuzz Report</h1>
            <p>Generated on ${new Date(metadata.timestamp).toLocaleString()}</p>
        </div>
        <div class="content">
            <div class="section">
                <h2>Summary</h2>
                <div class="grid">
                    <div class="card">
                        <div class="label">Total Tests</div>
                        <div class="value">${summary.totalTests}</div>
                    </div>
                    <div class="card">
                        <div class="label">Passed</div>
                        <div class="value status-pass">${summary.passed}</div>
                    </div>
                    <div class="card">
                        <div class="label">Failed</div>
                        <div class="value status-fail">${summary.failed}</div>
                    </div>
                    <div class="card">
                        <div class="label">Pass Rate</div>
                        <div class="value ${passClass}">${(summary.passRate * 100).toFixed(1)}%</div>
                    </div>
                </div>
            </div>

            <div class="section">
                <h2>Coverage</h2>
                <div class="grid">
                    <div class="card">
                        <div class="label">Rules Applied</div>
                        <div class="value">${coverage.appliedRules}/${coverage.totalRules}</div>
                    </div>
                    <div class="card">
                        <div class="label">Samples Found</div>
                        <div class="value">${coverage.totalSamples}</div>
                    </div>
                    <div class="card">
                        <div class="label">Perturbations</div>
                        <div class="value">${coverage.perturbedSamples}</div>
                    </div>
                    <div class="card">
                        <div class="label">Schema Paths Covered</div>
                        <div class="value">${coverage.schemaPathsCovered.length}</div>
                    </div>
                </div>
            </div>

            ${failures.length > 0 ? `
            <div class="section">
                <h2>Failures (${failures.length})</h2>
                ${failures.map(failure => `
                <div class="failure-item">
                    <h4>${failure.sample.ruleName}</h4>
                    <p><strong>Location:</strong> ${failure.sample.original.location.jsonPath}</p>
                    <p><strong>Operation:</strong> ${failure.sample.perturbationDescription}</p>
                    <div><strong>Original Value:</strong></div>
                    <div class="code">${this.escapeHtml(JSON.stringify(failure.sample.original.value, null, 2))}</div>
                    <div><strong>Perturbed Value:</strong></div>
                    <div class="code">${this.escapeHtml(JSON.stringify(failure.sample.perturbedValue, null, 2))}</div>
                    <div><strong>Errors:</strong></div>
                    <ul class="error-list">
                        ${failure.errors.map(err => `
                            <li>
                                <strong>${err.keyword}:</strong> ${err.message || 'validation failed'}
                                ${err.instancePath ? `<br><em>Path: ${err.instancePath}</em>` : ''}
                            </li>
                        `).join('')}
                    </ul>
                </div>
                `).join('')}
            </div>
            ` : ''}

            <div class="section">
                <h2>All Results</h2>
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Rule</th>
                            <th>Status</th>
                            <th>Location</th>
                            <th>Duration</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${allResults.map(result => `
                        <tr>
                            <td>${result.sample.id}</td>
                            <td>${result.sample.ruleName}</td>
                            <td><span class="badge ${result.valid ? 'badge-pass' : 'badge-fail'}">${result.valid ? 'PASS' : 'FAIL'}</span></td>
                            <td><code>${result.sample.original.location.jsonPath}</code></td>
                            <td>${result.durationMs}ms</td>
                        </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <div class="metadata">
                <p><strong>Input File:</strong> ${metadata.inputFile}</p>
                <p><strong>Tool Version:</strong> ${metadata.version}</p>
                <p><strong>Command:</strong> <code>${this.escapeHtml(metadata.command)}</code></p>
            </div>
        </div>
    </div>
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
