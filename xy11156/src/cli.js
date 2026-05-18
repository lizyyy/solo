#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

import { BillParser } from './modules/parser.js';
import { BillValidator } from './modules/validator.js';
import { BillReporter } from './modules/reporter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

const program = new Command();

program
  .name('bill-binding')
  .description('社区维修基金办基金票据装订 CLI 工具')
  .version('1.0.0');

program
  .command('preview')
  .description('预览票据数据，不生成正式报告')
  .option('-s, --source <path>', '数据来源文件或目录', path.join(projectRoot, 'samples'))
  .action(async (options) => {
    console.log(chalk.blue('========================================'));
    console.log(chalk.blue('  社区维修基金办基金票据装订 - 预览模式'));
    console.log(chalk.blue('========================================'));
    console.log('');

    try {
      const parser = new BillParser();
      const sourcePath = path.resolve(options.source);
      
      console.log(chalk.gray(`解析数据来源: ${sourcePath}`));
      console.log('');

      let parseResult;
      const stat = await fs.stat(sourcePath);
      
      if (stat.isDirectory()) {
        parseResult = await parser.parseDirectory(sourcePath);
      } else {
        const result = await parser.parseFile(sourcePath);
        parseResult = [{ file: path.basename(sourcePath), ...result }];
      }

      const allBills = parseResult.flatMap(r => r.bills);
      
      console.log(chalk.green('✓ 解析完成'));
      console.log(`文件数量: ${parseResult.length}`);
      console.log(`票据总数: ${allBills.length}`);
      console.log('');

      console.log(chalk.yellow('────────────── 票据预览 ──────────────'));
      console.log('');
      
      allBills.slice(0, 10).forEach((bill, idx) => {
        console.log(`${idx + 1}. ${bill.billNumber || bill.billId}`);
        console.log(`   小区: ${bill.communityName}`);
        console.log(`   项目: ${bill.projectName}`);
        console.log(`   金额: ¥${bill.amount.toFixed(2)}`);
        console.log(`   红冲: ${bill.isRed冲 ? '是' : '否'}`);
        console.log(`   附件: ${bill.attachmentCount}个, ${bill.attachmentPages}页`);
        console.log('');
      });

      if (allBills.length > 10) {
        console.log(chalk.gray(`... 还有 ${allBills.length - 10} 条票据`));
        console.log('');
      }

      console.log(chalk.blue('========================================'));
      console.log(chalk.blue('预览完成，运行 ' + chalk.cyan('npm run run') + ' 进行正式校验'));
      console.log(chalk.blue('========================================'));

    } catch (error) {
      console.error(chalk.red('✗ 预览失败:'), error.message);
      process.exit(1);
    }
  });

program
  .command('run')
  .description('正式执行票据校验并生成报告')
  .option('-s, --source <path>', '数据来源文件或目录', path.join(projectRoot, 'samples'))
  .action(async (options) => {
    console.log(chalk.blue('========================================'));
    console.log(chalk.blue('  社区维修基金办基金票据装订 - 正式执行'));
    console.log(chalk.blue('========================================'));
    console.log('');

    try {
      const parser = new BillParser();
      const validator = new BillValidator();
      const reporter = new BillReporter();

      const sourcePath = path.resolve(options.source);
      
      console.log(chalk.gray(`解析数据来源: ${sourcePath}`));
      console.log('');

      let parseResult;
      const stat = await fs.stat(sourcePath);
      
      if (stat.isDirectory()) {
        parseResult = await parser.parseDirectory(sourcePath);
      } else {
        const result = await parser.parseFile(sourcePath);
        parseResult = [{ file: path.basename(sourcePath), ...result }];
      }

      const allBills = parseResult.flatMap(r => r.bills);
      
      console.log(chalk.green('✓ 解析完成'));
      console.log(`文件数量: ${parseResult.length}`);
      console.log(`票据总数: ${allBills.length}`);
      console.log('');

      console.log(chalk.gray('正在校验票据...'));
      const validateResult = validator.validate(allBills);
      console.log(chalk.green('✓ 校验完成'));
      console.log('');

      console.log(chalk.yellow('────────────── 校验汇总 ──────────────'));
      console.log('');
      console.log(`通过: ${validateResult.summary.passed}`);
      console.log(`警告: ${validateResult.summary.warning}`);
      console.log(`不通过: ${validateResult.summary.failed}`);
      console.log(`通过率: ${validateResult.summary.passRate}%`);
      console.log(`红冲票据: ${validateResult.summary.red冲Count}`);
      console.log(`总金额: ¥${validateResult.summary.totalAmount.toFixed(2)}`);
      console.log('');

      if (validateResult.errors.length > 0) {
        console.log(chalk.red('────────────── 错误明细 ──────────────'));
        console.log('');
        validateResult.errors.slice(0, 5).forEach((err, idx) => {
          console.log(`${idx + 1}. ${err.billNumber}: ${err.message}`);
        });
        if (validateResult.errors.length > 5) {
          console.log(chalk.gray(`... 还有 ${validateResult.errors.length - 5} 条错误`));
        }
        console.log('');
      }

      console.log(chalk.gray('正在生成报告...'));
      const reportResult = await reporter.generateReport(parseResult, validateResult, '正式');
      console.log(chalk.green('✓ 报告生成完成'));
      console.log('');
      console.log(`运行ID: ${reportResult.runId}`);
      console.log(`报告文件:`);
      console.log(`  - JSON: ${reportResult.files.json}`);
      console.log(`  - 文本: ${reportResult.files.text}`);
      console.log(`  - 对比: ${reportResult.files.comparison}`);
      console.log('');

      console.log(chalk.blue('========================================'));
      console.log(chalk.blue('执行完成，运行 ' + chalk.cyan('npm run report') + ' 查看历史报告'));
      console.log(chalk.blue('========================================'));

    } catch (error) {
      console.error(chalk.red('✗ 执行失败:'), error.message);
      console.error(error.stack);
      process.exit(1);
    }
  });

program
  .command('report')
  .description('查看报告列表和对比报告')
  .option('-l, --list', '显示报告列表')
  .option('-c, --compare <runId1,runId2>', '对比两个报告')
  .action(async (options) => {
    const reporter = new BillReporter();

    if (options.list || (!options.list && !options.compare)) {
      console.log(chalk.blue('========================================'));
      console.log(chalk.blue('  社区维修基金办基金票据装订 - 报告列表'));
      console.log(chalk.blue('========================================'));
      console.log('');

      const reports = await reporter.getReportList();
      
      if (reports.length === 0) {
        console.log(chalk.yellow('暂无报告，请先运行 ' + chalk.cyan('npm run run')));
        return;
      }

      console.log(`共找到 ${reports.length} 份报告:`);
      console.log('');

      reports.forEach((report, idx) => {
        console.log(`${idx + 1}. 运行ID: ${chalk.cyan(report.runId)}`);
        console.log(`   运行时间: ${new Date(report.runTime).toLocaleString('zh-CN')}`);
        console.log(`   运行类型: ${report.runType}`);
        console.log(`   票据总数: ${report.summary.billCount}`);
        console.log(`   通过率: ${report.summary.passRate}%`);
        console.log(`   不通过: ${report.summary.failed}`);
        console.log('');
      });

      if (reports.length >= 2) {
        console.log(chalk.gray('对比示例: bill-binding report -c ' + reports[1].runId + ',' + reports[0].runId));
      }
    }

    if (options.compare) {
      const [runId1, runId2] = options.compare.split(',');
      try {
        const comparisonText = await reporter.printComparison(runId1.trim(), runId2.trim());
        console.log(comparisonText);
      } catch (error) {
        console.error(chalk.red('✗ 对比失败:'), error.message);
        process.exit(1);
      }
    }
  });

program.parse(process.argv);
