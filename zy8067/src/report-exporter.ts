import { writeFile } from 'fs/promises';
import { join } from 'path';
import { CompatibilityReport, HookExecutionResult } from './types.js';

export class ReportExporter {
  async export(pluginDir: string, report: CompatibilityReport): Promise<void> {
    await this.exportMarkdown(pluginDir, report);
    await this.exportTraces(pluginDir, report);
  }

  private async exportMarkdown(pluginDir: string, report: CompatibilityReport): Promise<void> {
    const content = this.generateMarkdown(report);
    await writeFile(join(pluginDir, 'compatibility_report.md'), content, 'utf-8');
  }

  private async exportTraces(pluginDir: string, report: CompatibilityReport): Promise<void> {
    const lines = report.results.map(result => JSON.stringify({
      timestamp: report.timestamp,
      ...result
    }));
    await writeFile(join(pluginDir, 'traces.jsonl'), lines.join('\n'), 'utf-8');
  }

  private generateMarkdown(report: CompatibilityReport): string {
    const lines: string[] = [];

    lines.push('# Plugin Compatibility Report');
    lines.push('');
    lines.push(`**Generated:** ${new Date(report.timestamp).toLocaleString()}`);
    lines.push('');
    lines.push('## Plugin Information');
    lines.push('');
    lines.push(`- **Name:** ${report.plugin.name}`);
    lines.push(`- **Version:** ${report.plugin.version}`);
    lines.push(`- **Platform Version:** ${report.plugin.platformVersion}`);
    lines.push('');
    lines.push('## Summary');
    lines.push('');
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Total Tests | ${report.summary.total} |`);
    lines.push(`| ✅ Passed | ${report.summary.passed} |`);
    lines.push(`| ❌ Failed | ${report.summary.failed} |`);
    lines.push(`| ⚠️ Warnings | ${report.summary.warnings} |`);
    lines.push('');
    lines.push('## Detailed Results');
    lines.push('');

    report.results.forEach((result, index) => {
      lines.push(`### ${index + 1}. ${result.fixtureName} (${result.hookId})`);
      lines.push('');
      lines.push(`**Status:** ${result.success ? '✅ Passed' : '❌ Failed'}`);
      lines.push(`**Duration:** ${result.duration}ms`);
      lines.push('');
      
      const checks = [
        { label: 'Version Compatible', value: result.versionCompatible },
        { label: 'Input Valid', value: result.inputValid },
        { label: 'Output Valid', value: result.outputValid },
        { label: 'Timed Out', value: !result.timedOut, invert: true },
        { label: 'Side Effects', value: !result.sideEffectsDetected, invert: true }
      ];

      checks.forEach(check => {
        const status = check.value ? '✅' : '❌';
        lines.push(`- ${status} ${check.label}`);
      });

      if (result.error) {
        lines.push('');
        lines.push('**Error:**');
        lines.push('```');
        lines.push(result.error);
        lines.push('```');
      }

      if (result.output !== undefined) {
        lines.push('');
        lines.push('**Output:**');
        lines.push('```json');
        lines.push(JSON.stringify(result.output, null, 2));
        lines.push('```');
      }

      lines.push('');
    });

    return lines.join('\n');
  }
}