#!/usr/bin/env node

const { Command } = require('commander');
const AuditEngine = require('./audit-engine');
const ReportGenerator = require('./report-generator');
const packageJson = require('../package.json');

const program = new Command();

program
  .name('tz-audit')
  .description('时区数据巡检CLI - 跨国业务报表时区问题检测工具')
  .version(packageJson.version);

program
  .argument('<input-path>', '输入文件或目录路径')
  .option('-t, --time-field <field>', '时间字段名', 'timestamp')
  .option('-z, --timezone-field <field>', '时区字段名')
  .option('-d, --default-timezone <timezone>', '默认源时区', 'UTC')
  .option('-o, --output-dir <dir>', '输出目录', process.cwd())
  .option('-b, --base-name <name>', '输出文件基础名', 'timezone-audit')
  .option('--target-timezone <timezone>', '目标时区', 'UTC')
  .option('--fail-fast', '遇到第一个错误时停止')
  .option('--no-terminal', '不输出终端摘要')
  .option('--no-json', '不生成JSON报告')
  .option('--no-html', '不生成HTML报告')
  .option('--no-errors-csv', '不生成错误CSV')
  .action(async (inputPath, options) => {
    try {
      const engine = new AuditEngine({
        targetTimezone: options.targetTimezone,
        timeField: options.timeField,
        timezoneField: options.timezoneField,
        defaultSourceTimezone: options.defaultTimezone,
        failFast: options.failFast
      });

      const results = await engine.audit(inputPath);

      const generator = new ReportGenerator({
        outputDir: options.outputDir
      });

      const outputs = {};

      if (options.terminal) {
        outputs.terminal = generator.generateTerminalSummary(results);
        console.log(outputs.terminal);
      }

      if (options.json) {
        outputs.jsonPath = require('path').join(options.outputDir, `${options.baseName}.json`);
        generator.generateMachineReadable(results, outputs.jsonPath);
        console.log(`机器可读报告已生成: ${outputs.jsonPath}`);
      }

      if (options.html) {
        outputs.htmlPath = require('path').join(options.outputDir, `${options.baseName}.html`);
        generator.generateHtmlReport(results, outputs.htmlPath);
        console.log(`HTML报告已生成: ${outputs.htmlPath}`);
      }

      if (options.errorsCsv && results.summary.errorRows > 0) {
        outputs.errorsCsvPath = require('path').join(options.outputDir, `${options.baseName}-errors.csv`);
        generator.generateErrorReport(results, outputs.errorsCsvPath);
        console.log(`错误行报告已生成: ${outputs.errorsCsvPath}`);
      }

      process.exit(results.exitCode || 0);
    } catch (error) {
      console.error('执行出错:', error.message);
      console.error(error.stack);
      process.exit(1);
    }
  });

program.parse();