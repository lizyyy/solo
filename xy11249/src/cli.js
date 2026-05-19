#!/usr/bin/env node

const yargs = require('yargs');
const chalk = require('chalk');
const Table = require('cli-table3');
const path = require('path');

const OrderImporter = require('./importers/OrderImporter');
const ShortageImporter = require('./importers/ShortageImporter');
const RuleImporter = require('./importers/RuleImporter');
const CompensationService = require('./services/CompensationService');
const ReportService = require('./services/ReportService');
const DataStore = require('./utils/DataStore');

const dataDir = path.join(__dirname, './data');
const dataStore = new DataStore(dataDir);
const compensationService = new CompensationService(dataDir);
const reportService = new ReportService(dataDir);

console.log(chalk.blue.bold('\n=== 团长运营对账系统 ===\n'));

yargs
  .command({
    command: 'import-orders <file>',
    describe: '导入订单CSV文件',
    handler: async (argv) => {
      try {
        const importer = new OrderImporter(dataStore);
        const result = await importer.import(argv.file);
        
        console.log(chalk.green(`成功导入 ${result.success.length} 条订单记录`));
        if (result.failed.length > 0) {
          console.log(chalk.yellow(`失败 ${result.failed.length} 条记录，已保存到问题记录`));
        }
        console.log(chalk.gray(`总共处理: ${result.total} 条`));
      } catch (error) {
        console.log(chalk.red('导入失败:'), error.message);
      }
    }
  })
  .command({
    command: 'import-shortage <file>',
    describe: '导入缺货清单Excel文件',
    handler: (argv) => {
      try {
        const importer = new ShortageImporter(dataStore);
        const result = importer.import(argv.file);
        
        console.log(chalk.green(`成功导入 ${result.success.length} 条缺货记录`));
        if (result.failed.length > 0) {
          console.log(chalk.yellow(`失败 ${result.failed.length} 条记录，已保存到问题记录`));
        }
        console.log(chalk.gray(`总共处理: ${result.total} 条`));
      } catch (error) {
        console.log(chalk.red('导入失败:'), error.message);
      }
    }
  })
  .command({
    command: 'import-rules <file>',
    describe: '导入补偿规则JSON文件',
    handler: (argv) => {
      try {
        const importer = new RuleImporter(dataStore);
        const result = importer.import(argv.file);
        
        console.log(chalk.green(`成功导入 ${result.success.length} 条补偿规则`));
        if (result.failed.length > 0) {
          console.log(chalk.yellow(`失败 ${result.failed.length} 条记录，已保存到问题记录`));
        }
        console.log(chalk.gray(`总共处理: ${result.total} 条`));
      } catch (error) {
        console.log(chalk.red('导入失败:'), error.message);
      }
    }
  })
  .command({
    command: 'process',
    describe: '批量处理缺货补偿',
    handler: async () => {
      try {
        const result = await compensationService.processBatch();
        
        console.log(chalk.green(`成功处理 ${result.success.length} 条补偿`));
        if (result.skipped.length > 0) {
          console.log(chalk.yellow(`跳过 ${result.skipped.length} 条记录`));
        }
        if (result.failed.length > 0) {
          console.log(chalk.red(`失败 ${result.failed.length} 条记录`));
        }
        console.log(chalk.gray(`总共处理: ${result.total} 条`));
      } catch (error) {
        console.log(chalk.red('处理失败:'), error.message);
      }
    }
  })
  .command({
    command: 'retry',
    describe: '重试失败的补偿记录',
    handler: () => {
      try {
        const result = compensationService.retryFailedCompensations();
        
        console.log(chalk.green(`成功重试 ${result.success.length} 条补偿`));
        if (result.failed.length > 0) {
          console.log(chalk.red(`重试失败 ${result.failed.length} 条记录`));
        }
        console.log(chalk.gray(`总共重试: ${result.total} 条`));
      } catch (error) {
        console.log(chalk.red('重试失败:'), error.message);
      }
    }
  })
  .command({
    command: 'review',
    describe: '查看待审核补偿记录',
    builder: (yargs) => {
      yargs.option('status', {
        alias: 's',
        describe: '筛选状态',
        type: 'string',
        default: 'pending'
      });
    },
    handler: (argv) => {
      try {
        const compensations = compensationService.getCompensationsByStatus(argv.status);
        
        if (compensations.length === 0) {
          console.log(chalk.gray('没有找到补偿记录'));
          return;
        }

        const table = new Table({
          head: ['订单号', '用户', '商品', '缺货数量', '补偿类型', '金额/面值', '状态'],
          colWidths: [15, 12, 20, 10, 10, 12, 10]
        });

        compensations.forEach(c => {
          const amount = c.refundAmount || c.couponValue || c.exchangeQuantity || '';
          table.push([
            c.orderNo,
            c.userName,
            c.productName.substring(0, 16),
            c.shortageQuantity,
            c.compensationType,
            amount,
            c.status
          ]);
        });

        console.log(table.toString());
        console.log(chalk.gray(`总共 ${compensations.length} 条记录`));
      } catch (error) {
        console.log(chalk.red('查询失败:'), error.message);
      }
    }
  })
  .command({
    command: 'approve <id> [operator]',
    describe: '审核通过补偿记录',
    handler: (argv) => {
      try {
        const compensation = compensationService.approveCompensation(
          argv.id,
          argv.operator || 'system'
        );
        console.log(chalk.green(`成功审核通过补偿记录: ${argv.id}`));
        console.log(chalk.gray(`订单号: ${compensation.orderNo}, 用户: ${compensation.userName}`));
      } catch (error) {
        console.log(chalk.red('审核失败:'), error.message);
      }
    }
  })
  .command({
    command: 'execute <id>',
    describe: '执行补偿',
    handler: (argv) => {
      try {
        const compensation = compensationService.executeCompensation(argv.id);
        console.log(chalk.green(`成功执行补偿: ${argv.id}`));
        console.log(chalk.gray(`订单号: ${compensation.orderNo}, 用户: ${compensation.userName}`));
      } catch (error) {
        console.log(chalk.red('执行失败:'), error.message);
      }
    }
  })
  .command({
    command: 'bad-records',
    describe: '查看问题记录',
    builder: (yargs) => {
      yargs.option('status', {
        alias: 's',
        describe: '筛选状态',
        type: 'string',
        default: 'unresolved'
      });
    },
    handler: (argv) => {
      try {
        const records = compensationService.getBadRecords(argv.status);
        
        if (records.length === 0) {
          console.log(chalk.gray('没有找到问题记录'));
          return;
        }

        const table = new Table({
          head: ['记录ID', '来源', '行号', '错误类型', '字段', '状态'],
          colWidths: [15, 12, 8, 20, 15, 10]
        });

        records.forEach(r => {
          table.push([
            r.id.substring(0, 12),
            r.sourceType,
            r.rowNumber,
            r.errorType.substring(0, 16),
            r.fieldName || '-',
            r.status
          ]);
        });

        console.log(table.toString());
        console.log(chalk.gray(`总共 ${records.length} 条记录`));
      } catch (error) {
        console.log(chalk.red('查询失败:'), error.message);
      }
    }
  })
  .command({
    command: 'resolve-bad-record <id> <note> [resolver]',
    describe: '标记问题记录为已解决',
    handler: (argv) => {
      try {
        const record = compensationService.resolveBadRecord(
          argv.id,
          argv.note,
          argv.resolver || 'system'
        );
        console.log(chalk.green(`成功解决问题记录: ${argv.id}`));
      } catch (error) {
        console.log(chalk.red('处理失败:'), error.message);
      }
    }
  })
  .command({
    command: 'report',
    describe: '生成统计报告',
    handler: () => {
      try {
        const report = reportService.generateFullReport();
        
        console.log(chalk.bold('报告生成时间:'), report.generatedAt);
        console.log('');
        
        console.log(chalk.bold('=== 补偿统计 ==='));
        console.log('总补偿订单:', report.compensation.total);
        console.log('  退款:', report.compensation.byType.refund);
        console.log('  优惠券:', report.compensation.byType.coupon);
        console.log('  换货:', report.compensation.byType.exchange);
        console.log('总退款金额:', report.compensation.totalRefundAmount.toFixed(2));
        console.log('总优惠券金额:', report.compensation.totalCouponValue.toFixed(2));
        console.log('总换货数量:', report.compensation.totalExchangeItems);
        console.log('');

        console.log(chalk.bold('=== 缺货统计 ==='));
        console.log('缺货记录数:', report.shortage.total);
        console.log('总缺货数量:', report.shortage.totalShortageQuantity);
        console.log('');

        console.log(chalk.bold('=== 问题记录统计 ==='));
        console.log('问题记录总数:', report.badRecords.total);
        console.log('  未处理:', report.badRecords.byStatus.unresolved);
        console.log('  已处理:', report.badRecords.byStatus.resolved);
      } catch (error) {
        console.log(chalk.red('生成报告失败:'), error.message);
      }
    }
  })
  .command({
    command: 'export-compensations <file>',
    describe: '导出补偿记录到Excel',
    builder: (yargs) => {
      yargs.option('status', {
        alias: 's',
        describe: '筛选状态',
        type: 'string'
      });
    },
    handler: (argv) => {
      try {
        const result = reportService.exportCompensationsToExcel(argv.file, argv.status);
        console.log(chalk.green(`成功导出 ${result.count} 条补偿记录到: ${result.filePath}`));
      } catch (error) {
        console.log(chalk.red('导出失败:'), error.message);
      }
    }
  })
  .command({
    command: 'export-bad-records <file>',
    describe: '导出问题记录到Excel',
    builder: (yargs) => {
      yargs.option('status', {
        alias: 's',
        describe: '筛选状态',
        type: 'string'
      });
    },
    handler: (argv) => {
      try {
        const result = reportService.exportBadRecordsToExcel(argv.file, argv.status);
        console.log(chalk.green(`成功导出 ${result.count} 条问题记录到: ${result.filePath}`));
      } catch (error) {
        console.log(chalk.red('导出失败:'), error.message);
      }
    }
  })
  .command({
    command: 'export-reconciliation <file>',
    describe: '导出完整对账报告',
    handler: (argv) => {
      try {
        const result = reportService.exportReconciliationReport(argv.file);
        console.log(chalk.green(`成功导出对账报告到: ${result.filePath}`));
      } catch (error) {
        console.log(chalk.red('导出失败:'), error.message);
      }
    }
  })
  .demandCommand(1, chalk.red('请指定命令，使用 --help 查看帮助'))
  .help()
  .argv;
