#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';
import { runCheck } from './core';
import { generateReports } from './reporter';
import { CliOptions } from './types';

function validateOptions(options: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!options.packageDir) {
    errors.push('必须指定 package 目录 (--package-dir 或 -d)');
  } else {
    const packageDir = path.resolve(options.packageDir);
    if (!fs.existsSync(packageDir)) {
      errors.push(`package 目录不存在: ${packageDir}`);
    } else {
      const pkgPath = path.join(packageDir, 'package.json');
      if (!fs.existsSync(pkgPath)) {
        errors.push(`package.json 不存在于目录: ${packageDir}`);
      }
    }
  }

  if (!options.outputDir) {
    errors.push('必须指定输出目录 (--output-dir 或 -o)');
  }

  if (options.format) {
    const validFormats = ['json', 'markdown', 'terminal', 'all'];
    const formats = Array.isArray(options.format) ? options.format : [options.format];
    for (const fmt of formats) {
      if (!validFormats.includes(fmt)) {
        errors.push(`无效的格式 "${fmt}"，有效值为: ${validFormats.join(', ')}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .scriptName('exports-check')
    .usage('$0 [options]')
    .example('$0 -d ./my-package -o ./reports -f all', '检查 my-package 并输出所有格式报告到 reports 目录')
    .example('$0 --package-dir . --output-dir . --strict', '严格模式检查当前目录')
    .option('package-dir', {
      alias: 'd',
      type: 'string',
      description: '要检查的 package 目录路径',
      demandOption: false,
    })
    .option('output-dir', {
      alias: 'o',
      type: 'string',
      description: '报告输出目录',
      default: './exports-reports',
    })
    .option('format', {
      alias: 'f',
      type: 'array',
      string: true,
      description: '输出格式: json, markdown, terminal, all',
      default: ['terminal', 'markdown', 'json'],
    })
    .option('verbose', {
      alias: 'v',
      type: 'boolean',
      description: '显示详细信息',
      default: false,
    })
    .option('strict', {
      alias: 's',
      type: 'boolean',
      description: '严格模式：警告也会导致非零退出码',
      default: false,
    })
    .option('include-imports', {
      alias: 'i',
      type: 'boolean',
      description: '包含导入样例生成',
      default: true,
    })
    .help('help')
    .alias('help', 'h')
    .version()
    .alias('version', 'V')
    .epilog('Package Exports 体检CLI - 检查 Node.js 包 exports 字段配置')
    .argv;

  const validation = validateOptions(argv);
  if (!validation.valid) {
    console.error('\n');
    console.error(chalk.bold.red('❌ 参数错误:'));
    validation.errors.forEach((err, i) => {
      console.error(`   ${i + 1}. ${chalk.red(err)}`);
    });
    console.error('\n');
    console.error(chalk.yellow('使用 --help 查看帮助信息'));
    console.error('');
    process.exit(1);
  }

  const options: CliOptions = {
    packageDir: argv.packageDir as string,
    outputDir: argv.outputDir as string,
    format: argv.format as any,
    verbose: argv.verbose as boolean,
    strict: argv.strict as boolean,
    includeImports: argv.includeImports as boolean,
  };

  try {
    console.log(chalk.bold.blue('🔍 正在检查 package exports...'));
    console.log(chalk.gray(`   目录: ${path.resolve(options.packageDir)}`));

    const result = runCheck(options.packageDir, {
      includeImports: options.includeImports,
    });

    const outputs = generateReports(result, options);

    console.log(chalk.bold.green('\n📄 报告已生成:'));
    if (outputs.json) {
      console.log(`   - JSON: ${chalk.cyan(outputs.json)}`);
    }
    if (outputs.markdown) {
      console.log(`   - Markdown: ${chalk.cyan(outputs.markdown)}`);
    }

    const hasErrors = result.errors.length > 0;
    const hasWarnings = result.warnings.length > 0;

    if (hasErrors || (options.strict && hasWarnings)) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (error: any) {
    console.error('\n');
    console.error(chalk.bold.red('❌ 执行错误:'));
    console.error(`   ${chalk.red(error.message)}`);
    if (options.verbose && error.stack) {
      console.error('\n');
      console.error(chalk.gray('   堆栈跟踪:'));
      console.error(chalk.gray(error.stack.split('\n').map((l: string) => '   ' + l).join('\n')));
    }
    console.error('');
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(chalk.bold.red('未捕获的异常:'), err);
  process.exit(3);
});
