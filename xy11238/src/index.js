#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const storage = require('./storage');
const importer = require('./importer');
const reviewer = require('./reviewer');
const exporter = require('./exporter');
const errorHandler = require('./errorHandler');
const path = require('path');

const program = new Command();

program
  .name('reagent')
  .description('高校实验室试剂管理系统 - CLI工具')
  .version('1.0.0');

program
  .command('import-applications')
  .description('导入申领单CSV文件')
  .argument('<filePath>', 'CSV文件路径')
  .action(async (filePath) => {
    try {
      const absolutePath = path.resolve(filePath);
      console.log(chalk.blue(`正在导入申领单: ${absolutePath}`));
      
      const result = await importer.importApplicationsCSV(absolutePath);
      
      console.log(chalk.green(`✅ 成功导入 ${result.imported} 条申领记录`));
      if (result.errors > 0) {
        console.log(chalk.yellow(`⚠️  发现 ${result.errors} 条错误记录`));
      }
    } catch (err) {
      console.error(chalk.red(`❌ 导入失败: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command('import-inventory')
  .description('导入库存JSON文件')
  .argument('<filePath>', 'JSON文件路径')
  .action(async (filePath) => {
    try {
      const absolutePath = path.resolve(filePath);
      console.log(chalk.blue(`正在导入库存: ${absolutePath}`));
      
      const result = await importer.importInventoryJSON(absolutePath);
      
      console.log(chalk.green(`✅ 成功导入 ${result.imported} 条库存记录`));
      if (result.errors > 0) {
        console.log(chalk.yellow(`⚠️  发现 ${result.errors} 条错误记录`));
      }
    } catch (err) {
      console.error(chalk.red(`❌ 导入失败: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command('import-hazard-rules')
  .description('导入危化品规则JSON文件')
  .argument('<filePath>', 'JSON文件路径')
  .action(async (filePath) => {
    try {
      const absolutePath = path.resolve(filePath);
      console.log(chalk.blue(`正在导入危化品规则: ${absolutePath}`));
      
      const result = await importer.importHazardRulesJSON(absolutePath);
      
      console.log(chalk.green(`✅ 成功导入 ${result.imported} 条规则记录`));
      if (result.errors > 0) {
        console.log(chalk.yellow(`⚠️  发现 ${result.errors} 条错误记录`));
      }
    } catch (err) {
      console.error(chalk.red(`❌ 导入失败: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command('review')
  .description('复核申领记录（核对库存、危险等级、审批记录）')
  .action(() => {
    try {
      console.log(chalk.blue('正在复核申领记录...'));
      
      const result = reviewer.review();
      
      console.log(chalk.bold('\n=== 复核结果 ==='));
      console.log(`总申请数: ${result.totalApplications}`);
      console.log(chalk.green(`✅ 通过: ${result.passed}`));
      console.log(chalk.yellow(`⚠️  警告: ${result.warning}`));
      console.log(chalk.red(`❌ 未通过: ${result.failed}`));
      
      if (result.details.length > 0) {
        console.log(chalk.bold('\n=== 详细信息 ==='));
        result.details.forEach((detail, index) => {
          const statusColor = detail.status === 'passed' ? chalk.green : 
                             detail.status === 'warning' ? chalk.yellow : chalk.red;
          console.log(`\n${index + 1}. ${detail.application.reagentName} - ${statusColor(detail.status)}`);
          console.log(`   申请人: ${detail.application.applicant}`);
          console.log(`   申请数量: ${detail.application.quantity}`);
          
          if (detail.issues.length > 0) {
            console.log(chalk.yellow('   问题:'));
            detail.issues.forEach(issue => {
              console.log(`     - ${issue.message}`);
              console.log(`       ${chalk.gray(issue.suggestion)}`);
            });
          }
        });
      }
    } catch (err) {
      console.error(chalk.red(`❌ 复核失败: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command('export')
  .description('导出数据')
  .option('-a, --all', '导出所有数据')
  .option('-e, --errors', '导出错误记录')
  .option('-r, --review', '导出复核结果')
  .option('-p, --applications', '导出申领记录')
  .option('-i, --inventory', '导出库存记录')
  .option('-h, --history', '导出导入历史')
  .argument('[outputPath]', '输出文件路径', 'output.json')
  .action((outputPath, options) => {
    try {
      const absolutePath = path.resolve(outputPath);
      let result;
      
      if (options.all) {
        result = exporter.exportAll(absolutePath);
        console.log(chalk.green(`✅ 所有数据已导出到: ${absolutePath}`));
      } else if (options.errors) {
        result = exporter.exportErrors(absolutePath);
        console.log(chalk.green(`✅ 错误记录已导出到: ${absolutePath}`));
      } else if (options.review) {
        result = exporter.exportReviewResults(absolutePath);
        console.log(chalk.green(`✅ 复核结果已导出到: ${absolutePath}`));
      } else if (options.applications) {
        result = exporter.exportApplications(absolutePath);
        console.log(chalk.green(`✅ 申领记录已导出到: ${absolutePath}`));
      } else if (options.inventory) {
        result = exporter.exportInventory(absolutePath);
        console.log(chalk.green(`✅ 库存记录已导出到: ${absolutePath}`));
      } else if (options.history) {
        result = exporter.exportImportHistory(absolutePath);
        console.log(chalk.green(`✅ 导入历史已导出到: ${absolutePath}`));
      } else {
        console.log(chalk.yellow('请指定导出类型，使用 --help 查看选项'));
        return;
      }
    } catch (err) {
      console.error(chalk.red(`❌ 导出失败: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command('list-errors')
  .description('查看所有错误记录')
  .option('-s, --source <source>', '按来源过滤 (application/inventory/hazardRule/review)')
  .action((options) => {
    try {
      let errors;
      if (options.source) {
        errors = errorHandler.getErrorsBySource(options.source);
      } else {
        errors = errorHandler.getAllErrors();
      }
      
      if (errors.length === 0) {
        console.log(chalk.green('暂无错误记录'));
        return;
      }
      
      console.log(chalk.bold(`=== 错误记录 (共 ${errors.length} 条) ===\n`));
      errors.forEach((err, index) => {
        console.log(chalk.red(`${index + 1}. [${err.source}] 行 ${err.rowNumber}`));
        console.log(`   类型: ${err.errorType}`);
        console.log(`   错误: ${err.errorMessage}`);
        console.log(chalk.yellow(`   建议: ${err.suggestion}`));
        console.log(`   原始数据: ${JSON.stringify(err.originalData)}`);
        console.log(`   时间: ${err.timestamp}\n`);
      });
    } catch (err) {
      console.error(chalk.red(`❌ 获取错误记录失败: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command('list-history')
  .description('查看导入历史')
  .action(() => {
    try {
      const history = storage.getImportHistory();
      
      if (history.length === 0) {
        console.log(chalk.yellow('暂无导入历史'));
        return;
      }
      
      console.log(chalk.bold(`=== 导入历史 (共 ${history.length} 条) ===\n`));
      history.forEach((item, index) => {
        console.log(`${index + 1}. 类型: ${item.type}`);
        console.log(`   文件: ${item.filePath}`);
        console.log(chalk.green(`   成功: ${item.successCount}`));
        if (item.errorCount > 0) {
          console.log(chalk.yellow(`   错误: ${item.errorCount}`));
        }
        console.log(`   时间: ${item.timestamp}\n`);
      });
    } catch (err) {
      console.error(chalk.red(`❌ 获取导入历史失败: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command('status')
  .description('查看当前数据状态')
  .action(() => {
    try {
      const data = storage.getAllData();
      
      console.log(chalk.bold('=== 数据状态 ==='));
      console.log(`申领记录: ${data.applications.length} 条`);
      console.log(`库存记录: ${data.inventory.length} 条`);
      console.log(`危化品规则: ${data.hazardRules.length} 条`);
      console.log(`导入历史: ${data.importHistory.length} 条`);
      console.log(`复核记录: ${data.reviewResults.length} 条`);
      console.log(`错误记录: ${data.errorRecords.length} 条`);
    } catch (err) {
      console.error(chalk.red(`❌ 获取状态失败: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command('clear')
  .description('清空所有数据（谨慎使用）')
  .option('-f, --force', '强制清空，不提示确认')
  .action((options) => {
    try {
      if (!options.force) {
        const readline = require('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        rl.question(chalk.yellow('确定要清空所有数据吗？此操作不可恢复！(yes/no): '), (answer) => {
          if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
            storage.clearAll();
            console.log(chalk.green('✅ 所有数据已清空'));
          } else {
            console.log(chalk.gray('操作已取消'));
          }
          rl.close();
        });
      } else {
        storage.clearAll();
        console.log(chalk.green('✅ 所有数据已清空'));
      }
    } catch (err) {
      console.error(chalk.red(`❌ 清空失败: ${err.message}`));
      process.exit(1);
    }
  });

program.parseAsync(process.argv);
