#!/usr/bin/env node

import { parseCLIArguments, validateOptions, ensureOutputDirectory, checkExistingFiles } from './cli';
import { runInspection } from './inspector';
import { exportResults } from './exporter';
import { EXIT_CODES } from './types';
import chalk from 'chalk';

async function main(): Promise<number> {
  try {
    const options = parseCLIArguments();
    
    if (options.verbose) {
      console.log(chalk.gray('解析命令行参数完成'));
    }

    const validationErrors = validateOptions(options);
    const errors = validationErrors.filter(e => e.severity === 'error');
    const warnings = validationErrors.filter(e => e.severity === 'warning');

    if (warnings.length > 0) {
      for (const warning of warnings) {
        console.log(chalk.yellow(`⚠️  警告: ${warning.message}`));
      }
    }

    if (errors.length > 0) {
      console.log(chalk.red.bold('❌ 参数验证失败:'));
      for (const error of errors) {
        console.log(chalk.red(`  - ${error.field}: ${error.message}`));
      }
      return EXIT_CODES.VALIDATION_ERROR;
    }

    if (options.verbose) {
      console.log(chalk.gray('参数验证通过'));
    }

    ensureOutputDirectory(options.output);
    
    const existing = checkExistingFiles(options.output, options.format);
    if (existing.exists && !options.overwrite && !options.append) {
      console.log(chalk.yellow('⚠️  检测到已存在的输出文件:'));
      for (const file of existing.files) {
        console.log(chalk.yellow(`  - ${file}`));
      }
      console.log(chalk.yellow('使用 --overwrite 覆盖，或 --append 追加'));
      return EXIT_CODES.VALIDATION_ERROR;
    }

    if (options.verbose) {
      console.log(chalk.gray(`输出目录: ${options.output}`));
      console.log(chalk.gray('开始执行巡检...'));
    }

    const result = runInspection(options);

    if (options.verbose) {
      console.log(chalk.gray('巡检完成，开始导出结果...'));
    }

    exportResults(result, options);

    if (result.summary.criticalRiskClients > 0) {
      return EXIT_CODES.CRITICAL_RISK_FOUND;
    }

    return EXIT_CODES.SUCCESS;

  } catch (error) {
    console.error(chalk.red.bold('❌ 执行过程中发生错误:'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    
    if (process.env.DEBUG) {
      console.error(chalk.gray(error instanceof Error ? error.stack : ''));
    }
    
    return EXIT_CODES.PROCESSING_ERROR;
  }
}

main().then(exitCode => {
  process.exit(exitCode);
}).catch(() => {
  process.exit(EXIT_CODES.PROCESSING_ERROR);
});
