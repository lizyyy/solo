import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import Table from 'cli-table3';
import { EnumReport, EnumDiff, BadEntry, ProcessingError } from './types';

export class ReportGenerator {
  generateTerminalReport(report: EnumReport): string {
    const lines: string[] = [];

    lines.push(this.generateHeader());
    lines.push('');
    lines.push(this.generateSummarySection(report));
    lines.push('');

    if (report.differences.length > 0) {
      lines.push(this.generateDifferencesSection(report.differences));
      lines.push('');
    }

    if (report.badEntries.length > 0) {
      lines.push(this.generateBadEntriesSection(report.badEntries));
      lines.push('');
    }

    if (report.errors.length > 0) {
      lines.push(this.generateErrorsSection(report.errors));
      lines.push('');
    }

    lines.push(this.generateFooter(report));

    return lines.join('\n');
  }

  generateJsonReport(report: EnumReport): string {
    return JSON.stringify(report, null, 2);
  }

  generateMarkdownReport(report: EnumReport): string {
    const lines: string[] = [];

    lines.push('# API 枚举契约检查报告');
    lines.push('');
    lines.push(`**生成时间**: ${report.timestamp.toLocaleString()}`);
    lines.push('');

    lines.push('## 📊 概览');
    lines.push('');
    lines.push('| 指标 | 数值 |');
    lines.push('|------|------|');
    lines.push(`| 总枚举数 | ${report.summary.totalEnums} |`);
    lines.push(`| ✅ 匹配枚举 | ${report.summary.matchedEnums} |`);
    lines.push(`| ❌ 不匹配枚举 | ${report.summary.mismatchedEnums} |`);
    lines.push(`| ⚠️  异常条目 | ${report.summary.totalBadEntries} |`);
    lines.push(`| ❌ 处理错误 | ${report.summary.errors} |`);
    lines.push('');

    lines.push('## 📁 扫描文件');
    lines.push('');
    lines.push('### OpenAPI 文件');
    lines.push('');
    report.metadata.openApiFiles.forEach(f => lines.push(`- \`${f}\``));
    lines.push('');
    lines.push('### 源代码文件');
    lines.push('');
    report.metadata.sourceFiles.forEach(f => lines.push(`- \`${f}\``));
    lines.push('');

    if (report.differences.length > 0) {
      lines.push('## 🔍 枚举差异');
      lines.push('');

      for (const diff of report.differences) {
        lines.push(`### 📌 ${diff.enumName}`);
        lines.push('');

        if (diff.onlyInOpenApi.length > 0) {
          lines.push('#### ❌ 仅在 OpenAPI 文档中存在');
          lines.push('');
          diff.onlyInOpenApi.forEach(v => {
            const location = v.line ? ` (行 ${v.line}${v.column ? `, 列 ${v.column}` : ''})` : '';
            lines.push(`- \`${v.value}\`${location}`);
          });
          lines.push('');
        }

        if (diff.onlyInSource.length > 0) {
          lines.push('#### ❌ 仅在源代码中存在');
          lines.push('');
          diff.onlyInSource.forEach(v => {
            const location = v.line ? ` (行 ${v.line}${v.column ? `, 列 ${v.column}` : ''})` : '';
            lines.push(`- \`${v.value}\`${location}`);
          });
          lines.push('');
        }
      }
    }

    if (report.badEntries.length > 0) {
      lines.push('## ⚠️  异常条目');
      lines.push('');

      for (const entry of report.badEntries) {
        const location = entry.line ? `行 ${entry.line}${entry.column ? `, 列 ${entry.column}` : ''}` : '未知位置';
        const severity = entry.severity === 'error' ? '🔴' : '🟡';
        lines.push(`### ${severity} ${path.basename(entry.filePath)} - ${location}`);
        lines.push('');
        lines.push(`**原因**: ${entry.reason}`);
        lines.push('');
        if (entry.rawContent) {
          lines.push('**原始内容**:');
          lines.push('```');
          lines.push(entry.rawContent.substring(0, 200));
          if (entry.rawContent.length > 200) lines.push('...');
          lines.push('```');
        }
        lines.push('');
      }
    }

    if (report.errors.length > 0) {
      lines.push('## ❌ 处理错误');
      lines.push('');

      for (const error of report.errors) {
        lines.push(`### 📄 ${path.basename(error.filePath)}`);
        lines.push('');
        lines.push(`**错误**: ${error.error}`);
        lines.push('');
      }
    }

    lines.push('---');
    lines.push('');
    lines.push('*此报告由 API Enum CLI 自动生成*');

    return lines.join('\n');
  }

  saveReport(report: string, outputPath: string): void {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, report, 'utf-8');
  }

  private generateHeader(): string {
    return chalk.bold.cyan(`
╔══════════════════════════════════════════════════════════════╗
║                    API 枚举契约检查工具                        ║
║                    API Enum Contract Checker                  ║
╚══════════════════════════════════════════════════════════════╝
`);
  }

  private generateSummarySection(report: EnumReport): string {
    const table = new Table({
      head: [
        chalk.bold('指标'),
        chalk.bold('数值'),
        chalk.bold('状态')
      ],
      colWidths: [20, 15, 15]
    });

    table.push(
      ['总枚举数', report.summary.totalEnums.toString(), ''],
      ['匹配枚举', report.summary.matchedEnums.toString(), chalk.green('✅')],
      ['不匹配枚举', report.summary.mismatchedEnums.toString(), report.summary.mismatchedEnums > 0 ? chalk.red('❌') : ''],
      ['异常条目', report.summary.totalBadEntries.toString(), report.summary.totalBadEntries > 0 ? chalk.yellow('⚠️') : ''],
      ['处理错误', report.summary.errors.toString(), report.summary.errors > 0 ? chalk.red('❌') : '']
    );

    return chalk.bold('📊 检查概览\n') + table.toString();
  }

  private generateDifferencesSection(differences: EnumDiff[]): string {
    const lines: string[] = [];
    lines.push(chalk.bold('🔍 枚举差异详情'));
    lines.push('');

    for (const diff of differences) {
      lines.push(chalk.bold.yellow(`📌 ${diff.enumName}`));

      if (diff.onlyInOpenApi.length > 0) {
        lines.push('');
        lines.push(chalk.red('   ❌ 仅在 OpenAPI 文档中存在:'));
        diff.onlyInOpenApi.forEach(v => {
          const location = v.line ? ` (行 ${v.line})` : '';
          lines.push(chalk.red(`      • ${v.value}${location}`));
        });
      }

      if (diff.onlyInSource.length > 0) {
        lines.push('');
        lines.push(chalk.magenta('   ❌ 仅在源代码中存在:'));
        diff.onlyInSource.forEach(v => {
          const location = v.line ? ` (行 ${v.line})` : '';
          lines.push(chalk.magenta(`      • ${v.value}${location}`));
        });
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  private generateBadEntriesSection(badEntries: BadEntry[]): string {
    const lines: string[] = [];
    lines.push(chalk.bold('⚠️  异常条目详情'));
    lines.push('');

    for (const entry of badEntries) {
      const severity = entry.severity === 'error' ? chalk.red('🔴') : chalk.yellow('🟡');
      const location = entry.line ? `行 ${entry.line}${entry.column ? `, 列 ${entry.column}` : ''}` : '未知位置';
      
      lines.push(`${severity} ${chalk.bold(path.basename(entry.filePath))} - ${location}`);
      lines.push(chalk.gray(`   原因: ${entry.reason}`));
      if (entry.rawContent) {
        lines.push(chalk.gray(`   内容: ${entry.rawContent.substring(0, 80)}${entry.rawContent.length > 80 ? '...' : ''}`));
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  private generateErrorsSection(errors: ProcessingError[]): string {
    const lines: string[] = [];
    lines.push(chalk.bold('❌ 处理错误详情'));
    lines.push('');

    for (const error of errors) {
      lines.push(chalk.red(`   📄 ${path.basename(error.filePath)}`));
      lines.push(chalk.red(`      ${error.error}`));
      lines.push('');
    }

    return lines.join('\n');
  }

  private generateFooter(report: EnumReport): string {
    const hasIssues = report.summary.mismatchedEnums > 0 || report.summary.errors > 0;
    const status = hasIssues ? chalk.red('❌ 检查失败 - 存在差异或错误') : chalk.green('✅ 检查通过 - 所有枚举一致');

    return `
${chalk.bold('══════════════════════════════════════════════════════════════')}
${status}
${chalk.gray(`生成时间: ${report.timestamp.toLocaleString()}`)}
${chalk.bold('══════════════════════════════════════════════════════════════')}
`;
  }

  getExitCode(report: EnumReport, failOnError: boolean): number {
    if (!failOnError) {
      return 0;
    }
    return report.summary.mismatchedEnums > 0 || report.summary.errors > 0 ? 1 : 0;
  }
}
