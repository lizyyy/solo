#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const { parseArgs, validateInputs } = require('./args');
const { LogParser } = require('./log-parser');
const { MatrixAnalyzer } = require('./matrix-analyzer');
const { Reporter } = require('./reporter');
const { SelfTest } = require('./self-test');

async function main() {
  program
    .name('matrix-flake')
    .description('GitHub Actions矩阵抖动分析CLI')
    .version('1.0.0');

  program
    .command('analyze')
    .description('分析工作流日志中的矩阵失败情况')
    .option('-l, --logs <dir>', '日志目录路径')
    .option('-o, --output <dir>', '输出目录', './matrix-flake-report')
    .option('--matrix-keys <keys>', '矩阵参数键名(逗号分隔)', 'os,node-version')
    .option('--rerun-threshold <num>', '重跑次数阈值', 1)
    .option('--format <formats>', '输出格式(逗号分隔)', 'terminal,html,csv,json')
    .option('--verbose', '显示详细日志')
    .action(async (options) => {
      try {
        const args = parseArgs(options);
        validateInputs(args);
        
        const parser = new LogParser(args);
        const parsedLogs = await parser.parseDirectory();
        
        const analyzer = new MatrixAnalyzer(args);
        const analysis = analyzer.analyze(parsedLogs);
        
        const reporter = new Reporter(args);
        await reporter.generateAll(analysis);
        
        console.log(chalk.green('\n✓ 分析完成!'));
      } catch (error) {
        console.error(chalk.red('\n✗ 错误:'), error.message);
        if (options.verbose) {
          console.error(chalk.gray(error.stack));
        }
        process.exit(1);
      }
    });

  program
    .command('self-test')
    .description('运行自检，验证解析、边界样本和导出功能')
    .option('-o, --output <dir>', '输出目录', './self-test-results')
    .action(async (options) => {
      try {
        const selfTest = new SelfTest(options.output);
        await selfTest.run();
      } catch (error) {
        console.error(chalk.red('\n✗ 自检失败:'), error.message);
        process.exit(1);
      }
    });

  program.parse();
}

main().catch(error => {
  console.error(chalk.red('致命错误:'), error);
  process.exit(1);
});
