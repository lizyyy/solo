import chalk from 'chalk';
import { PreviewReport, FilePreviewResult } from './types';

export class ReportGenerator {
  generateTerminalSummary(report: PreviewReport): string {
    const lines: string[] = [];
    const { summary } = report;

    lines.push('');
    lines.push(chalk.bold.cyan('═'.repeat(60)));
    lines.push(chalk.bold.cyan('           JSON PATCH 预演报告摘要'));
    lines.push(chalk.bold.cyan('═'.repeat(60)));
    lines.push('');

    lines.push(`${chalk.bold('📁 处理文件:')} ${summary.totalFiles} 个`);
    lines.push(`${chalk.bold('📝 补丁总数:')} ${summary.totalPatches} 个`);
    lines.push('');

    if (summary.errorCount > 0) {
      lines.push(chalk.red(`  ❌ 错误: ${summary.errorCount} 个`));
    }
    if (summary.warningCount > 0) {
      lines.push(chalk.yellow(`  ⚠️  警告: ${summary.warningCount} 个`));
    }
    if (summary.conflictCount > 0) {
      lines.push(chalk.magenta(`  🔀 冲突: ${summary.conflictCount} 个`));
    }
    lines.push('');

    lines.push(`${chalk.bold('✅ 成功文件:')} ${summary.successCount} 个`);
    lines.push(`${chalk.bold('🔄 有变更:')} ${summary.changedFiles} 个`);
    lines.push('');

    report.results.forEach((result) => {
      const statusIcon = result.success ? chalk.green('✅') : chalk.red('❌');
      lines.push(`${statusIcon} ${result.filePath}`);
      
      const errors = result.conflicts.filter(c => c.severity === 'error');
      const warnings = result.conflicts.filter(c => c.severity === 'warning');
      
      if (errors.length > 0) {
        lines.push(`     ${chalk.red(`错误: ${errors.length}`)}`);
        errors.slice(0, 2).forEach(e => {
          lines.push(`       • ${e.path}: ${e.message}`);
        });
        if (errors.length > 2) {
          lines.push(`       ... 还有 ${errors.length - 2} 个错误`);
        }
      }
      
      if (warnings.length > 0) {
        lines.push(`     ${chalk.yellow(`警告: ${warnings.length}`)}`);
      }
      
      if (result.diff.length > 0) {
        lines.push(`     ${chalk.blue(`变更: ${result.diff.length} 处`)}`);
      }
    });

    lines.push('');
    lines.push(chalk.gray('  详细报告请查看输出文件'));
    lines.push('');

    return lines.join('\n');
  }

  generateMachineReadable(report: PreviewReport): string {
    return JSON.stringify(report, null, 2);
  }

  generateHumanReadable(report: PreviewReport): string {
    const lines: string[] = [];

    lines.push('# JSON Patch 预演报告');
    lines.push('');
    lines.push(`生成时间: ${report.generatedAt}`);
    lines.push('');
    lines.push('## 摘要');
    lines.push('');
    lines.push(`- **处理文件**: ${report.summary.totalFiles} 个`);
    lines.push(`- **补丁总数**: ${report.summary.totalPatches} 个`);
    lines.push(`- **成功文件**: ${report.summary.successCount} 个`);
    lines.push(`- **有变更**: ${report.summary.changedFiles} 个`);
    lines.push(`- **错误**: ${report.summary.errorCount} 个`);
    lines.push(`- **警告**: ${report.summary.warningCount} 个`);
    lines.push(`- **冲突**: ${report.summary.conflictCount} 个`);
    lines.push('');

    report.results.forEach((result) => {
      lines.push('---');
      lines.push('');
      lines.push(`## 文件: \`${result.filePath}\``);
      lines.push('');
      lines.push(`**状态**: ${result.success ? '✅ 成功' : '❌ 失败'}`);
      lines.push('');

      if (result.validation.errors.length > 0) {
        lines.push('### 📋 验证错误');
        lines.push('');
        result.validation.errors.forEach((err, i) => {
          lines.push(`${i + 1}. **[${err.type}]** ${err.message}`);
          if (err.patchIndex !== undefined) {
            lines.push(`   - 补丁位置: #${err.patchIndex}`);
          }
          if (err.path) {
            lines.push(`   - 路径: \`${err.path}\``);
          }
        });
        lines.push('');
      }

      if (result.validation.warnings.length > 0) {
        lines.push('### ⚠️  验证警告');
        lines.push('');
        result.validation.warnings.forEach((warn, i) => {
          lines.push(`${i + 1}. **[${warn.type}]** ${warn.message}`);
          if (warn.patchIndex !== undefined) {
            lines.push(`   - 补丁位置: #${warn.patchIndex}`);
          }
        });
        lines.push('');
      }

      if (result.conflicts.length > 0) {
        lines.push('### 🔀 冲突检测');
        lines.push('');
        result.conflicts.forEach((conflict, i) => {
          const severity = conflict.severity === 'error' ? '🔴' : '🟡';
          lines.push(`${i + 1}. ${severity} **[${conflict.type}]** \`${conflict.path}\``);
          lines.push(`   ${conflict.message}`);
          if (conflict.patchIndex !== undefined) {
            lines.push(`   - 补丁位置: #${conflict.patchIndex}`);
          }
          if (conflict.existingValue !== undefined) {
            lines.push(`   - 现有值: \`${JSON.stringify(conflict.existingValue)}\``);
          }
          if (conflict.newValue !== undefined) {
            lines.push(`   - 新值: \`${JSON.stringify(conflict.newValue)}\``);
          }
          lines.push('');
        });
      }

      if (result.diff.length > 0) {
        lines.push('### 🔄 变更详情');
        lines.push('');
        result.diff.forEach((diff, i) => {
          const opIcon = diff.op === 'add' ? '➕' : diff.op === 'remove' ? '➖' : '🔄';
          lines.push(`${i + 1}. ${opIcon} **${diff.op.toUpperCase()}** \`${diff.path}\``);
          if (diff.oldValue !== undefined) {
            lines.push(`   - 旧值: \`${JSON.stringify(diff.oldValue)}\``);
          }
          if (diff.newValue !== undefined) {
            lines.push(`   - 新值: \`${JSON.stringify(diff.newValue)}\``);
          }
          lines.push('');
        });
      }

      if (result.success) {
        lines.push('### 📝 补丁预览');
        lines.push('');
        lines.push('```json');
        lines.push(JSON.stringify(result.patchedJson, null, 2));
        lines.push('```');
        lines.push('');
      }

      lines.push('### 📜 补丁列表');
      lines.push('');
      lines.push('| # | 操作 | 路径 | 值 |');
      lines.push('|---|------|------|----|');
      result.patches.forEach((patch, i) => {
        const value = patch.value !== undefined ? JSON.stringify(patch.value).substring(0, 50) : '-';
        lines.push(`| ${i} | ${patch.op} | \`${patch.path}\` | ${value} |`);
      });
      lines.push('');
    });

    return lines.join('\n');
  }

  generateReport(results: FilePreviewResult[]): PreviewReport {
    let errorCount = 0;
    let warningCount = 0;
    let conflictCount = 0;
    let successCount = 0;
    let changedFiles = 0;
    let totalPatches = 0;

    results.forEach(r => {
      totalPatches += r.patches.length;
      conflictCount += r.conflicts.length;
      errorCount += r.conflicts.filter(c => c.severity === 'error').length + r.validation.errors.length;
      warningCount += r.conflicts.filter(c => c.severity === 'warning').length + r.validation.warnings.length;
      if (r.success) successCount++;
      if (r.diff.length > 0) changedFiles++;
    });

    return {
      summary: {
        totalFiles: results.length,
        totalPatches,
        successCount,
        conflictCount,
        errorCount,
        warningCount,
        changedFiles
      },
      results,
      generatedAt: new Date().toISOString()
    };
  }

  getExitCode(report: PreviewReport): number {
    return report.summary.errorCount > 0 ? 1 : 0;
  }
}
