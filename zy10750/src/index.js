#!/usr/bin/env node

const { Command } = require('commander');
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const QuoteComparator = require('./QuoteComparator');
const FileHandler = require('./FileHandler');
const ResultExporter = require('./ResultExporter');

const program = new Command();

program
  .name('supplier-quote-compare')
  .description('供应商报价表二次议价比对 CLI - 比对旧价新价和引用情况，识别币种不同、阶梯价、过期报价等特殊情况')
  .version('1.0.0')
  .requiredOption('-i, --input <path>', '输入目录路径，包含新旧报价文件')
  .requiredOption('-r, --rules <path>', '规则文件路径')
  .requiredOption('-o, --output <path>', '输出目录路径')
  .option('-d, --dry-run', '试运行，不生成输出文件')
  .option('-f, --force', '覆盖已存在的输出文件')
  .action(async (options) => {
    console.log(chalk.bold.blue('='.repeat(60)));
    console.log(chalk.bold.blue('  供应商报价表二次议价比对 CLI'));
    console.log(chalk.bold.blue('='.repeat(60)));
    console.log();

    try {
      validateOptions(options);
      printOptions(options);

      const fileHandler = new FileHandler();
      const rules = fileHandler.loadRules(options.rules);
      
      console.log(chalk.cyan('\n[1/5] 正在读取报价文件...'));
      const { oldQuotes, newQuotes } = await fileHandler.loadQuoteFiles(options.input);
      
      console.log(chalk.cyan('[2/5] 正在比对报价数据...'));
      const comparator = new QuoteComparator(rules);
      const results = comparator.compare(oldQuotes, newQuotes);
      
      printSummary(results);
      
      if (!options.dryRun) {
        console.log(chalk.cyan('[3/5] 正在导出结果...'));
        const exporter = new ResultExporter(options.output, options.force);
        await exporter.export(results);
        console.log(chalk.green('✓ 结果已导出到: ' + options.output));
      } else {
        console.log(chalk.yellow('\n[DRY-RUN] 试运行模式，未生成输出文件'));
      }
      
      console.log();
      console.log(chalk.bold.green('✓ 供应商报价表二次议价比对完成!'));
      
    } catch (error) {
      console.error(chalk.bold.red('\n✗ 处理失败:'));
      console.error(chalk.red('  ' + error.message));
      process.exit(1);
    }
  });

function validateOptions(options) {
  if (!fs.existsSync(options.input)) {
    throw new Error(`输入目录不存在: ${options.input}`);
  }
  if (!fs.existsSync(options.rules)) {
    throw new Error(`规则文件不存在: ${options.rules}`);
  }
  if (!options.dryRun) {
    if (fs.existsSync(options.output) && !options.force) {
      throw new Error(`输出目录已存在，使用 --force 覆盖: ${options.output}`);
    }
  }
}

function printOptions(options) {
  console.log(chalk.gray('配置参数:'));
  console.log(chalk.gray('  输入目录: ') + options.input);
  console.log(chalk.gray('  规则文件: ') + options.rules);
  console.log(chalk.gray('  输出目录: ') + options.output);
  console.log(chalk.gray('  试运行: ') + (options.dryRun ? '是' : '否'));
  console.log(chalk.gray('  覆盖输出: ') + (options.force ? '是' : '否'));
}

function printSummary(results) {
  console.log(chalk.cyan('\n[4/5] 比对结果汇总:'));
  console.log();
  
  console.log(chalk.white.bold('  基础统计:'));
  console.log(chalk.gray(`    旧报价记录数: ${results.stats.oldCount}`));
  console.log(chalk.gray(`    新报价记录数: ${results.stats.newCount}`));
  console.log(chalk.gray(`    成功匹配数: ${results.stats.matchedCount}`));
  console.log(chalk.gray(`    仅旧报价数: ${results.stats.onlyOldCount}`));
  console.log(chalk.gray(`    仅新报价数: ${results.stats.onlyNewCount}`));
  console.log();
  
  console.log(chalk.yellow.bold('  特殊情况汇总 - 供应商报价表二次议价比对专属:'));
  console.log(chalk.yellow(`    币种不同记录数: ${results.specialCases.differentCurrency.length}`) + chalk.gray('  (需单独确认汇率换算)'));
  console.log(chalk.magenta(`    阶梯价记录数: ${results.specialCases.tieredPricing.length}`) + chalk.gray('  (存在数量区间定价)'));
  console.log(chalk.red(`    过期报价记录数: ${results.specialCases.expiredQuotes.length}`) + chalk.gray('  (报价已超过有效期)'));
  console.log(chalk.red(`    重复行记录数: ${results.specialCases.duplicateRows.length}`) + chalk.gray('  (存在重复报价)'));
  console.log(chalk.red(`    数据异常行: ${results.specialCases.badRows.length}`) + chalk.gray('  (字段缺失或格式错误)'));
  console.log();
  
  if (results.priceChanges.length > 0) {
    const reduced = results.priceChanges.filter(c => c.changePercent < 0).length;
    const increased = results.priceChanges.filter(c => c.changePercent > 0).length;
    console.log(chalk.white.bold('  价格变动:'));
    console.log(chalk.green(`    价格下降: ${reduced} 项`));
    console.log(chalk.red(`    价格上升: ${increased} 项`));
  }
}

program.parse();
