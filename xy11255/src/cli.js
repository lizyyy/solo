const { Command } = require('commander');
const chalk = require('chalk');
const Table = require('cli-table3');
const { initDatabase } = require('./database');
const { Importer } = require('./importer');
const CompensationProcessor = require('./processor');
const Exporter = require('./exporter');
const ImportError = require('../models/ImportError');

const program = new Command();

program
  .name('leader-operation')
  .description('团长运营对账系统')
  .version('1.0.0');

program
  .command('import')
  .description('导入数据')
  .option('--orders <path>', '导入订单CSV文件')
  .option('--out-of-stock <path>', '导入缺货清单Excel文件')
  .option('--rules <path>', '导入补偿规则JSON文件')
  .action(async (options) => {
    try {
      initDatabase();
      
      if (options.orders) {
        console.log(chalk.blue('正在导入订单数据...'));
        const result = await Importer.importOrders(options.orders);
        console.log(chalk.green(`订单导入完成: 成功 ${result.successCount} 条, 失败 ${result.errorCount} 条, 共 ${result.total} 条`));
      }

      if (options.outOfStock) {
        console.log(chalk.blue('正在导入缺货清单...'));
        const result = await Importer.importOutOfStock(options.outOfStock);
        console.log(chalk.green(`缺货清单导入完成: 成功 ${result.successCount} 条, 失败 ${result.errorCount} 条, 共 ${result.total} 条`));
      }

      if (options.rules) {
        console.log(chalk.blue('正在导入补偿规则...'));
        const result = await Importer.importCompensationRules(options.rules);
        console.log(chalk.green(`补偿规则导入完成: 成功 ${result.successCount} 条, 失败 ${result.errorCount} 条, 共 ${result.total} 条`));
      }

      if (!options.orders && !options.outOfStock && !options.rules) {
        console.log(chalk.yellow('请指定要导入的文件类型，使用 --help 查看帮助'));
      }
    } catch (e) {
      console.error(chalk.red('导入失败:'), e.message);
      console.error(e.stack);
    }
    process.exit(0);
  });

program
  .command('process')
  .description('处理缺货补偿')
  .action(async () => {
    try {
      initDatabase();
      console.log(chalk.blue('正在处理缺货补偿...'));
      const processor = new CompensationProcessor();
      const result = await processor.processOutOfStock();
      console.log(chalk.green(`处理完成: 共处理 ${result.processedCount} 个订单`));
    } catch (e) {
      console.error(chalk.red('处理失败:'), e.message);
      console.error(e.stack);
    }
    process.exit(0);
  });

program
  .command('review')
  .description('复核数据')
  .option('--errors', '查看错误记录')
  .action(async (options) => {
    try {
      initDatabase();
      
      if (options.errors) {
        const errors = await ImportError.findAll();
        if (errors.length === 0) {
          console.log(chalk.green('暂无错误记录'));
          return;
        }

        const table = new Table({
          head: ['ID', '导入类型', '文件名', '行号', '错误信息', '修改建议'],
          colWidths: [5, 12, 20, 6, 30, 30]
        });

        const importTypes = {
          order: '订单',
          out_of_stock: '缺货清单',
          compensation_rule: '补偿规则'
        };

        errors.forEach(e => {
          table.push([
            e.id,
            importTypes[e.import_type] || e.import_type,
            e.file_name,
            e.row_number,
            e.error_message.substring(0, 28),
            (e.suggestion || '').substring(0, 28)
          ]);
        });

        console.log(table.toString());
        console.log(chalk.blue(`共 ${errors.length} 条错误记录`));
      } else {
        const summary = await Exporter.getSummary();
        const statusMap = {
          pending: '待处理',
          processed: '已处理',
          refunded: '已退款',
          exchanged: '已换货',
          couponed: '已补券'
        };

        console.log('\n' + chalk.cyan.bold('=== 数据概览 ===\n'));
        console.log(chalk.white(`总订单数: ${summary.totalOrders}`));
        console.log(chalk.white(`已处理订单: ${summary.totalProcessed}`));
        console.log(chalk.white(`错误记录: ${summary.totalErrors}\n`));

        console.log(chalk.cyan.bold('=== 订单状态 ===\n'));
        Object.entries(summary.statusCounts).forEach(([status, count]) => {
          console.log(chalk.white(`${statusMap[status] || status}: ${count}`));
        });

        console.log('\n' + chalk.cyan.bold('=== 补偿统计 ===\n'));
        const compensationTypes = {
          refund: '退款',
          exchange: '换货',
          coupon: '补券'
        };
        Object.entries(summary.compensationStats).forEach(([type, data]) => {
          console.log(chalk.white(`${compensationTypes[type] || type}: ${data.count} 单, 合计 ${data.total.toFixed(2)} 元`));
        });
        console.log('');
      }
    } catch (e) {
      console.error(chalk.red('复核失败:'), e.message);
      console.error(e.stack);
    }
    process.exit(0);
  });

program
  .command('export')
  .description('导出数据')
  .option('--report <path>', '导出补偿报告CSV')
  .option('--report-xlsx <path>', '导出补偿报告Excel')
  .option('--errors <path>', '导出错误记录CSV')
  .option('--orders <path>', '导出订单CSV')
  .action(async (options) => {
    try {
      initDatabase();
      
      if (options.report) {
        const result = await Exporter.exportReportToCSV(options.report);
        console.log(chalk.green(`补偿报告已导出: ${options.report}, 共 ${result.count} 条记录`));
      }

      if (options.reportXlsx) {
        const result = await Exporter.exportReportToExcel(options.reportXlsx);
        console.log(chalk.green(`补偿报告已导出: ${options.reportXlsx}, 共 ${result.count} 条记录`));
      }

      if (options.errors) {
        const result = await Exporter.exportErrorsToCSV(options.errors);
        console.log(chalk.green(`错误记录已导出: ${options.errors}, 共 ${result.count} 条记录`));
      }

      if (options.orders) {
        const result = await Exporter.exportOrdersToCSV(options.orders);
        console.log(chalk.green(`订单数据已导出: ${options.orders}, 共 ${result.count} 条记录`));
      }

      if (!options.report && !options.reportXlsx && !options.errors && !options.orders) {
        console.log(chalk.yellow('请指定要导出的内容，使用 --help 查看帮助'));
      }
    } catch (e) {
      console.error(chalk.red('导出失败:'), e.message);
      console.error(e.stack);
    }
    process.exit(0);
  });

program
  .command('test')
  .description('运行完整测试流程')
  .action(async () => {
    try {
      initDatabase();
      
      console.log(chalk.cyan.bold('\n=== 团长运营对账系统 - 完整测试流程 ===\n'));

      console.log(chalk.blue('步骤1: 生成缺货清单Excel样例...'));
      require('../scripts/generate_samples');
      console.log(chalk.green('样例文件已生成\n'));

      console.log(chalk.blue('步骤2: 导入订单数据...'));
      const ordersResult = await Importer.importOrders('data/samples/orders.csv');
      console.log(chalk.green(`订单导入: 成功 ${ordersResult.successCount} 条, 失败 ${ordersResult.errorCount} 条\n`));

      console.log(chalk.blue('步骤3: 导入缺货清单...'));
      const oosResult = await Importer.importOutOfStock('data/samples/out_of_stock.xlsx');
      console.log(chalk.green(`缺货清单导入: 成功 ${oosResult.successCount} 条, 失败 ${oosResult.errorCount} 条\n`));

      console.log(chalk.blue('步骤4: 导入补偿规则...'));
      const rulesResult = await Importer.importCompensationRules('data/samples/compensation_rules.json');
      console.log(chalk.green(`补偿规则导入: 成功 ${rulesResult.successCount} 条, 失败 ${rulesResult.errorCount} 条\n`));

      console.log(chalk.blue('步骤5: 处理缺货补偿...'));
      const processor = new CompensationProcessor();
      const processResult = await processor.processOutOfStock();
      console.log(chalk.green(`处理完成: 共处理 ${processResult.processedCount} 个订单\n`));

      console.log(chalk.blue('步骤6: 查看错误记录...'));
      const errors = await ImportError.findAll();
      console.log(chalk.yellow(`发现 ${errors.length} 条错误记录（预期有导入错误用于测试）\n`));

      console.log(chalk.blue('步骤7: 导出补偿报告...'));
      await Exporter.exportReportToCSV('exports/test_report.csv');
      await Exporter.exportErrorsToCSV('exports/test_errors.csv');
      console.log(chalk.green('报告已导出到 exports/ 目录\n'));

      console.log(chalk.green.bold('=== 测试流程完成！=== \n'));
      console.log(chalk.cyan('提示: 重启程序后数据仍然保留，可再次运行 review 命令验证数据持久化\n'));
    } catch (e) {
      console.error(chalk.red('测试失败:'), e.message);
      console.error(e.stack);
    }
    process.exit(0);
  });

program.parseAsync(process.argv);
