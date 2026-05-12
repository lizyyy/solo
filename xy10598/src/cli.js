#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs-extra');
const { table } = require('table');

const db = require('./db');
const importer = require('./importer');
const calculator = require('./calculator');
const checker = require('./checker');
const adjustment = require('./adjustment');
const reporter = require('./reporter');
const sampleGenerator = require('./sample-generator');
const { formatMoney } = require('./utils');

const program = new Command();

function getWorkDir(options) {
  return options.workDir || process.cwd();
}

function logSuccess(msg) {
  console.log(chalk.green(`✓ ${msg}`));
}

function logError(msg) {
  console.log(chalk.red(`✗ ${msg}`));
}

function logInfo(msg) {
  console.log(chalk.blue(`ℹ ${msg}`));
}

function logWarning(msg) {
  console.log(chalk.yellow(`⚠ ${msg}`));
}

program
  .name('commission-review')
  .description('门店导购提成复核 CLI')
  .version('1.0.0')
  .option('-w, --work-dir <path>', '工作目录', process.cwd());

program
  .command('init')
  .description('初始化工作目录和数据库')
  .option('--with-samples', '同时生成样例数据')
  .action((options) => {
    const workDir = getWorkDir(program.opts());
    
    try {
      logInfo(`初始化工作目录: ${workDir}`);
      
      const result = db.initialize(workDir);
      logSuccess(result.message);
      
      if (options.withSamples) {
        logInfo('生成样例数据...');
        const sampleResult = sampleGenerator.generateSampleData(workDir);
        logSuccess(sampleResult.message);
        console.log('  生成的文件:');
        sampleResult.files.forEach(f => console.log(`    - ${f}`));
      }
      
      console.log('');
      logInfo('下一步:');
      if (options.withSamples) {
        console.log('  1. 运行 import 命令导入样例数据');
        console.log('  2. 运行 check 命令检查数据完整性');
        console.log('  3. 运行 report 命令查看提成报告');
      } else {
        console.log('  1. 准备CSV数据文件');
        console.log('  2. 运行 import 命令导入数据');
      }
      
    } catch (err) {
      logError(err.message);
      process.exit(1);
    }
  });

program
  .command('import <type>')
  .description('导入数据 (stores|staff|products|promotions|sales|returns|allocations|transfers)')
  .option('-f, --file <path>', 'CSV文件路径')
  .option('-o, --operator <name>', '操作人', 'system')
  .action((type, options) => {
    const workDir = getWorkDir(program.opts());
    
    try {
      db.connect(workDir);
      
      logInfo(`导入 ${type} 数据...`);
      
      const result = importer.importData(workDir, type, options.file, {
        operator: options.operator
      });
      
      console.log('');
      logSuccess(result.message);
      console.log(`  批次ID: ${result.batchId}`);
      console.log(`  总计: ${result.totalRecords} 条`);
      console.log(`  成功: ${chalk.green(result.successCount)} 条`);
      
      if (result.failCount > 0) {
        console.log(`  失败: ${chalk.red(result.failCount)} 条`);
        console.log('');
        logWarning('失败详情:');
        const failures = importer.getImportFailures(result.batchId);
        failures.slice(0, 5).forEach(f => {
          console.log(`  第${f.record_no}行: ${f.error_message}`);
        });
        if (failures.length > 5) {
          console.log(`  ... 还有 ${failures.length - 5} 条失败记录`);
        }
      }
      
      db.close();
    } catch (err) {
      logError(err.message);
      process.exit(1);
    }
  });

program
  .command('import-all')
  .description('导入所有样例数据')
  .option('-o, --operator <name>', '操作人', 'system')
  .action((options) => {
    const workDir = getWorkDir(program.opts());
    const types = ['stores', 'staff', 'products', 'promotions', 'sales', 'returns', 'allocations', 'transfers'];
    
    try {
      db.connect(workDir);
      
      logInfo('开始导入所有样例数据...');
      console.log('');
      
      let totalSuccess = 0;
      let totalFail = 0;
      
      for (const type of types) {
        logInfo(`导入 ${type}...`);
        try {
          const result = importer.importData(workDir, type, null, {
            operator: options.operator
          });
          logSuccess(`${result.successCount} 条成功`);
          totalSuccess += result.successCount;
          totalFail += result.failCount;
        } catch (err) {
          logError(err.message);
          totalFail++;
        }
        console.log('');
      }
      
      console.log('━'.repeat(50));
      logSuccess('导入完成');
      console.log(`  成功: ${chalk.green(totalSuccess)} 条`);
      if (totalFail > 0) {
        console.log(`  失败: ${chalk.red(totalFail)} 条`);
      }
      
      db.close();
    } catch (err) {
      logError(err.message);
      process.exit(1);
    }
  });

program
  .command('check <period>')
  .description('检查数据完整性和异常 (格式: YYYYMM)')
  .action((period) => {
    const workDir = getWorkDir(program.opts());
    
    try {
      db.connect(workDir);
      
      logInfo(`检查期间: ${period.slice(0, 4)}年${period.slice(4, 6)}月`);
      console.log('');
      
      const result = checker.runChecks(workDir, period);
      
      const { counts, status } = result.summary;
      
      console.log('【检查结果汇总】');
      const statusText = {
        'passed': chalk.green('通过'),
        'needs_review': chalk.yellow('需要复核'),
        'failed': chalk.red('存在错误')
      };
      console.log(`  状态: ${statusText[status]}`);
      console.log(`  错误: ${chalk.red(counts.error)} 条`);
      console.log(`  警告: ${chalk.yellow(counts.warning)} 条`);
      console.log(`  信息: ${chalk.blue(counts.info)} 条`);
      console.log('');
      
      if (result.issues.length > 0) {
        console.log('【问题详情】');
        result.issues.forEach((issue, idx) => {
          const typeIcon = {
            'error': chalk.red('✗'),
            'warning': chalk.yellow('⚠'),
            'info': chalk.blue('ℹ')
          };
          console.log(`${typeIcon[issue.type]} [${idx + 1}] ${issue.description}`);
          console.log(`    ${issue.details}`);
        });
        console.log('');
      }
      
      const pending = checker.getPendingReviewOrders(period);
      if (pending.totalPending > 0) {
        console.log('【待复核事项】');
        console.log(`  总计: ${pending.totalPending} 项`);
        if (pending.ordersWithoutAllocation.length > 0) {
          console.log(`  - 无分摊订单: ${pending.ordersWithoutAllocation.length} 个`);
        }
        if (pending.crossMonthReturns.length > 0) {
          console.log(`  - 跨月退货: ${pending.crossMonthReturns.length} 笔`);
        }
        console.log('');
      }
      
      db.close();
    } catch (err) {
      logError(err.message);
      process.exit(1);
    }
  });

program
  .command('calculate <period>')
  .description('计算提成 (格式: YYYYMM)')
  .option('-f, --force', '强制重新计算')
  .option('-o, --operator <name>', '操作人', 'system')
  .action((period, options) => {
    const workDir = getWorkDir(program.opts());
    
    try {
      db.connect(workDir);
      
      logInfo(`计算期间: ${period.slice(0, 4)}年${period.slice(4, 6)}月`);
      if (options.force) {
        logWarning('强制重新计算模式');
      }
      console.log('');
      
      const result = calculator.calculateCommission(workDir, period, {
        force: options.force,
        operator: options.operator
      });
      
      if (result.status === 'already_calculated') {
        logWarning(result.message);
      } else {
        logSuccess(result.message);
        console.log(`  计算ID: ${result.calculationId}`);
        console.log('');
        console.log('【计算结果】');
        console.log(`  销售提成: ¥${formatMoney(result.summary.salesCommission)}`);
        console.log(`  退货扣减: ¥${formatMoney(result.summary.returnDeduction)}`);
        console.log(`  净额提成: ¥${chalk.green(formatMoney(result.summary.netCommission))}`);
        console.log(`  涉及导购: ${result.summary.staffCount} 人`);
      }
      
      db.close();
    } catch (err) {
      logError(err.message);
      process.exit(1);
    }
  });

program
  .command('detail <staffCode> <period>')
  .description('查看导购提成明细')
  .action((staffCode, period) => {
    const workDir = getWorkDir(program.opts());
    
    try {
      db.connect(workDir);
      
      logInfo(`查询导购 ${staffCode} ${period.slice(0, 4)}年${period.slice(4, 6)}月明细`);
      console.log('');
      
      const result = calculator.getStaffCommission(staffCode, period);
      
      if (result.details.length === 0) {
        logWarning('该导购本期无提成记录');
        db.close();
        return;
      }
      
      console.log('【汇总】');
      console.log(`  销售提成: ¥${formatMoney(result.summary.salesCommission)}`);
      console.log(`  退货扣减: ¥${formatMoney(result.summary.returnDeduction)}`);
      console.log(`  净额: ¥${chalk.green(formatMoney(result.summary.netCommission))}`);
      console.log('');
      
      console.log('【明细记录】');
      const tableData = [
        ['类型', '单据号', '金额', '提成', '规则说明', '扣减原因']
      ];
      
      result.details.forEach(d => {
        const typeColor = d.commission_type === 'sale' ? chalk.green : chalk.red;
        tableData.push([
          typeColor(d.commission_type === 'sale' ? '销售' : '退货'),
          d.order_no || d.return_no || '-',
          `¥${formatMoney(d.base_amount)}`,
          d.commission_amount >= 0 
            ? chalk.green(`¥${formatMoney(d.commission_amount)}`) 
            : chalk.red(`¥${formatMoney(d.commission_amount)}`),
          d.calculation_rule || '-',
          d.deduction_reason || '-'
        ]);
      });
      
      console.log(table(tableData, {
        border: getBorderStyle()
      }));
      
      db.close();
    } catch (err) {
      logError(err.message);
      process.exit(1);
    }
  });

program
  .command('adjust')
  .description('人工调整导购提成')
  .requiredOption('-s, --staff <code>', '导购编码')
  .requiredOption('-p, --period <period>', '期间 (YYYYMM)')
  .requiredOption('-a, --amount <number>', '调整后金额')
  .requiredOption('-r, --reason <text>', '调整原因')
  .requiredOption('-o, --operator <name>', '操作人')
  .action((options) => {
    const workDir = getWorkDir(program.opts());
    
    try {
      db.connect(workDir);
      
      const adjustedAmount = parseFloat(options.amount);
      if (isNaN(adjustedAmount)) {
        throw new Error('金额格式错误');
      }
      
      logInfo(`调整导购 ${options.staff} ${options.period} 提成`);
      console.log('');
      
      const result = adjustment.createAdjustment(
        options.staff,
        options.period,
        adjustedAmount,
        options.reason,
        options.operator
      );
      
      console.log('【调整详情】');
      console.log(`  导购: ${result.staffName} (${result.staffCode})`);
      console.log(`  原金额: ¥${formatMoney(result.originalAmount)}`);
      console.log(`  调整后: ¥${formatMoney(result.adjustedAmount)}`);
      const diffColor = result.difference > 0 ? chalk.green : chalk.red;
      console.log(`  差额: ${diffColor(result.difference > 0 ? `+¥${formatMoney(result.difference)}` : `-¥${formatMoney(Math.abs(result.difference))}`)}`);
      console.log(`  原因: ${result.reason}`);
      console.log(`  操作人: ${result.operator}`);
      console.log('');
      logSuccess(result.message);
      
      db.close();
    } catch (err) {
      logError(err.message);
      process.exit(1);
    }
  });

program
  .command('history')
  .description('查看操作历史')
  .option('-t, --type <type>', '历史类型: import|adjustment|audit')
  .option('-l, --limit <n>', '显示条数', '20')
  .action((options) => {
    const workDir = getWorkDir(program.opts());
    
    try {
      db.connect(workDir);
      
      const limit = parseInt(options.limit) || 20;
      
      if (options.type === 'import' || !options.type) {
        logInfo('导入历史');
        const history = importer.getImportHistory(workDir, limit);
        
        if (history.length === 0) {
          logWarning('暂无导入记录');
        } else {
          const tableData = [
            ['批次ID', '类型', '文件', '总数', '成功', '失败', '状态', '操作人', '时间']
          ];
          
          history.forEach(h => {
            tableData.push([
              h.batch_id.slice(-12),
              h.import_type,
              h.file_name || '-',
              h.record_count,
              chalk.green(h.success_count),
              h.failed_count > 0 ? chalk.red(h.failed_count) : '0',
              h.status === 'success' ? chalk.green('成功') : chalk.yellow(h.status),
              h.operator,
              h.created_at
            ]);
          });
          
          console.log(table(tableData, { border: getBorderStyle() }));
        }
        console.log('');
      }
      
      if (options.type === 'adjustment' || !options.type) {
        logInfo('调整历史');
        const history = adjustment.getAdjustmentHistory(null, null);
        
        if (history.length === 0) {
          logWarning('暂无调整记录');
        } else {
          history.slice(0, limit).forEach(h => {
            const diffColor = h.difference > 0 ? chalk.green : chalk.red;
            console.log(`  [${h.adjustment_no}] ${h.staff_name} (${h.period}): ` +
              diffColor(h.difference > 0 ? `+¥${formatMoney(h.difference)}` : `-¥${formatMoney(Math.abs(h.difference))}`) +
              ` | ${h.reason} | ${h.operator}`);
          });
        }
        console.log('');
      }
      
      if (options.type === 'audit') {
        logInfo('审计日志');
        const logs = adjustment.getAuditLogs(limit);
        
        if (logs.length === 0) {
          logWarning('暂无审计记录');
        } else {
          logs.forEach(log => {
            console.log(`  [${log.created_at}] ${log.action} by ${log.operator || 'system'}`);
            console.log(`    表: ${log.table_name || '-'} | 记录: ${log.record_id || '-'}`);
          });
        }
      }
      
      db.close();
    } catch (err) {
      logError(err.message);
      process.exit(1);
    }
  });

program
  .command('report <period>')
  .description('生成提成复核报告')
  .option('--console', '同时输出到控制台')
  .action((period, options) => {
    const workDir = getWorkDir(program.opts());
    
    try {
      db.connect(workDir);
      
      logInfo(`生成报告: ${period.slice(0, 4)}年${period.slice(4, 6)}月`);
      console.log('');
      
      const checkResult = checker.runChecks(workDir, period);
      const calcSummary = calculator.getCalculationSummary(period);
      const staffSummary = calculator.getAllStaffSummary(period);
      const pendingReview = checker.getPendingReviewOrders(period);
      const adjustments = adjustment.getAdjustmentHistory(null, period);
      
      const reportData = {
        checkResult,
        calculationSummary: calcSummary,
        staffSummary,
        pendingReview,
        adjustments
      };
      
      const report = reporter.generateReport(workDir, period, reportData, {
        console: options.console
      });
      
      logSuccess(`报告已保存: ${report.path}`);
      
      db.close();
    } catch (err) {
      logError(err.message);
      process.exit(1);
    }
  });

program
  .command('demo')
  .description('运行完整演示流程')
  .option('--period <period>', '演示期间', '202603')
  .action((options) => {
    const workDir = getWorkDir(program.opts());
    const period = options.period;
    
    console.log(chalk.cyan('═'.repeat(60)));
    console.log(chalk.cyan.bold('  门店导购提成复核 CLI - 完整演示'));
    console.log(chalk.cyan('═'.repeat(60)));
    console.log('');
    
    const steps = [
      { name: '1. 初始化', cmd: 'init', args: ['--with-samples'] },
      { name: '2. 导入所有数据', cmd: 'import-all', args: [] },
      { name: '3. 数据检查', cmd: 'check', args: [period] },
      { name: '4. 计算提成', cmd: 'calculate', args: [period] },
      { name: '5. 查看导购明细', cmd: 'detail', args: ['S002', period] },
      { name: '6. 生成报告', cmd: 'report', args: [period, '--console'] }
    ];
    
    steps.forEach((step, idx) => {
      console.log(chalk.yellow(`\n【步骤 ${step.name}】`));
      console.log(chalk.gray(`命令: commission-review ${step.cmd} ${step.args.join(' ')}`));
      console.log('');
    });
    
    console.log('');
    logInfo('运行以下命令开始演示:');
    console.log(chalk.green('  npm run demo'));
  });

function getBorderStyle() {
  return {
    topBody: '─',
    topJoin: '┬',
    topLeft: '┌',
    topRight: '┐',
    bottomBody: '─',
    bottomJoin: '┴',
    bottomLeft: '└',
    bottomRight: '┘',
    bodyLeft: '│',
    bodyRight: '│',
    bodyJoin: '│',
    joinBody: '─',
    joinLeft: '├',
    joinRight: '┤',
    joinJoin: '┼'
  };
}

program.parseAsync(process.argv).catch(err => {
  logError(err.message);
  process.exit(1);
});
