import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { initDatabase, closeDb, getDataDir, getDbPath } from './database';
import { importData, ImportStats } from './importer';
import { 
  runCheck, 
  getCheckSummary, 
  getCheckResultById, 
  getCheckIssues,
  getStatusHistory,
  getAllCheckResults,
  CheckOptions
} from './checker';
import { 
  manualCorrect, 
  approveResult, 
  rejectResult,
  getManualCorrections 
} from './correction';
import { createSampleData } from './sample-data';
import { ImportData, CheckResult, CheckStatus } from './types';
import fs from 'fs';
import path from 'path';

const program = new Command();

function formatStatus(status: CheckStatus): string {
  switch (status) {
    case 'PASS':
      return chalk.green('✓ PASS');
    case 'MUST_REPRINT':
      return chalk.red('✗ MUST_REPRINT');
    case 'CAN_CONTINUE':
      return chalk.yellow('⚠ CAN_CONTINUE');
    case 'NEEDS_MANUAL_CHECK':
      return chalk.magenta('? NEEDS_MANUAL_CHECK');
    case 'MANUALLY_APPROVED':
      return chalk.blue('✓ MANUALLY_APPROVED');
    case 'MANUALLY_REJECTED':
      return chalk.red('✗ MANUALLY_REJECTED');
    default:
      return status;
  }
}

function formatSeverity(severity: string): string {
  switch (severity) {
    case 'CRITICAL':
      return chalk.red('CRITICAL');
    case 'WARNING':
      return chalk.yellow('WARNING');
    case 'INFO':
      return chalk.blue('INFO');
    default:
      return severity;
  }
}

function printImportStats(stats: ImportStats) {
  const table = new Table({
    head: ['类型', '新增', '更新', '跳过(幂等)'],
    colWidths: [20, 10, 10, 15]
  });
  
  table.push(['门店', stats.stores.inserted, stats.stores.updated, stats.stores.skipped]);
  table.push(['商品', stats.products.inserted, stats.products.updated, stats.products.skipped]);
  table.push(['门店价', stats.storePrices.inserted, stats.storePrices.updated, stats.storePrices.skipped]);
  table.push(['促销活动', stats.promotions.inserted, stats.promotions.updated, stats.promotions.skipped]);
  table.push(['打印记录', stats.tagPrintRecords.inserted, stats.tagPrintRecords.updated, stats.tagPrintRecords.skipped]);
  table.push(['扫描记录', stats.tagScans.inserted, stats.tagScans.updated, stats.tagScans.skipped]);
  
  console.log(table.toString());
}

program
  .name('price-tag-checker')
  .description('促销价签校对 CLI 工具')
  .version('1.0.0');

program
  .command('init')
  .description('初始化数据库和工作目录')
  .action(() => {
    try {
      console.log(chalk.blue('正在初始化...'));
      initDatabase();
      console.log(chalk.green('✓ 初始化成功！'));
      console.log(chalk.gray(`  数据目录: ${getDataDir()}`));
      console.log(chalk.gray(`  数据库: ${getDbPath()}`));
      process.exit(0);
    } catch (err: any) {
      console.error(chalk.red(`✗ 初始化失败: ${err.message}`));
      process.exit(1);
    } finally {
      closeDb();
    }
  });

program
  .command('seed')
  .description('导入内置样例数据（生鲜、日化、家电）')
  .action(() => {
    try {
      const sampleData = createSampleData();
      const stats = importData(sampleData);
      
      console.log(chalk.green('✓ 样例数据导入成功！'));
      console.log(chalk.gray('  包含数据：生鲜(FRESH)、日化(DAILY)、家电(ELEC)'));
      console.log('');
      printImportStats(stats);
      process.exit(0);
    } catch (err: any) {
      console.error(chalk.red(`✗ 导入失败: ${err.message}`));
      process.exit(1);
    } finally {
      closeDb();
    }
  });

program
  .command('import')
  .description('从 JSON 文件导入数据')
  .argument('<file>', 'JSON 数据文件路径')
  .action((filePath) => {
    try {
      const absPath = path.resolve(filePath);
      if (!fs.existsSync(absPath)) {
        console.error(chalk.red(`✗ 文件不存在: ${absPath}`));
        process.exit(1);
      }
      
      const rawData = fs.readFileSync(absPath, 'utf-8');
      const data: ImportData = JSON.parse(rawData);
      
      console.log(chalk.blue(`正在导入: ${absPath}`));
      const stats = importData(data);
      
      console.log(chalk.green('✓ 导入成功！'));
      console.log('');
      printImportStats(stats);
      process.exit(0);
    } catch (err: any) {
      console.error(chalk.red(`✗ 导入失败: ${err.message}`));
      process.exit(1);
    } finally {
      closeDb();
    }
  });

program
  .command('check')
  .description('执行价签校对')
  .option('-s, --store <storeId>', '门店ID过滤')
  .option('-k, --sku <sku>', 'SKU过滤')
  .option('-t, --time <time>', '校对时间 (格式: YYYY-MM-DD HH:MM:SS)')
  .action((options) => {
    try {
      const checkOptions: CheckOptions = {
        storeId: options.store,
        sku: options.sku,
        checkTime: options.time
      };
      
      console.log(chalk.blue('正在执行价签校对...'));
      const { results, summary, checkTime } = runCheck(checkOptions);
      
      console.log(chalk.green(`✓ 校对完成！ 时间: ${checkTime}`));
      console.log('');
      
      const table = new Table({
        head: ['状态', '数量', '说明'],
        colWidths: [25, 10, 40]
      });
      
      table.push(
        [formatStatus('PASS' as CheckStatus), summary.pass, '完全通过，价签正常'],
        [formatStatus('MUST_REPRINT' as CheckStatus), summary.mustReprint, '必须重打，价格/版本严重不一致'],
        [formatStatus('CAN_CONTINUE' as CheckStatus), summary.canContinue, '可继续使用，轻微差异'],
        [formatStatus('NEEDS_MANUAL_CHECK' as CheckStatus), summary.needsManualCheck, '需人工确认'],
        [formatStatus('MANUALLY_APPROVED' as CheckStatus), summary.manuallyApproved, '人工通过'],
        [formatStatus('MANUALLY_REJECTED' as CheckStatus), summary.manuallyRejected, '人工拒绝']
      );
      
      console.log(table.toString());
      console.log('');
      console.log(chalk.blue(`总计: ${summary.total} 条`));
      
      if (summary.mustReprint > 0) {
        console.log(chalk.yellow(`\n⚠ 有 ${summary.mustReprint} 张价签必须重打，请使用 detail 命令查看详情`));
      }
      
      if (summary.needsManualCheck > 0) {
        console.log(chalk.magenta(`\n? 有 ${summary.needsManualCheck} 张价签需要人工确认，请使用 correct 命令处理`));
      }
      
      process.exit(0);
    } catch (err: any) {
      console.error(chalk.red(`✗ 校对失败: ${err.message}`));
      process.exit(1);
    } finally {
      closeDb();
    }
  });

program
  .command('list')
  .description('列出所有校对结果')
  .option('-s, --store <storeId>', '门店ID过滤')
  .option('-k, --sku <sku>', 'SKU过滤')
  .option('--status <status>', '状态过滤 (PASS|MUST_REPRINT|CAN_CONTINUE|NEEDS_MANUAL_CHECK)')
  .action((options) => {
    try {
      const checkOptions: CheckOptions = {
        storeId: options.store,
        sku: options.sku
      };
      
      let results = getAllCheckResults(checkOptions);
      
      if (options.status) {
        results = results.filter(r => r.status === options.status);
      }
      
      const table = new Table({
        head: ['结果ID', '门店', 'SKU', '状态', '系统价', '扫描价', '校对时间'],
        colWidths: [38, 15, 15, 22, 12, 12, 22]
      });
      
      for (const r of results) {
        table.push([
          r.id,
          r.store_id,
          r.sku,
          formatStatus(r.status),
          `¥${r.system_price.toFixed(2)}`,
          `¥${r.scanned_price.toFixed(2)}`,
          r.check_time
        ]);
      }
      
      console.log(table.toString());
      console.log(chalk.blue(`\n共 ${results.length} 条记录`));
      
      process.exit(0);
    } catch (err: any) {
      console.error(chalk.red(`✗ 查询失败: ${err.message}`));
      process.exit(1);
    } finally {
      closeDb();
    }
  });

program
  .command('detail')
  .description('查看单个校对结果的详细信息')
  .argument('<resultId>', '校对结果ID')
  .action((resultId) => {
    try {
      const result = getCheckResultById(resultId);
      
      if (!result) {
        console.error(chalk.red(`✗ 结果不存在: ${resultId}`));
        process.exit(1);
      }
      
      const issues = getCheckIssues(resultId);
      const history = getStatusHistory(resultId);
      const corrections = getManualCorrections(resultId);
      
      console.log(chalk.blue('══════════════════════════════════════════════════'));
      console.log(chalk.blue('  价签校对详情'));
      console.log(chalk.blue('══════════════════════════════════════════════════'));
      console.log('');
      
      console.log(chalk.bold('基本信息'));
      const infoTable = new Table({
        colWidths: [20, 60],
        style: { 'padding-left': 2, 'padding-right': 2 }
      });
      
      infoTable.push(
        ['结果ID', result.id],
        ['门店', result.store_id],
        ['SKU', result.sku],
        ['状态', formatStatus(result.status)],
        ['校对时间', result.check_time]
      );
      console.log(infoTable.toString());
      
      console.log('');
      console.log(chalk.bold('价格对比'));
      const priceTable = new Table({
        head: ['价格类型', '金额', '说明'],
        colWidths: [15, 15, 45]
      });
      
      const systemPrice = result.system_price ?? 0;
      const scannedPrice = result.scanned_price ?? 0;
      priceTable.push(
        ['系统价', `¥${systemPrice.toFixed(2)}`, '当前生效的系统价格（含促销）'],
        ['门店价', result.store_price !== undefined && result.store_price !== null ? `¥${result.store_price.toFixed(2)}` : '-', '门店特价覆盖（如有）'],
        ['扫描价', `¥${scannedPrice.toFixed(2)}`, '扫码枪读取的纸质价签价格']
      );
      console.log(priceTable.toString());
      
      if (issues.length > 0) {
        console.log('');
        console.log(chalk.bold('问题列表'));
        const issueTable = new Table({
          head: ['类型', '代码', '严重程度', '说明'],
          colWidths: [12, 25, 12, 50]
        });
        
        for (const issue of issues) {
          issueTable.push([
            issue.issue_type,
            issue.issue_code,
            formatSeverity(issue.severity),
            issue.issue_message
          ]);
        }
        console.log(issueTable.toString());
      }
      
      if (history.length > 0) {
        console.log('');
        console.log(chalk.bold('状态历史'));
        const historyTable = new Table({
          head: ['时间', '从', '到', '原因', '操作者'],
          colWidths: [22, 20, 20, 25, 15]
        });
        
        for (const h of history) {
          historyTable.push([
            h.created_at || '-',
            h.from_status ? formatStatus(h.from_status as CheckStatus) : '-',
            formatStatus(h.to_status as CheckStatus),
            h.reason || '-',
            h.operator || '-'
          ]);
        }
        console.log(historyTable.toString());
      }
      
      if (corrections.length > 0) {
        console.log('');
        console.log(chalk.bold('人工修正记录'));
        for (const c of corrections) {
          const diff = JSON.parse(c.diff_json);
          console.log(`  ${c.created_at} - ${c.corrected_by}`);
          console.log(`    状态: ${formatStatus(c.old_status as CheckStatus)} → ${formatStatus(c.new_status as CheckStatus)}`);
          console.log(`    差异: ${JSON.stringify(diff)}`);
          if (c.comment) {
            console.log(`    备注: ${c.comment}`);
          }
        }
      }
      
      console.log('');
      console.log(chalk.blue('══════════════════════════════════════════════════'));
      
      process.exit(0);
    } catch (err: any) {
      console.error(chalk.red(`✗ 查询失败: ${err.message}`));
      process.exit(1);
    } finally {
      closeDb();
    }
  });

program
  .command('report')
  .description('生成门店汇总报告')
  .option('-s, --store <storeId>', '指定门店')
  .option('--json', '输出 JSON 格式')
  .action((options) => {
    try {
      const checkOptions: CheckOptions = {
        storeId: options.store
      };
      
      const summary = getCheckSummary(checkOptions);
      const results = getAllCheckResults(checkOptions);
      
      if (options.json) {
        const report = {
          generatedAt: new Date().toISOString(),
          summary,
          results: results.map(r => ({
            id: r.id,
            storeId: r.store_id,
            sku: r.sku,
            status: r.status,
            systemPrice: r.system_price,
            scannedPrice: r.scanned_price,
            checkTime: r.check_time
          }))
        };
        console.log(JSON.stringify(report, null, 2));
        process.exit(0);
      }
      
      console.log(chalk.blue('══════════════════════════════════════════════════════'));
      console.log(chalk.blue('  促销价签校对汇总报告'));
      console.log(chalk.blue('══════════════════════════════════════════════════════'));
      console.log('');
      console.log(chalk.gray(`生成时间: ${new Date().toISOString()}`));
      console.log('');
      
      const summaryTable = new Table({
        head: ['状态分类', '数量', '占比', '业务建议'],
        colWidths: [22, 10, 10, 40]
      });
      
      const total = summary.total || 1;
      
      summaryTable.push(
        [
          formatStatus('PASS' as CheckStatus),
          summary.pass,
          `${((summary.pass / total) * 100).toFixed(1)}%`,
          '正常上架，无需处理'
        ],
        [
          formatStatus('MUST_REPRINT' as CheckStatus),
          chalk.red(summary.mustReprint),
          `${((summary.mustReprint / total) * 100).toFixed(1)}%`,
          '立即重打价签，避免价格欺诈'
        ],
        [
          formatStatus('CAN_CONTINUE' as CheckStatus),
          summary.canContinue,
          `${((summary.canContinue / total) * 100).toFixed(1)}%`,
          '可暂时继续使用，建议下次打印更新'
        ],
        [
          formatStatus('NEEDS_MANUAL_CHECK' as CheckStatus),
          summary.needsManualCheck,
          `${((summary.needsManualCheck / total) * 100).toFixed(1)}%`,
          '等待人工审核确认'
        ],
        [
          formatStatus('MANUALLY_APPROVED' as CheckStatus),
          summary.manuallyApproved,
          `${((summary.manuallyApproved / total) * 100).toFixed(1)}%`,
          '已人工放行'
        ],
        [
          formatStatus('MANUALLY_REJECTED' as CheckStatus),
          summary.manuallyRejected,
          `${((summary.manuallyRejected / total) * 100).toFixed(1)}%`,
          '已人工拒绝'
        ]
      );
      
      console.log(summaryTable.toString());
      
      console.log('');
      console.log(chalk.bold('业务闭环判断'));
      
      const canGoLive = summary.mustReprint === 0 && summary.needsManualCheck === 0;
      
      if (canGoLive) {
        console.log(chalk.green('  ✓ 所有价签已校对完成，可以上架促销！'));
      } else {
        console.log(chalk.red('  ✗ 存在待处理问题，暂不建议上架'));
        
        if (summary.mustReprint > 0) {
          console.log(chalk.red(`    - ${summary.mustReprint} 张价签必须重打`));
        }
        if (summary.needsManualCheck > 0) {
          console.log(chalk.yellow(`    - ${summary.needsManualCheck} 张价签等待人工确认`));
        }
      }
      
      console.log('');
      console.log(chalk.blue('══════════════════════════════════════════════════════'));
      
      process.exit(0);
    } catch (err: any) {
      console.error(chalk.red(`✗ 生成报告失败: ${err.message}`));
      process.exit(1);
    } finally {
      closeDb();
    }
  });

program
  .command('correct')
  .description('人工修正校对结果状态')
  .argument('<resultId>', '校对结果ID')
  .argument('<newStatus>', '新状态 (MANUALLY_APPROVED|MANUALLY_REJECTED)')
  .option('-o, --operator <name>', '操作者名称', 'Unknown')
  .option('-c, --comment <text>', '备注说明')
  .action((resultId, newStatus, options) => {
    try {
      const validStatuses: CheckStatus[] = ['MANUALLY_APPROVED', 'MANUALLY_REJECTED'];
      
      if (!validStatuses.includes(newStatus as CheckStatus)) {
        console.error(chalk.red(`✗ 无效状态: ${newStatus}，请使用: MANUALLY_APPROVED 或 MANUALLY_REJECTED`));
        process.exit(1);
      }
      
      let result;
      
      if (newStatus === 'MANUALLY_APPROVED') {
        result = approveResult(resultId, options.operator, options.comment);
      } else {
        result = rejectResult(resultId, options.operator, options.comment);
      }
      
      if (!result.success) {
        console.error(chalk.red(`✗ ${result.message}`));
        process.exit(1);
      }
      
      console.log(chalk.green(`✓ ${result.message}`));
      console.log(chalk.gray(`  操作者: ${options.operator}`));
      if (options.comment) {
        console.log(chalk.gray(`  备注: ${options.comment}`));
      }
      
      process.exit(0);
    } catch (err: any) {
      console.error(chalk.red(`✗ 修正失败: ${err.message}`));
      process.exit(1);
    } finally {
      closeDb();
    }
  });

export function runCLI(argv: string[] = process.argv) {
  program.parse(argv);
}
