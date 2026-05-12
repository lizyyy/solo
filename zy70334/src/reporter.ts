import chalk from 'chalk';
import { AggregatedSample, ScanResult } from './types';

export class Reporter {
  private formatNumber(num: number): string {
    return num.toLocaleString();
  }

  private formatAmount(amount: number): string {
    if (amount === 0) return '¥0.00';
    return `¥${amount.toFixed(2)}`;
  }

  private formatDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return dateStr;
    }
  }

  private getSeverityColor(severity: string): (text: string) => string {
    switch (severity) {
      case 'critical':
        return chalk.red.bold;
      case 'high':
        return chalk.red;
      case 'medium':
        return chalk.yellow;
      case 'low':
        return chalk.gray;
      default:
        return chalk.white;
    }
  }

  public printScanResult(result: ScanResult): void {
    console.log('\n' + chalk.bold.blue('═══════════════════════════════════════════════════════════'));
    console.log(chalk.bold.blue('                    日志扫描结果'));
    console.log(chalk.bold.blue('═══════════════════════════════════════════════════════════\n'));

    console.log(chalk.bold('📊 基本信息:'));
    console.log(`  总日志条目数: ${chalk.green(this.formatNumber(result.totalEntries))}`);
    console.log(`  成功解析条目: ${chalk.green(this.formatNumber(result.parsedEntries))}`);
    console.log(`  时间范围: ${chalk.cyan(this.formatDate(result.dateRange.start))} ~ ${chalk.cyan(this.formatDate(result.dateRange.end))}`);

    console.log('\n' + chalk.bold('⚠️  字段缺失统计:'));
    const missingStats = [
      { label: '缺少订单号', count: result.missingOrderId },
      { label: '缺少租户ID', count: result.missingTenantId },
      { label: '缺少错误码', count: result.missingErrorCode },
      { label: '缺少金额', count: result.missingAmount }
    ];

    missingStats.forEach(stat => {
      const color = stat.count > 0 ? chalk.yellow : chalk.gray;
      console.log(`  ${stat.label}: ${color(this.formatNumber(stat.count))}`);
    });

    if (result.negativeAmount > 0) {
      console.log(`  ${chalk.red('负金额记录')}: ${chalk.red.bold(this.formatNumber(result.negativeAmount))}`);
    }

    console.log('\n' + chalk.bold('🏷️  发现的错误码:'));
    if (result.unknownErrorCodes.length > 0) {
      result.unknownErrorCodes.forEach(code => {
        console.log(`  • ${code}`);
      });
    } else {
      console.log(`  ${chalk.gray('未发现错误码')}`);
    }

    console.log('\n' + chalk.bold.blue('═══════════════════════════════════════════════════════════\n'));
  }

  public printSamples(samples: AggregatedSample[]): void {
    const activeSamples = samples.filter(s => !s.isSuppressed);
    const suppressedSamples = samples.filter(s => s.isSuppressed);

    console.log('\n' + chalk.bold.green('═══════════════════════════════════════════════════════════'));
    console.log(chalk.bold.green(`                   异常采样结果 (${activeSamples.length} 条)`));
    console.log(chalk.bold.green('═══════════════════════════════════════════════════════════\n'));

    if (activeSamples.length === 0) {
      console.log(chalk.gray('  未发现符合条件的异常样本\n'));
    } else {
      activeSamples.forEach((sample, index) => {
        this.printSample(sample, index + 1);
      });
    }

    if (suppressedSamples.length > 0) {
      this.printSuppressedSummary(suppressedSamples);
    }

    console.log(chalk.bold.green('═══════════════════════════════════════════════════════════\n'));
  }

  private printSample(sample: AggregatedSample, index: number): void {
    const severityColor = this.getSeverityColor(sample.severity);
    const isNew = sample.isNew;
    
    const prefix = isNew ? chalk.bold.yellow('🆕 [新错误] ') : '';
    const header = `${prefix}${chalk.bold(`样本 #${index}`)}`;

    console.log(header);
    console.log(chalk.gray('─'.repeat(60)));

    console.log(`  ${chalk.bold('错误码:')} ${severityColor(`${sample.errorCode} - ${sample.errorDescription}`)}`);
    console.log(`  ${chalk.bold('严重程度:')} ${severityColor(sample.severity.toUpperCase())}`);
    console.log(`  ${chalk.bold('优先级:')} ${chalk.cyan(this.formatNumber(sample.priority))}`);

    console.log('\n  ' + chalk.bold('📈 聚合统计:'));
    console.log(`    重复次数: ${chalk.green.bold(this.formatNumber(sample.count))}`);
    console.log(`    影响订单数: ${chalk.green(this.formatNumber(sample.uniqueOrderIds.length))}`);
    console.log(`    影响租户: ${sample.tenants.length > 0 ? sample.tenants.join(', ') : chalk.gray('未知')}`);
    console.log(`    影响金额: ${chalk.yellow.bold(this.formatAmount(sample.totalAmount))}`);
    console.log(`    平均金额: ${chalk.yellow(this.formatAmount(sample.avgAmount))}`);

    console.log('\n  ' + chalk.bold('📅 时间范围:'));
    console.log(`    首次出现: ${this.formatDate(sample.firstSeen)}`);
    console.log(`    最近出现: ${this.formatDate(sample.lastSeen)}`);

    console.log('\n  ' + chalk.bold('📄 代表性日志:'));
    console.log(`    行号: ${sample.representative.lineNumber}`);
    console.log(`    消息: ${this.truncateMessage(sample.representative.message, 120)}`);
    
    if (sample.uniqueOrderIds.length > 0) {
      console.log(`    示例订单号: ${sample.uniqueOrderIds[0]}`);
    }

    if (sample.duplicateSamples.length > 1) {
      console.log(`\n  ${chalk.bold('👥 代表的重复异常:')} ${sample.count} 条异常聚合为此样本`);
      if (sample.duplicateSamples.length > 1) {
        console.log(`    最近的 ${sample.duplicateSamples.length} 条记录已收集用于分析`);
      }
    }

    console.log('\n' + this.getPriorityAdvice(sample));
    console.log('');
  }

  private getPriorityAdvice(sample: AggregatedSample): string {
    const severityAdvice = {
      'critical': '🔴 立即处理 - 高影响核心业务',
      'high': '🟠 高优先级 - 需要快速响应',
      'medium': '🟡 中优先级 - 建议尽快处理',
      'low': '🟢 低优先级 - 可安排处理',
      'unknown': '⚪ 未知严重度 - 需要进一步分析'
    };

    let advice = `  ${chalk.bold('💡 建议:')} `;
    
    if (sample.isNew) {
      advice += `${chalk.yellow.bold('新错误首次出现，建议优先排查！')} `;
    }
    
    advice += severityAdvice[sample.severity] || severityAdvice['unknown'];
    
    if (sample.totalAmount > 10000) {
      advice += ` ${chalk.red('影响金额较大')}`;
    }
    
    if (sample.uniqueOrderIds.length > 50) {
      advice += ` ${chalk.red('影响订单众多')}`;
    }
    
    return advice;
  }

  private printSuppressedSummary(samples: AggregatedSample[]): void {
    const totalCount = samples.reduce((sum, s) => sum + s.count, 0);
    const totalAmount = samples.reduce((sum, s) => sum + s.totalAmount, 0);

    console.log('\n' + chalk.bold.gray('═══════════════════════════════════════════════════════════'));
    console.log(chalk.bold.gray(`                   已抑制的异常 (${samples.length} 类, ${totalCount} 条)`));
    console.log(chalk.bold.gray('═══════════════════════════════════════════════════════════\n'));

    console.log(`  总抑制条数: ${chalk.yellow(this.formatNumber(totalCount))}`);
    console.log(`  抑制涉及金额: ${chalk.yellow(this.formatAmount(totalAmount))}\n`);

    samples.forEach((sample, index) => {
      const reason = sample.suppressionReason || '未指定原因';
      console.log(`  ${index + 1}. ${sample.errorCode} - ${sample.errorDescription}`);
      console.log(`     数量: ${this.formatNumber(sample.count)}, 金额: ${this.formatAmount(sample.totalAmount)}`);
      console.log(`     抑制原因: ${chalk.gray(reason)}\n`);
    });
  }

  public printExplain(sample: AggregatedSample): void {
    const severityColor = this.getSeverityColor(sample.severity);

    console.log('\n' + chalk.bold.cyan('═══════════════════════════════════════════════════════════'));
    console.log(chalk.bold.cyan('                    样本详细分析'));
    console.log(chalk.bold.cyan('═══════════════════════════════════════════════════════════\n'));

    console.log(chalk.bold('📋 基本信息:'));
    console.log(`  样本ID: ${sample.id}`);
    console.log(`  错误码: ${severityColor(sample.errorCode)}`);
    console.log(`  描述: ${sample.errorDescription}`);
    console.log(`  严重程度: ${severityColor(sample.severity.toUpperCase())}`);
    console.log(`  优先级分数: ${chalk.cyan(this.formatNumber(sample.priority))}`);

    console.log('\n' + chalk.bold('📊 聚合维度分析:'));
    console.log(`  ${chalk.green('✓ 订单号聚合')}: ${sample.uniqueOrderIds.length} 个不同订单被合并`);
    console.log(`  ${chalk.green('✓ 租户聚合')}: ${sample.tenants.length} 个租户受影响`);
    console.log(`  ${chalk.green('✓ 错误码聚合')}: 相同错误码 "${sample.errorCode}" 归类`);
    console.log(`  ${chalk.green('✓ 时间窗口')}: ${this.formatDate(sample.timeWindow)} 窗口内聚合`);

    console.log('\n' + chalk.bold('💰 影响分析:'));
    console.log(`  异常总数: ${chalk.green.bold(this.formatNumber(sample.count))}`);
    console.log(`  影响金额: ${chalk.yellow.bold(this.formatAmount(sample.totalAmount))}`);
    console.log(`  平均金额: ${chalk.yellow(this.formatAmount(sample.avgAmount))}`);

    console.log('\n' + chalk.bold('📅 时间分布:'));
    console.log(`  首次出现: ${this.formatDate(sample.firstSeen)}`);
    console.log(`  最近出现: ${this.formatDate(sample.lastSeen)}`);

    console.log('\n' + chalk.bold('📄 代表性记录:'));
    console.log(`  行号: ${sample.representative.lineNumber}`);
    console.log(`  时间: ${this.formatDate(sample.representative.timestamp)}`);
    console.log(`  消息: ${sample.representative.message}`);

    if (sample.uniqueOrderIds.length > 0) {
      console.log('\n' + chalk.bold('🆔 涉及的订单号 (前10个):'));
      sample.uniqueOrderIds.slice(0, 10).forEach((id, i) => {
        console.log(`  ${i + 1}. ${id}`);
      });
      if (sample.uniqueOrderIds.length > 10) {
        console.log(`  ... 还有 ${sample.uniqueOrderIds.length - 10} 个`);
      }
    }

    if (sample.isSuppressed) {
      console.log(`\n${chalk.bold('🚫 抑制状态:')} 已抑制`);
      console.log(`  抑制原因: ${sample.suppressionReason || '未指定'}`);
    }

    if (sample.isNew) {
      console.log(`\n${chalk.bold.yellow('🆕 新错误提醒:')} 此错误码首次出现在日志中`);
    }

    console.log('\n' + chalk.bold.cyan('═══════════════════════════════════════════════════════════\n'));
  }

  public printReport(samples: AggregatedSample[], scanResult: ScanResult): void {
    const activeSamples = samples.filter(s => !s.isSuppressed);
    const suppressedSamples = samples.filter(s => s.isSuppressed);

    console.log('\n' + chalk.bold.magenta('═══════════════════════════════════════════════════════════'));
    console.log(chalk.bold.magenta('                    综合分析报告'));
    console.log(chalk.bold.magenta('═══════════════════════════════════════════════════════════\n'));

    console.log(chalk.bold('📈 总体统计:'));
    console.log(`  日志总数: ${this.formatNumber(scanResult.totalEntries)}`);
    console.log(`  异常类别数: ${this.formatNumber(samples.length)}`);
    console.log(`  活跃异常: ${this.formatNumber(activeSamples.length)}`);
    console.log(`  抑制异常: ${this.formatNumber(suppressedSamples.length)}`);

    const totalErrors = samples.reduce((sum, s) => sum + s.count, 0);
    const totalAmount = samples.reduce((sum, s) => sum + s.totalAmount, 0);
    const newErrors = activeSamples.filter(s => s.isNew).length;

    console.log(`  总异常条数: ${chalk.red.bold(this.formatNumber(totalErrors))}`);
    console.log(`  总影响金额: ${chalk.yellow.bold(this.formatAmount(totalAmount))}`);
    console.log(`  新错误数: ${newErrors > 0 ? chalk.yellow.bold(newErrors) : '0'}`);

    if (activeSamples.length > 0) {
      console.log('\n' + chalk.bold('🎯 建议排查顺序 (按优先级):'));
      const sorted = [...activeSamples].sort((a, b) => b.priority - a.priority);
      sorted.slice(0, 10).forEach((sample, index) => {
        const severityColor = this.getSeverityColor(sample.severity);
        const newMark = sample.isNew ? chalk.yellow(' 🆕') : '';
        console.log(`  ${index + 1}. ${severityColor(`[${sample.severity.toUpperCase()}]`)} ${sample.errorCode} - ${sample.errorDescription}${newMark}`);
        console.log(`     优先级: ${sample.priority} | 数量: ${sample.count} | 金额: ${this.formatAmount(sample.totalAmount)}`);
      });
    }

    if (suppressedSamples.length > 0) {
      const suppressedTotal = suppressedSamples.reduce((sum, s) => sum + s.count, 0);
      console.log(`\n${chalk.bold('📉 抑制统计:')}`);
      console.log(`  抑制异常类别: ${suppressedSamples.length}`);
      console.log(`  抑制异常条数: ${suppressedTotal}`);
      console.log(`  噪声抑制率: ${((suppressedTotal / totalErrors) * 100).toFixed(1)}%`);
    }

    console.log('\n' + chalk.bold.magenta('═══════════════════════════════════════════════════════════\n'));
  }

  private truncateMessage(message: string, maxLength: number): string {
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength - 3) + '...';
  }
}
