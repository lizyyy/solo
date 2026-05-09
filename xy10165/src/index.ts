#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { 
  initializeDatabase, 
  databaseExists, 
  closeDatabase 
} from './database';
import {
  getExceptions,
  getBudgetHistory,
  getImportLogs,
  resolveException
} from './models';
import {
  checkAllBudgets,
  checkBudgetStatus
} from './budgetService';
import { 
  importFromExcel, 
  saveTemplate, 
  ImportType 
} from './excelService';
import { generateExcelReport, generateReportData } from './reportService';
import path from 'path';
import fs from 'fs';

const program = new Command();

program
  .name('budget')
  .description('预算单据超支核验 CLI - 管理部门预算、采购申请和合同付款')
  .version('1.0.0');

program
  .command('init')
  .description('初始化数据库')
  .option('-f, --force', '强制重新初始化，删除现有数据')
  .action((options) => {
    try {
      if (!options.force && databaseExists()) {
        console.log(chalk.yellow('数据库已存在。如需重新初始化，请使用 --force 选项。'));
        console.log(chalk.yellow('警告: 使用 --force 将删除所有现有数据！'));
        process.exit(1);
      }

      if (options.force && databaseExists()) {
        console.log(chalk.yellow('正在删除现有数据库...'));
      }

      initializeDatabase(undefined, options.force);
      console.log(chalk.green('✓ 数据库初始化成功！'));
      console.log(chalk.cyan('\n下一步操作：'));
      console.log(chalk.cyan('  1. 生成模板: budget template --type budget'));
      console.log(chalk.cyan('  2. 导入数据: budget import <文件> --type budget'));
    } catch (error) {
      console.error(chalk.red('初始化失败:'), error instanceof Error ? error.message : error);
      process.exit(1);
    } finally {
      closeDatabase();
    }
  });

program
  .command('template')
  .description('生成 Excel 导入模板')
  .requiredOption('-t, --type <type>', '模板类型: budget | purchase | payment')
  .option('-o, --output <path>', '输出文件路径')
  .action((options) => {
    try {
      const type = options.type as ImportType;
      const validTypes: ImportType[] = ['budget', 'purchase', 'payment'];
      
      if (!validTypes.includes(type)) {
        console.error(chalk.red(`无效的模板类型: ${type}`));
        console.error(chalk.yellow('有效值: budget, purchase, payment'));
        process.exit(1);
      }

      const typeNames: Record<ImportType, string> = {
        'budget': '预算',
        'purchase': '采购申请',
        'payment': '合同付款'
      };

      const outputPath = options.output || `./${type}_template.xlsx`;
      const absolutePath = path.resolve(outputPath);

      saveTemplate(type, absolutePath);
      console.log(chalk.green(`✓ ${typeNames[type]}模板已生成: ${absolutePath}`));
      
      const descriptions: Record<ImportType, string> = {
        'budget': '包含部门、期间、预算类型、预算金额、阈值、描述',
        'purchase': '包含申请单号、部门、物品名称、申请金额、申请日期等',
        'payment': '包含付款单号、合同号、部门、申请单号、付款金额等'
      };

      console.log(chalk.cyan(`\n模板说明: ${descriptions[type]}`));
    } catch (error) {
      console.error(chalk.red('模板生成失败:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('import')
  .description('从 Excel 导入数据')
  .argument('<file>', 'Excel 文件路径')
  .requiredOption('-t, --type <type>', '导入类型: budget | purchase | payment')
  .option('-s, --sheet <name>', '工作表名称')
  .option('-p, --period <period>', '默认期间')
  .action((file, options) => {
    try {
      const type = options.type as ImportType;
      const validTypes: ImportType[] = ['budget', 'purchase', 'payment'];
      
      if (!validTypes.includes(type)) {
        console.error(chalk.red(`无效的导入类型: ${type}`));
        console.error(chalk.yellow('有效值: budget, purchase, payment'));
        process.exit(1);
      }

      const absolutePath = path.resolve(file);
      
      if (!fs.existsSync(absolutePath)) {
        console.error(chalk.red(`文件不存在: ${absolutePath}`));
        process.exit(1);
      }

      const typeNames: Record<ImportType, string> = {
        'budget': '预算',
        'purchase': '采购申请',
        'payment': '合同付款'
      };

      console.log(chalk.cyan(`正在导入${typeNames[type]}数据...`));

      const summary = importFromExcel(absolutePath, {
        type,
        sheetName: options.sheet,
        period: options.period
      });

      console.log(chalk.green('\n导入完成！'));
      console.log(chalk.cyan(`  总计: ${summary.totalRecords} 条`));
      console.log(chalk.green(`  成功: ${summary.successCount} 条`));
      
      if (summary.errorCount > 0) {
        console.log(chalk.red(`  失败: ${summary.errorCount} 条`));
        
        console.log(chalk.yellow('\n错误详情：'));
        const table = new Table({
          head: [chalk.cyan('行号'), chalk.cyan('字段'), chalk.cyan('错误信息')],
          colWidths: [10, 15, 50],
          wordWrap: true
        });

        summary.errors.slice(0, 10).forEach(err => {
          table.push([
            err.row,
            err.field,
            err.message
          ]);
        });
        
        console.log(table.toString());
        
        if (summary.errors.length > 10) {
          console.log(chalk.yellow(`\n... 还有 ${summary.errors.length - 10} 条错误未显示`));
        }
        
        console.log(chalk.yellow('\n提示: 请检查数据格式后重试，重复导入会自动跳过已存在的记录。'));
      } else {
        console.log(chalk.cyan('\n提示: 您可以运行 budget check 检查预算状态'));
      }
    } catch (error) {
      console.error(chalk.red('导入失败:'), error instanceof Error ? error.message : error);
      process.exit(1);
    } finally {
      closeDatabase();
    }
  });

program
  .command('check')
  .description('检查预算超支和异常')
  .option('-i, --id <budget_id>', '检查特定预算')
  .option('--all', '显示所有预算（包括正常的）')
  .action((options) => {
    try {
      if (options.id) {
        const result = checkBudgetStatus(options.id);
        
        if (!result) {
          console.error(chalk.red(`找不到预算: ${options.id}`));
          process.exit(1);
        }

        console.log(chalk.cyan('\n预算详情：'));
        
        const table = new Table({
          head: [chalk.cyan('字段'), chalk.cyan('值')],
          colWidths: [20, 50]
        });

        table.push(
          ['部门', result.departmentName],
          ['期间', result.period],
          ['预算类型', result.budgetType],
          ['预算金额', `¥${result.budgetAmount.toLocaleString()}`],
          ['已用金额', `¥${result.usedAmount.toLocaleString()}`],
          ['预留金额', `¥${result.reservedAmount.toLocaleString()}`],
          ['剩余金额', `¥${result.remainingAmount.toLocaleString()}`],
          ['使用率', `${(result.usageRate * 100).toFixed(1)}%`],
          ['阈值', `${(result.threshold * 100)}%`]
        );

        console.log(table.toString());

        if (result.issues.length > 0) {
          console.log(chalk.red('\n⚠ 发现问题：'));
          result.issues.forEach(issue => {
            console.log(chalk.red(`  - ${issue}`));
          });
        } else {
          console.log(chalk.green('\n✓ 预算状态正常'));
        }
      } else {
        const results = checkAllBudgets();
        const displayResults = options.all 
          ? results 
          : results.filter(r => r.isOverBudget || r.isOverThreshold);

        if (displayResults.length === 0) {
          console.log(chalk.green('\n✓ 所有预算状态正常！'));
          if (!options.all) {
            console.log(chalk.cyan('使用 --all 查看所有预算详情'));
          }
          return;
        }

        console.log(chalk.yellow(`\n发现 ${displayResults.length} 个需要关注的预算：`));
        
        const table = new Table({
          head: [
            chalk.cyan('部门'), 
            chalk.cyan('期间'), 
            chalk.cyan('类型'),
            chalk.cyan('预算金额'),
            chalk.cyan('已用金额'),
            chalk.cyan('使用率'),
            chalk.cyan('状态')
          ],
          colWidths: [15, 10, 10, 15, 15, 12, 12],
          wordWrap: true
        });

        displayResults.forEach(r => {
          let status = chalk.green('正常');
          if (r.isOverBudget) {
            status = chalk.red('超支');
          } else if (r.isOverThreshold) {
            status = chalk.yellow('超阈值');
          }

          table.push([
            r.departmentName,
            r.period,
            r.budgetType,
            `¥${r.budgetAmount.toLocaleString()}`,
            `¥${r.usedAmount.toLocaleString()}`,
            `${(r.usageRate * 100).toFixed(1)}%`,
            status
          ]);
        });

        console.log(table.toString());

        const overBudgetCount = results.filter(r => r.isOverBudget).length;
        const overThresholdCount = results.filter(r => r.isOverThreshold && !r.isOverBudget).length;
        
        console.log(chalk.cyan(`\n汇总: 超支 ${overBudgetCount} 个, 超阈值 ${overThresholdCount} 个`));
      }
    } catch (error) {
      console.error(chalk.red('检查失败:'), error instanceof Error ? error.message : error);
      process.exit(1);
    } finally {
      closeDatabase();
    }
  });

program
  .command('history')
  .description('查看历史记录')
  .option('-t, --type <type>', '记录类型: budget | exception | import')
  .option('-i, --id <id>', '特定预算 ID（仅 budget 类型）')
  .option('-n, --limit <number>', '显示数量限制', '20')
  .action((options) => {
    try {
      const type = options.type || 'budget';
      const limit = parseInt(options.limit) || 20;

      if (type === 'budget') {
        const history = options.id 
          ? getBudgetHistory(options.id)
          : getBudgetHistory();

        if (history.length === 0) {
          console.log(chalk.yellow('没有找到预算变更记录'));
          return;
        }

        console.log(chalk.cyan('\n预算变更历史：'));
        
        const table = new Table({
          head: [
            chalk.cyan('时间'),
            chalk.cyan('部门'),
            chalk.cyan('期间'),
            chalk.cyan('类型'),
            chalk.cyan('操作'),
            chalk.cyan('金额')
          ],
          colWidths: [20, 12, 8, 8, 10, 15],
          wordWrap: true
        });

        history.slice(0, limit).forEach(h => {
          table.push([
            h.created_at,
            h.department_name || '',
            h.period || '',
            h.budget_type || '',
            h.action_type,
            `¥${h.amount.toLocaleString()}`
          ]);
        });

        console.log(table.toString());
      } else if (type === 'exception') {
        const exceptions = getExceptions();
        
        if (exceptions.length === 0) {
          console.log(chalk.green('✓ 没有异常记录'));
          return;
        }

        console.log(chalk.yellow(`\n异常记录（共 ${exceptions.length} 条）：`));
        
        const table = new Table({
          head: [
            chalk.cyan('时间'),
            chalk.cyan('类型'),
            chalk.cyan('严重度'),
            chalk.cyan('消息'),
            chalk.cyan('状态')
          ],
          colWidths: [20, 20, 10, 40, 8],
          wordWrap: true
        });

        exceptions.slice(0, limit).forEach(e => {
          let severity = chalk.cyan(e.severity);
          if (e.severity === 'critical') severity = chalk.red(e.severity);
          if (e.severity === 'error') severity = chalk.red(e.severity);
          if (e.severity === 'warning') severity = chalk.yellow(e.severity);

          const status = e.is_resolved ? chalk.green('已解决') : chalk.red('未解决');

          table.push([
            e.created_at,
            e.exception_type,
            severity,
            e.message,
            status
          ]);
        });

        console.log(table.toString());
        
        const unresolved = exceptions.filter(e => !e.is_resolved).length;
        if (unresolved > 0) {
          console.log(chalk.red(`\n⚠ 还有 ${unresolved} 条未解决的异常`));
        }
      } else if (type === 'import') {
        const logs = getImportLogs();
        
        if (logs.length === 0) {
          console.log(chalk.yellow('没有导入记录'));
          return;
        }

        console.log(chalk.cyan('\n导入历史：'));
        
        const table = new Table({
          head: [
            chalk.cyan('时间'),
            chalk.cyan('文件'),
            chalk.cyan('类型'),
            chalk.cyan('总计'),
            chalk.cyan('成功'),
            chalk.cyan('失败'),
            chalk.cyan('状态')
          ],
          colWidths: [20, 25, 10, 8, 8, 8, 15],
          wordWrap: true
        });

        logs.slice(0, limit).forEach(l => {
          let status = chalk.cyan(l.status);
          if (l.status === 'completed') status = chalk.green(l.status);
          if (l.status === 'completed_with_errors') status = chalk.yellow(l.status);
          if (l.status === 'failed') status = chalk.red(l.status);

          table.push([
            l.created_at,
            path.basename(l.file_name),
            l.file_type,
            l.total_records,
            l.success_count,
            l.error_count,
            status
          ]);
        });

        console.log(table.toString());
      } else {
        console.error(chalk.red(`无效的历史类型: ${type}`));
        console.error(chalk.yellow('有效值: budget, exception, import'));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('查看历史失败:'), error instanceof Error ? error.message : error);
      process.exit(1);
    } finally {
      closeDatabase();
    }
  });

program
  .command('resolve')
  .description('标记异常为已解决')
  .argument('<exception_id>', '异常 ID')
  .action((exceptionId) => {
    try {
      const exceptions = getExceptions();
      const exception = exceptions.find(e => e.id === exceptionId);
      
      if (!exception) {
        console.error(chalk.red(`找不到异常记录: ${exceptionId}`));
        process.exit(1);
      }

      if (exception.is_resolved) {
        console.log(chalk.yellow('该异常已经解决'));
        return;
      }

      resolveException(exceptionId);
      console.log(chalk.green('✓ 异常已标记为已解决'));
    } catch (error) {
      console.error(chalk.red('操作失败:'), error instanceof Error ? error.message : error);
      process.exit(1);
    } finally {
      closeDatabase();
    }
  });

program
  .command('report')
  .description('生成 Excel 报告')
  .option('-o, --output <path>', '输出文件路径')
  .action((options) => {
    try {
      const outputPath = options.output || `./budget_report_${Date.now()}.xlsx`;
      const absolutePath = path.resolve(outputPath);

      const data = generateReportData();
      
      console.log(chalk.cyan('正在生成报告...'));
      generateExcelReport(absolutePath);

      console.log(chalk.green('✓ 报告生成成功！'));
      console.log(chalk.cyan(`文件路径: ${absolutePath}`));
      
      console.log(chalk.cyan('\n报告概览：'));
      const summaryTable = new Table({
        head: [chalk.cyan('项目'), chalk.cyan('数值')],
        colWidths: [20, 20]
      });

      summaryTable.push(
        ['预算总数', data.summary.totalBudgets],
        ['超支预算', chalk.red(data.summary.overBudgetCount)],
        ['超阈值预算', chalk.yellow(data.summary.overThresholdCount)],
        ['采购申请数', data.summary.totalPurchaseRequests],
        ['付款记录数', data.summary.totalPayments],
        ['待处理异常', chalk.red(data.summary.pendingExceptions)]
      );

      console.log(summaryTable.toString());

      console.log(chalk.cyan('\n报告包含以下工作表：'));
      console.log(chalk.cyan('  • 概览 - 整体统计'));
      console.log(chalk.cyan('  • 预算状况 - 各部门预算使用情况'));
      console.log(chalk.cyan('  • 采购申请 - 所有采购记录'));
      console.log(chalk.cyan('  • 合同付款 - 所有付款记录'));
      console.log(chalk.cyan('  • 异常记录 - 所有异常信息'));
    } catch (error) {
      console.error(chalk.red('报告生成失败:'), error instanceof Error ? error.message : error);
      process.exit(1);
    } finally {
      closeDatabase();
    }
  });

program
  .command('help [command]')
  .description('显示帮助信息')
  .action((cmd) => {
    if (cmd) {
      const command = program.commands.find(c => c.name() === cmd);
      if (command) {
        command.outputHelp();
      } else {
        console.error(chalk.red(`找不到命令: ${cmd}`));
        program.outputHelp();
      }
    } else {
      program.outputHelp();
      console.log(chalk.cyan('\n使用示例：'));
      console.log(chalk.cyan('  budget init                    # 初始化数据库'));
      console.log(chalk.cyan('  budget template -t budget      # 生成预算模板'));
      console.log(chalk.cyan('  budget import data.xlsx -t budget  # 导入预算数据'));
      console.log(chalk.cyan('  budget check                   # 检查预算状态'));
      console.log(chalk.cyan('  budget history -t exception    # 查看异常记录'));
      console.log(chalk.cyan('  budget report                  # 生成 Excel 报告'));
    }
  });

program.parseAsync(process.argv).catch((error) => {
  console.error(chalk.red('发生错误:'), error.message);
  process.exit(1);
});
