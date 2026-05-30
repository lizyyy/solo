import { Command } from 'commander';
import chalk from 'chalk';
import { runCalculation } from '../engine/interest';
import { formatCategoryLabel, formatSeverityIcon } from '../anomaly/classifier';

export function registerCalculateCommand(program: Command): void {
  program
    .command('calculate')
    .description('执行贴现利息复算')
    .action(() => {
      console.log(chalk.bold('\n开始贴现利息复算...\n'));

      const results = runCalculation();

      if (results.length === 0) {
        console.log(chalk.yellow('无可计算的贴现申请，请先导入票据和申请数据'));
        return;
      }

      console.log(chalk.bold(`复算完成，共 ${results.length} 条结果:\n`));

      for (const r of results) {
        const hasError = r.anomalies.some((a) => a.severity === 'error');
        const hasWarning = r.anomalies.some((a) => a.severity === 'warning');
        const statusIcon = hasError ? chalk.red('✖') : hasWarning ? chalk.yellow('⚠') : chalk.green('✔');

        console.log(`${statusIcon} 票据号: ${r.billNo}  申请号: ${r.appId}`);
        console.log(`    金额: ${r.amount.toLocaleString()}  贴现日: ${r.discountDate}  到期日: ${r.maturityDate}`);
        console.log(`    计息天数: ${r.interestDays}  申请利率: ${r.appliedRate}%  匹配利率: ${r.matchedRate}%`);
        console.log(`    贴现利息: ${r.discountInterest.toLocaleString()}  净额: ${r.netAmount.toLocaleString()}`);

        if (r.rateDiff !== 0) {
          const diffColor = r.rateDiff > 0 ? chalk.red : chalk.green;
          console.log(`    利率差: ${diffColor(r.rateDiff.toFixed(4) + '%')}  利息差: ${diffColor(r.interestDiff.toLocaleString())}`);
        }

        if (r.anomalies.length > 0) {
          console.log(`    异常 (${r.anomalies.length}):`);
          for (const a of r.anomalies) {
            const icon = formatSeverityIcon(a.severity);
            const catLabel = formatCategoryLabel(a.category);
            const color = a.severity === 'error' ? chalk.red : a.severity === 'warning' ? chalk.yellow : chalk.blue;
            console.log(color(`      ${icon} [${catLabel}] ${a.code}: ${a.message}`));
          }
        }
        console.log('');
      }

      const totalAnomalies = results.reduce((s, r) => s + r.anomalies.length, 0);
      const errors = results.reduce((s, r) => s + r.anomalies.filter((a) => a.severity === 'error').length, 0);
      const warnings = results.reduce((s, r) => s + r.anomalies.filter((a) => a.severity === 'warning').length, 0);

      console.log(chalk.bold('汇总:'));
      console.log(`  复算条目: ${results.length}`);
      console.log(`  异常总计: ${totalAnomalies} (错误: ${chalk.red(errors)}, 警告: ${chalk.yellow(warnings)})`);
    });
}
