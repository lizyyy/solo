#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs');
const { version } = require('../package.json');

const { validateInput, validateSilenceData } = require('./validators');
const { parseSilences, loadAlerts } = require('./parser');
const { auditSilences } = require('./auditor');
const { generateOutputs } = require('./reporter');
const { handleErrors, cleanupOutputDir } = require('./utils');

const program = new Command();

program
  .name('silence-audit')
  .description('Prometheus告警静默规则审计CLI工具')
  .version(version, '-v, --version', '显示版本号')
  .option('-i, --input <path>', '静默规则导出文件路径 (JSON格式)', './data/silences.json')
  .option('-a, --alerts <path>', '历史告警数据文件路径 (可选)', null)
  .option('-o, --output <dir>', '输出目录', './audit-output')
  .option('-f, --force', '强制覆盖已存在的输出目录', false)
  .option('-s, --strict', '严格模式：遇到任何错误立即退出', false)
  .option('--no-color', '禁用彩色输出')
  .option('--risk-threshold <days>', '高风险阈值：过期前N天标记为高风险', 7)
  .option('--match-threshold <percent>', '标签匹配率阈值 (0-100)', 80)
  .addHelpText('after', `

示例:
  $ silence-audit -i ./silences.json -o ./report
  $ silence-audit --input ./silences.json --alerts ./alerts.json --risk-threshold 3
  $ silence-audit -i silences.json -f --strict

输出文件:
  summary.txt       终端摘要（同时打印到控制台）
  results.json      机器可读的完整审计结果
  report.html       可分享的HTML审计报告
  errors.json       无法处理的记录及位置追溯
  `);

program.parse(process.argv);

const options = program.opts();

async function main() {
  console.log(chalk.bold.blue('\n╔══════════════════════════════════════════╗'));
  console.log(chalk.bold.blue('║     Prometheus 告警静默审计 CLI          ║'));
  console.log(chalk.bold.blue('╚══════════════════════════════════════════╝\n'));

  try {
    validateInput(options);

    const outputDir = path.resolve(options.output);
    await cleanupOutputDir(outputDir, options.force);

    console.log(chalk.gray(`输入文件: ${path.resolve(options.input)}`));
    console.log(chalk.gray(`输出目录: ${outputDir}`));
    console.log(chalk.gray(`风险阈值: ${options.riskThreshold} 天`));
    console.log(chalk.gray(`匹配阈值: ${options.matchThreshold}%\n`));

    console.log(chalk.yellow('→ 解析静默规则数据...'));
    const { silences, errors: parseErrors } = await parseSilences(
      path.resolve(options.input)
    );

    if (parseErrors.length > 0) {
      console.log(chalk.yellow(`  ⚠ 发现 ${parseErrors.length} 条解析错误`));
    }

    console.log(chalk.yellow('→ 验证静默规则格式...'));
    const { validSilences, validationErrors } = validateSilenceData(silences);
    console.log(chalk.green(`  ✓ 有效规则: ${validSilences.length} 条`));

    if (validationErrors.length > 0) {
      console.log(chalk.yellow(`  ⚠ 验证失败: ${validationErrors.length} 条`));
    }

    let alerts = [];
    if (options.alerts) {
      console.log(chalk.yellow('→ 加载历史告警数据...'));
      alerts = await loadAlerts(path.resolve(options.alerts));
      console.log(chalk.green(`  ✓ 加载告警: ${alerts.length} 条`));
    }

    console.log(chalk.yellow('\n→ 执行审计分析...'));
    const auditResult = auditSilences(validSilences, alerts, {
      riskThresholdDays: parseInt(options.riskThreshold),
      matchThreshold: parseInt(options.matchThreshold),
    });

    const allErrors = [...parseErrors, ...validationErrors, ...auditResult.errors];

    console.log(chalk.yellow('\n→ 生成输出文件...'));
    await generateOutputs(auditResult, allErrors, outputDir);

    console.log(chalk.green.bold('\n✓ 审计完成!\n'));

    if (options.strict && allErrors.length > 0) {
      console.log(chalk.red(`严格模式下检测到 ${allErrors.length} 个错误，退出码: 1`));
      process.exit(1);
    }

  } catch (error) {
    handleErrors(error, options.strict);
    process.exit(1);
  }
}

main();
