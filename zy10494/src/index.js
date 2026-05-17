#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs');

const cliConfig = require('../lib/cli-config');
const dataProcessor = require('../lib/data-processor');
const validator = require('../lib/validator');
const reporter = require('../lib/reporter');
const errorHandler = require('../lib/error-handler');

const program = new Command();

async function main() {
  program
    .name('image-promotion')
    .description('镜像晋级清单CLI - 核对签名、扫描和部署记录')
    .version('1.0.0');

  program
    .requiredOption('-i, --input <file>', '输入数据文件路径 (CSV/YAML/JSON)')
    .option('-o, --output-dir <dir>', '输出目录', './outputs')
    .option('-f, --format <format>', '输出格式: all, summary, json, markdown', 'all')
    .option('--from-env <env>', '源环境阶段 (如: dev)', 'dev')
    .option('--to-env <env>', '目标环境阶段 (如: prod)', 'prod')
    .option('--scan-gate <threshold>', '扫描门禁: critical, high, medium, all', 'critical')
    .option('--strict', '严格模式：任何缺项都视为失败')
    .option('--verbose', '显示详细处理过程')
    .action(async (options) => {
      try {
        console.log(chalk.cyan('\n╔══════════════════════════════════════════════════════════════╗'));
        console.log(chalk.cyan('║           镜像晋级清单CLI - Image Promotion Checklist        ║'));
        console.log(chalk.cyan('╚══════════════════════════════════════════════════════════════╝\n'));

        const validationResult = cliConfig.validateOptions(options);
        if (!validationResult.valid) {
          console.error(chalk.red('\n❌ 参数校验失败:'));
          validationResult.errors.forEach(err => console.error(chalk.red(`   • ${err}`)));
          process.exit(1);
        }

        if (options.verbose) {
          console.log(chalk.gray('📋 参数配置:'));
          console.log(chalk.gray(`   输入文件: ${options.input}`));
          console.log(chalk.gray(`   输出目录: ${options.outputDir}`));
          console.log(chalk.gray(`   环境阶段: ${options.fromEnv} → ${options.toEnv}`));
          console.log(chalk.gray(`   扫描门禁: ${options.scanGate}`));
          console.log();
        }

        if (!fs.existsSync(options.outputDir)) {
          fs.mkdirSync(options.outputDir, { recursive: true });
        }

        console.log(chalk.blue('📥 读取输入数据...'));
        const { data, errors: parseErrors, recordsWithSource } = dataProcessor.readInputFile(options.input);

        if (parseErrors.length > 0) {
          console.log(chalk.yellow(`\n⚠️  解析过程中发现 ${parseErrors.length} 个问题:`));
          parseErrors.forEach(err => {
            console.log(chalk.yellow(`   • 行 ${err.line || '?'}: ${err.message}`));
            if (err.source) console.log(chalk.gray(`     源: ${err.source}`));
          });
        }

        if (data.length === 0) {
          console.error(chalk.red('\n❌ 未找到有效镜像数据'));
          process.exit(1);
        }

        console.log(chalk.green(`   成功读取 ${data.length} 条镜像记录\n`));

        console.log(chalk.blue('🔍 验证镜像数据...'));
        const validationResults = validator.validateAllRecords(data, recordsWithSource, options);

        console.log(chalk.blue('📊 生成报告...'));
        const reportResult = reporter.generateReport(validationResults, options);

        const outputPath = path.resolve(options.outputDir);
        console.log(chalk.green(`\n✅ 报告已生成至: ${outputPath}`));

        console.log(chalk.cyan('\n═════════════════════════ 终端摘要 ═════════════════════════'));
        reporter.printTerminalSummary(reportResult);

        if (reportResult.summary.failures > 0) {
          console.log(chalk.red(`\n❌ 晋级检查未通过，共 ${reportResult.summary.failures} 个失败项`));
          process.exit(2);
        } else {
          console.log(chalk.green('\n✅ 晋级检查通过!'));
          process.exit(0);
        }

      } catch (error) {
        errorHandler.handleFatalError(error);
      }
    });

  program.parseAsync(process.argv);
}

main();
