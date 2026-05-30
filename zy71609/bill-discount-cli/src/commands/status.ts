import { Command } from 'commander';
import chalk from 'chalk';
import { loadStore } from '../store/store';
import { getAnomalyStats, formatCategoryLabel, formatSeverityIcon } from '../anomaly/classifier';
import { DataType } from '../types';

const DATA_TYPE_LABELS: Record<DataType, string> = {
  bills: '票据清单',
  quotes: '银行报价',
  applications: '贴现申请',
  calendar: '到期日历',
  payments: '付款流水',
};

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('查看当前数据状态和异常概况')
    .option('-d, --detail', '显示异常详情', false)
    .action((opts) => {
      const store = loadStore();

      console.log(chalk.bold('\n=== 数据状态 ===\n'));

      console.log(`票据清单:   ${store.bills.length} 条`);
      console.log(`银行报价:   ${store.quotes.length} 条`);
      console.log(`贴现申请:   ${store.applications.length} 条`);
      console.log(`到期日历:   ${store.calendar.length} 条`);
      console.log(`付款流水:   ${store.payments.length} 条`);
      console.log(`复算结果:   ${store.calculations.length} 条`);
      console.log(`导入记录:   ${store.importHistory.length} 次`);

      if (store.bills.length > 0) {
        const byStatus: Record<string, number> = {};
        for (const b of store.bills) {
          byStatus[b.status] = (byStatus[b.status] || 0) + 1;
        }
        console.log(`\n票据状态:   ${Object.entries(byStatus).map(([k, v]) => `${k}=${v}`).join(', ')}`);
      }

      if (store.quotes.length > 0) {
        const byBank: Record<string, number> = {};
        for (const q of store.quotes) {
          byBank[q.bankName] = (byBank[q.bankName] || 0) + 1;
        }
        console.log(`报价银行:   ${Object.entries(byBank).map(([k, v]) => `${k}=${v}`).join(', ')}`);
      }

      const anomalyStats = getAnomalyStats(store.anomalies);
      console.log(chalk.bold('\n=== 异常概况 ===\n'));
      console.log(`总计: ${anomalyStats.total} 条 (已解决: ${anomalyStats.resolved})`);
      console.log(`数据问题: ${anomalyStats.byCategory.data}  规则问题: ${anomalyStats.byCategory.rule}  材料缺失: ${anomalyStats.byCategory.material}`);
      console.log(`错误: ${chalk.red(anomalyStats.bySeverity.error)}  警告: ${chalk.yellow(anomalyStats.bySeverity.warning)}  信息: ${chalk.blue(anomalyStats.bySeverity.info)}`);

      if (opts.detail && store.anomalies.length > 0) {
        console.log(chalk.bold('\n=== 异常详情 ===\n'));
        for (const a of store.anomalies) {
          const icon = formatSeverityIcon(a.severity);
          const catLabel = formatCategoryLabel(a.category);
          const resolved = a.resolved ? chalk.green('[已解决]') : chalk.red('[未解决]');
          const color = a.severity === 'error' ? chalk.red : a.severity === 'warning' ? chalk.yellow : chalk.blue;

          console.log(color(`${icon} ${resolved} [${catLabel}] ${a.code}`));
          console.log(`  票据: ${a.billNo}  |  ${a.message}`);
          if (a.detail) {
            console.log(`  详情: ${a.detail}`);
          }
          if (a.resolved && a.resolution) {
            console.log(`  处理: ${a.resolution}`);
          }
          console.log('');
        }
      }

      if (store.importHistory.length > 0) {
        console.log(chalk.bold('=== 最近导入 ===\n'));
        const recent = store.importHistory.slice(-5).reverse();
        for (const h of recent) {
          const label = DATA_TYPE_LABELS[h.dataType as DataType] || h.dataType;
          console.log(`[${h.timestamp.slice(0, 19)}] ${label}: 总${h.total} 增${h.inserted} 跳${h.skipped} 改${h.updated} 冲${h.conflicts.length}`);
        }
      }
    });
}
