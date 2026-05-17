import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { table } from 'table';
import { DiagnosticReport, DirtyLine, Conflict, ResolutionResult } from './types';

export class ReportGenerator {
  generateTerminalReport(report: DiagnosticReport): string {
    const lines: string[] = [];

    lines.push(chalk.bold.blue('\n╔════════════════════════════════════════════════════════════╗'));
    lines.push(chalk.bold.blue('║           TypeScript Path Alias Diagnostic Report          ║'));
    lines.push(chalk.bold.blue('╚════════════════════════════════════════════════════════════╝\n'));

    lines.push(this.generateSummary(report));
    lines.push(this.generateDirtyLinesTable(report.dirtyLines));
    lines.push(this.generateConflictsTable(report.conflicts));
    lines.push(this.generateResolutionsSummary(report));

    return lines.join('\n');
  }

  private generateSummary(report: DiagnosticReport): string {
    const { summary } = report;
    const lines: string[] = [];

    lines.push(chalk.bold('📊 Summary'));
    lines.push(chalk.gray('─'.repeat(60)));
    
    const summaryData = [
      [chalk.white('Total Imports'), chalk.cyan(summary.totalImports.toString())],
      [chalk.white('Valid Imports'), chalk.green(summary.validImports.toString())],
      [chalk.white('Dirty Lines'), summary.dirtyLines > 0 ? chalk.yellow(summary.dirtyLines.toString()) : chalk.green('0')],
      [chalk.white('Conflicts'), summary.conflicts > 0 ? chalk.red(summary.conflicts.toString()) : chalk.green('0')],
    ];

    lines.push(table(summaryData, {
      border: {
        topBody: '',
        topJoin: '',
        topLeft: '',
        topRight: '',
        bottomBody: '',
        bottomJoin: '',
        bottomLeft: '',
        bottomRight: '',
        bodyLeft: '│',
        bodyRight: '│',
        bodyJoin: '│',
        joinBody: '',
        joinLeft: '',
        joinRight: '',
        joinJoin: '',
      },
      drawHorizontalLine: () => false,
    }));

    return lines.join('\n');
  }

  private generateDirtyLinesTable(dirtyLines: DirtyLine[]): string {
    if (dirtyLines.length === 0) return '';

    const lines: string[] = [];
    lines.push(chalk.bold.yellow('\n⚠️  Dirty Lines (Parse Errors)'));
    lines.push(chalk.gray('─'.repeat(60)));

    const data = [
      [chalk.bold('Line'), chalk.bold('Category'), chalk.bold('Reason'), chalk.bold('Raw Line')],
      ...dirtyLines.map(dl => [
        chalk.yellow(dl.lineNumber.toString()),
        chalk.magenta(dl.category),
        chalk.red(dl.reason),
        chalk.gray(dl.rawLine.slice(0, 40) + (dl.rawLine.length > 40 ? '...' : '')),
      ]),
    ];

    lines.push(table(data, {
      columns: [{ width: 6 }, { width: 15 }, { width: 20 }, { width: 45 }],
    }));

    return lines.join('\n');
  }

  private generateConflictsTable(conflicts: Conflict[]): string {
    if (conflicts.length === 0) return '';

    const lines: string[] = [];
    lines.push(chalk.bold.red('\n❌ Conflicts Detected'));
    lines.push(chalk.gray('─'.repeat(60)));

    for (const conflict of conflicts) {
      lines.push(`${chalk.red('●')} ${chalk.bold(conflict.importPath)}`);
      lines.push(`   ${chalk.gray('Type:')} ${chalk.magenta(conflict.type)}`);
      lines.push(`   ${chalk.gray('Description:')} ${conflict.description}`);
      lines.push(`   ${chalk.gray('Environment differences:')}`);
      
      for (const [env, data] of Object.entries(conflict.environments)) {
        const status = data.fileExists ? chalk.green('✓') : chalk.red('✗');
        lines.push(`     ${status} ${chalk.cyan(env)}: ${chalk.gray(data.resolvedPath)}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  private generateResolutionsSummary(report: DiagnosticReport): string {
    const lines: string[] = [];
    lines.push(chalk.bold.green('\n✅ Resolution Results by Environment'));
    lines.push(chalk.gray('─'.repeat(60)));

    for (const envResolution of report.resolutions) {
      const successCount = envResolution.results.filter(r => r.fileExists).length;
      const totalCount = envResolution.results.length;
      const percentage = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 100;
      
      lines.push(`\n${chalk.cyan.bold(envResolution.environment)}: ${chalk.green(`${successCount}/${totalCount}`)} files exist (${percentage}%)`);
    }

    return lines.join('\n');
  }

  generateMachineReadableReport(report: DiagnosticReport, outputPath: string): void {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
  }

  generateHumanReadableReport(report: DiagnosticReport, outputPath: string): void {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const markdown = this.generateMarkdownReport(report);
    fs.writeFileSync(outputPath, markdown, 'utf-8');
  }

  private generateMarkdownReport(report: DiagnosticReport): string {
    const lines: string[] = [];

    lines.push('# TypeScript Path Alias Diagnostic Report');
    lines.push(`Generated: ${report.timestamp}`);
    lines.push('');

    lines.push('## Summary');
    lines.push('| Metric | Count | Status |');
    lines.push('|--------|-------|--------|');
    lines.push(`| Total Imports | ${report.summary.totalImports} | |`);
    lines.push(`| Valid Imports | ${report.summary.validImports} | ✅ |`);
    lines.push(`| Dirty Lines | ${report.summary.dirtyLines} | ${report.summary.dirtyLines > 0 ? '⚠️' : '✅'} |`);
    lines.push(`| Conflicts | ${report.summary.conflicts} | ${report.summary.conflicts > 0 ? '❌' : '✅'} |`);
    lines.push('');

    if (report.dirtyLines.length > 0) {
      lines.push('## ⚠️ Dirty Lines (Parse Errors)');
      lines.push('');
      lines.push('| Line | Category | Reason | Raw Line |');
      lines.push('|------|----------|--------|----------|');
      
      for (const dl of report.dirtyLines) {
        const escapedLine = dl.rawLine.replace(/\|/g, '\\|');
        lines.push(`| ${dl.lineNumber} | ${dl.category} | ${dl.reason} | \`${escapedLine}\` |`);
      }
      lines.push('');
    }

    if (report.conflicts.length > 0) {
      lines.push('## ❌ Conflicts Detected');
      lines.push('');
      
      for (const conflict of report.conflicts) {
        lines.push(`### \`${conflict.importPath}\``);
        lines.push(`- **Type**: ${conflict.type}`);
        lines.push(`- **Description**: ${conflict.description}`);
        lines.push('');
        lines.push('| Environment | Resolved Path | File Exists |');
        lines.push('|-------------|---------------|-------------|');
        
        for (const [env, data] of Object.entries(conflict.environments)) {
          lines.push(`| ${env} | \`${data.resolvedPath}\` | ${data.fileExists ? '✅ Yes' : '❌ No'} |`);
        }
        lines.push('');
      }
    }

    lines.push('## Path Alias Configuration');
    lines.push('');
    lines.push('| Alias | Target Paths |');
    lines.push('|-------|--------------|');
    
    for (const [alias, targets] of Object.entries(report.paths)) {
      lines.push(`| \`${alias}\` | ${targets.map(t => `\`${t}\``).join(', ')} |`);
    }
    lines.push('');

    lines.push('## Resolution Details');
    lines.push('');
    
    for (const envResolution of report.resolutions) {
      lines.push(`### ${envResolution.environment}`);
      lines.push('');
      lines.push('| Import Path | Resolved Path | File Exists | Matched Alias |');
      lines.push('|-------------|---------------|-------------|---------------|');
      
      for (const result of envResolution.results) {
        lines.push(`| \`${result.originalPath}\` | \`${result.resolvedPath}\` | ${result.fileExists ? '✅' : '❌'} | ${result.matchedAlias ? `\`${result.matchedAlias}\`` : '-'} |`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  getExitCode(report: DiagnosticReport): number {
    if (report.summary.conflicts > 0 || report.summary.dirtyLines > 0) {
      return 1;
    }
    return 0;
  }
}