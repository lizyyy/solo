#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const CanteenReviewSorter = require('./index');

const program = new Command();

program
  .name('canteen-sort')
  .description('社区食堂外卖评价分拣 CLI 工具')
  .version('1.0.0')
  .option('-i, --input <dir>', '输入目录，默认 ./input', './input')
  .option('-o, --output <dir>', '输出目录，默认 ./output', './output')
  .option('-r, --rules <file>', '规则文件路径，默认 ./rules.json', './rules.json')
  .option('-p, --preview', '预览模式，不写入文件')
  .option('--report', '查看最新报告');

program.parse(process.argv);

const options = program.opts();

async function main() {
  const sorter = new CanteenReviewSorter({
    inputDir: options.input,
    outputDir: options.output,
    rulesFile: options.rules,
    preview: options.preview
  });

  if (options.report) {
    const report = await sorter.getLatestReport();
    if (report) {
      console.log('\n' + chalk.green('========== 最新分拣报告 ==========\n'));
      console.log(chalk.cyan('处理时间: ') + report.processedAt);
      console.log(chalk.cyan('总记录数: ') + report.totalRows);
      console.log(chalk.cyan('有效记录: ') + chalk.green(report.validRows));
      console.log(chalk.cyan('重复订单: ') + chalk.yellow(report.duplicateCount) + ' 条');
      console.log(chalk.cyan('空评分记录: ') + chalk.yellow(report.emptyRatingCount) + ' 条');
      console.log('\n' + chalk.cyan('---------- 分类统计 ----------\n'));
      for (const [name, count] of Object.entries(report.categories)) {
        console.log(`${chalk.magenta(name)}: ${count} 条`);
      }
      console.log('\n' + chalk.green('===================================\n'));
    } else {
      console.log(chalk.yellow('暂无报告，请先执行分拣'));
    }
    return;
  }

  try {
    if (options.preview) {
      console.log(chalk.blue('\n正在预览分拣结果...\n'));
      const results = await sorter.process();
      sorter.printPreview(results);
      console.log(chalk.green('预览完成，如需正式执行请去掉 --preview 参数\n'));
    } else {
      console.log(chalk.blue('\n正在执行社区食堂外卖评价分拣...\n'));
      const results = await sorter.process();
      sorter.printPreview(results);
      console.log(chalk.green(`分拣完成！结果已写入目录: ${sorter.currentRunDir}\n`));
      console.log(chalk.cyan('运行 ' + chalk.bold('npm run report') + ' 查看详细报告\n'));
    }
  } catch (error) {
    console.error(chalk.red('错误: ' + error.message));
    process.exit(1);
  }
}

main();
