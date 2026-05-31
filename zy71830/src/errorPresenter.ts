import chalk from 'chalk';
import { ValidationError, ErrorSource } from './types.js';

export class ErrorPresenter {
  private sourceEmojis: Record<ErrorSource, string> = {
    unit_table: '📊',
    terrain_rule: '🗺️',
    battle_report: '📜',
    system: '⚙️'
  };

  private sourceNames: Record<ErrorSource, string> = {
    unit_table: '单位表',
    terrain_rule: '地形规则',
    battle_report: '战报',
    system: '系统'
  };

  formatError(error: ValidationError): string {
    const lines: string[] = [];
    
    lines.push(this.formatHeader(error));
    lines.push('');
    lines.push(chalk.white(`  ${error.userMessage}`));
    lines.push('');
    
    if (error.field) {
      lines.push(chalk.gray(`  📍 问题字段：${error.field}`));
    }
    
    if (error.expected) {
      lines.push(chalk.gray(`  ✅ 期望值：${error.expected}`));
    }
    
    if (error.actual) {
      lines.push(chalk.gray(`  ❌ 实际值：${error.actual}`));
    }
    
    lines.push('');
    lines.push(chalk.yellow(`  💡 建议：${error.suggestion}`));
    lines.push(chalk.blue(`  👤 责任人：${error.responsiblePerson}`));
    lines.push('');
    lines.push(chalk.gray(`  🔧 错误代码：${error.code}`));
    
    return lines.join('\n');
  }

  private formatHeader(error: ValidationError): string {
    const emoji = this.sourceEmojis[error.source];
    const sourceName = this.sourceNames[error.source];
    const header = `${emoji} 【${sourceName}错误】`;
    return chalk.bgRed.white.bold(` ${header} `);
  }

  formatErrors(errors: ValidationError[]): string {
    if (errors.length === 0) {
      return chalk.green('✅ 没有发现任何错误！');
    }

    const lines: string[] = [];
    lines.push(chalk.red.bold(`\n❌ 发现 ${errors.length} 个问题，需要先解决才能继续：\n`));
    
    errors.forEach((error, index) => {
      lines.push(chalk.red.bold(`━━━━━━━━━━ 问题 ${index + 1}/${errors.length} ━━━━━━━━━━`));
      lines.push(this.formatError(error));
      lines.push('');
    });

    return lines.join('\n');
  }

  formatWarning(warning: ValidationError): string {
    const lines: string[] = [];
    
    const emoji = this.sourceEmojis[warning.source] || '⚠️';
    const sourceName = this.sourceNames[warning.source];
    lines.push(chalk.bgYellow.black.bold(` ${emoji} 【${sourceName}警告】 `));
    lines.push('');
    lines.push(chalk.yellow(`  ${warning.userMessage}`));
    lines.push('');
    lines.push(chalk.yellow(`  💡 建议：${warning.suggestion}`));
    
    return lines.join('\n');
  }

  formatWarnings(warnings: ValidationError[]): string {
    if (warnings.length === 0) {
      return '';
    }

    const lines: string[] = [];
    lines.push(chalk.yellow.bold(`\n⚠️  有 ${warnings.length} 个提醒，不影响运行但建议关注：\n`));
    
    warnings.forEach((warning, index) => {
      lines.push(chalk.yellow.bold(`━━━━━━━━━━ 提醒 ${index + 1}/${warnings.length} ━━━━━━━━━━`));
      lines.push(this.formatWarning(warning));
      lines.push('');
    });

    return lines.join('\n');
  }

  formatValidationSummary(errors: ValidationError[], warnings: ValidationError[]): string {
    const lines: string[] = [];
    
    if (errors.length > 0) {
      lines.push(chalk.red.bold(`\n⛔ 验证失败：${errors.length} 个错误需要修复`));
      const bySource = this.groupBySource(errors);
      for (const [source, sourceErrors] of Object.entries(bySource)) {
        if (sourceErrors.length > 0) {
          lines.push(chalk.red(`   • ${this.sourceNames[source as ErrorSource]}: ${sourceErrors.length} 个问题`));
        }
      }
    }
    
    if (warnings.length > 0) {
      lines.push(chalk.yellow(`\n⚠️  注意事项：${warnings.length} 个提醒`));
    }
    
    if (errors.length === 0 && warnings.length === 0) {
      lines.push(chalk.green('\n✅ 所有检查通过！'));
    }
    
    return lines.join('\n');
  }

  private groupBySource(errors: ValidationError[]): Record<ErrorSource, ValidationError[]> {
    const result: Record<ErrorSource, ValidationError[]> = {
      unit_table: [],
      terrain_rule: [],
      battle_report: [],
      system: []
    };
    
    for (const error of errors) {
      result[error.source].push(error);
    }
    
    return result;
  }

  getNextSteps(errors: ValidationError[]): string {
    if (errors.length === 0) {
      return chalk.green('🎉 可以开始推演了！');
    }

    const bySource = this.groupBySource(errors);
    const lines: string[] = [];
    lines.push(chalk.blue.bold('\n📋 下一步行动计划：\n'));
    
    if (bySource.unit_table.length > 0) {
      lines.push(chalk.blue(`  1️⃣  找【数值策划】处理单位表问题 (${bySource.unit_table.length}个)`));
    }
    if (bySource.terrain_rule.length > 0) {
      lines.push(chalk.blue(`  2️⃣  找【关卡策划】处理地形规则问题 (${bySource.terrain_rule.length}个)`));
    }
    if (bySource.battle_report.length > 0) {
      lines.push(chalk.blue(`  3️⃣  找【玩法策划】处理战报问题 (${bySource.battle_report.length}个)`));
    }
    if (bySource.system.length > 0) {
      lines.push(chalk.blue(`  4️⃣  找【技术开发】处理系统问题 (${bySource.system.length}个)`));
    }
    
    return lines.join('\n');
  }
}
