const { Command } = require('commander');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs');

const { validateInputs } = require('./cli/validator');
const { FileParser } = require('./core/file-parser');
const { ReferenceScanner } = require('./core/reference-scanner');
const { RiskAssessor } = require('./core/risk-assessor');
const { ReportGenerator } = require('./report/generator');
const { OutputManager } = require('./core/output-manager');
const { printSummary } = require('./cli/terminal-summary');

const program = new Command();

program
  .name('ff-clean')
  .description('Feature Flag 清理CLI工具 - 安全排查和清理下线后的开关代码')
  .version('1.0.0', '-v, --version', '显示版本号')
  .option('--flags <path>', '开关清单CSV文件路径 (必需)', '')
  .option('--code <path>', '代码目录路径 (必需)', '')
  .option('--output <path>', '输出目录路径', './ff-clean-results')
  .option('--default-value <string>', '默认开关值 (true/false)', 'false')
  .option('--extensions <list>', '扫描的文件扩展名 (逗号分隔)', 'js,ts,jsx,tsx,vue')
  .option('--exclude <pattern>', '排除目录模式 (逗号分隔)', 'node_modules,.git,dist,build')
  .option('--force', '覆盖已有输出目录', false)
  .option('--json-only', '只输出JSON结果，禁用终端格式', false)
  .action(async (options) => {
    try {
      console.log(chalk.bold('\n🚀 Feature Flag 清理工具启动\n'));

      const validation = validateInputs(options);
      if (!validation.valid) {
        console.error(chalk.red('\n❌ 参数校验失败:'));
        validation.errors.forEach(err => console.error(chalk.red(`   • ${err}`)));
        console.error('');
        process.exit(1);
      }

      const outputManager = new OutputManager(options.output, options.force);
      outputManager.prepareOutputDir();

      const fileParser = new FileParser(options.flags);
      const { flags, invalidRecords, parseErrors } = await fileParser.parse();

      if (parseErrors.length > 0 && !options.jsonOnly) {
        console.log(chalk.yellow(`⚠️  文件解析发现 ${parseErrors.length} 个格式问题\n`));
      }

      if (invalidRecords.length > 0) {
        outputManager.writeInvalidRecords(invalidRecords);
        if (!options.jsonOnly) {
          console.log(chalk.yellow(`📍 无法处理的记录已保存到: invalid-records.json\n`));
        }
      }

      if (flags.length === 0) {
        console.error(chalk.red('\n❌ 没有有效的开关数据可以处理'));
        process.exit(1);
      }

      if (!options.jsonOnly) {
        console.log(chalk.green(`✅ 成功解析 ${flags.length} 个开关配置\n`));
      }

      const extensions = options.extensions.split(',').map(e => e.trim());
      const excludePatterns = options.exclude.split(',').map(e => e.trim());

      const scanner = new ReferenceScanner(options.code, { extensions, excludePatterns });
      const { references, scanStats } = await scanner.scan(flags);

      if (!options.jsonOnly) {
        console.log(chalk.green(`✅ 代码扫描完成: 扫描了 ${scanStats.filesScanned} 个文件\n`));
      }

      const riskAssessor = new RiskAssessor(options.defaultValue === 'true');
      const { results, riskSummary } = riskAssessor.assess(flags, references);

      outputManager.writeMachineReadable({
        meta: {
          generatedAt: new Date().toISOString(),
          inputOptions: options,
          scanStats,
          totalFlags: flags.length,
          totalReferences: references.length
        },
        flags: results,
        riskSummary
      });

      const reportGenerator = new ReportGenerator(outputManager.outputDir);
      const reportPath = reportGenerator.generate({
        flags: results,
        references,
        riskSummary,
        scanStats,
        parseErrors,
        invalidRecords
      });

      if (!options.jsonOnly) {
        printSummary({
          results,
          riskSummary,
          scanStats,
          parseErrors,
          invalidRecords,
          outputDir: outputManager.outputDir
        });
      } else {
        console.log(JSON.stringify({
          success: true,
          outputDir: outputManager.outputDir,
          reportPath,
          summary: {
            totalFlags: results.length,
            safeToDelete: results.filter(r => r.riskLevel === 'safe').length,
            caution: results.filter(r => r.riskLevel === 'caution').length,
            highRisk: results.filter(r => r.riskLevel === 'high').length,
            unknown: results.filter(r => r.riskLevel === 'unknown').length
          }
        }, null, 2));
      }

      console.log(chalk.bold.green('\n✨ 任务完成!\n'));

    } catch (error) {
      console.error(chalk.red('\n💥 执行失败:'));
      console.error(chalk.red(`   ${error.message}\n`));
      if (process.env.DEBUG) {
        console.error(chalk.gray(error.stack));
      }
      process.exit(1);
    }
  });

program.parse(process.argv);
