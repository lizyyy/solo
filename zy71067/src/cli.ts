#!/usr/bin/env node

import { Command, Option } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { CLIOptions, CheckConfig } from './types';
import { runChecks, loadConfigFile } from './checker';
import { generateReports, getExitCode } from './reportGenerator';

const program = new Command();

program
  .name('i18n-length')
  .description('多语言长度溢出检测 CLI 工具')
  .version('1.0.0');

program
  .argument('[files...]', 'i18n 文件路径（JSON/YAML）')
  .option('-i, --input <files...>', '输入文件，逗号分隔')
  .option('-o, --output <dir>', '输出目录', './reports')
  .option('-c, --config <path>', '配置文件路径')
  .option('-l, --locale <code>', '目标语言代码')
  .option('-p, --position <name>', '界面位置名称')
  .option('-w, --max-width <number>', '最大宽度单位', (v) => parseInt(v, 10))
  .option('--max-chars <number>', '最大字符数', (v) => parseInt(v, 10))
  .option('--placeholders <list>', '预期占位符，逗号分隔')
  .option('-f, --format <formats...>', '输出格式: console,json,md', ['console', 'json', 'md'])
  .option('--overwrite', '覆盖已存在的报告文件')
  .option('--append', '追加到已存在的报告文件')
  .option('-v, --verbose', '显示详细信息')
  .option('-q, --quiet', '静默模式，仅输出错误')
  .addHelpText('after', `
退出码说明:
  0 - 无问题
  1 - 存在警告
  2 - 存在严重问题
  3 - 命令行参数错误
  4 - 文件读取错误

示例:
  # 使用配置文件
  i18n-length -c ./checks.json ./locales/*.json

  # 命令行直接指定
  i18n-length ./locales/en.json -l en -p "登录按钮" -w 20

  # 多格式输出
  i18n-length ./locales/*.json -f json md
  `);

async function main() {
  program.parse(process.argv);
  const opts = program.opts() as CLIOptions;
  const args = program.args;

  const inputFiles = [
    ...args,
    ...(opts.input || []),
  ].map(f => f.split(',')).flat().filter(Boolean);

  if (inputFiles.length === 0) {
    console.error('错误: 请指定输入文件');
    program.help();
    process.exit(3);
  }

  const resolvedFiles = resolveInputFiles(inputFiles);
  if (resolvedFiles.length === 0) {
    console.error('错误: 未找到有效的输入文件');
    process.exit(4);
  }

  let checkConfigs: CheckConfig[] = [];
  let outputDir = opts.output;
  let formats = opts.format;

  if (opts.config) {
    try {
      const config = loadConfigFile(opts.config);
      checkConfigs = config.checks;
      if (config.outputDir) outputDir = config.outputDir;
      if (config.formats?.length) formats = config.formats;
    } catch (error) {
      console.error(`错误: 无法加载配置文件 - ${(error as Error).message}`);
      process.exit(4);
    }
  }

  if (checkConfigs.length === 0) {
    if (!opts.locale || !opts.position || !opts.maxWidth) {
      console.error('错误: 未使用配置文件时，必须指定 --locale, --position, --max-width');
      process.exit(3);
    }

    checkConfigs = [{
      locale: opts.locale,
      interfacePosition: opts.position,
      maxWidth: opts.maxWidth,
      maxChars: opts.maxChars,
      placeholders: opts.placeholders?.split(',').map(p => p.trim()).filter(Boolean),
    }];
  }

  const validationErrors = validateCheckConfigs(checkConfigs);
  if (validationErrors.length > 0) {
    console.error('配置错误:');
    for (const error of validationErrors) {
      console.error(`  - ${error}`);
    }
    process.exit(3);
  }

  if (opts.overwrite && opts.append) {
    console.error('错误: --overwrite 和 --append 不能同时使用');
    process.exit(3);
  }

  const resolvedOutputDir = path.resolve(outputDir);

  if (!opts.quiet) {
    console.log(`检测 ${resolvedFiles.length} 个文件...`);
    console.log(`输出目录: ${resolvedOutputDir}`);
    console.log(`输出格式: ${formats.join(', ')}`);
    console.log('');
  }

  try {
    const results = runChecks(resolvedFiles, checkConfigs, {
      verbose: opts.verbose,
    });

    const { summary, files } = generateReports(results, {
      outputDir: resolvedOutputDir,
      formats,
      overwrite: opts.overwrite,
      append: opts.append,
      inputFiles: resolvedFiles,
      checkConfigs,
    });

    if (!opts.quiet && files.length > 0) {
      console.log('');
      console.log('生成的报告文件:');
      for (const file of files) {
        console.log(`  - ${file}`);
      }
    }

    process.exit(getExitCode(summary));
  } catch (error) {
    console.error(`执行错误: ${(error as Error).message}`);
    if (opts.verbose) {
      console.error((error as Error).stack);
    }
    process.exit(4);
  }
}

function resolveInputFiles(files: string[]): string[] {
  const resolved: string[] = [];
  const glob = require('glob');

  for (const file of files) {
    if (file.includes('*') || file.includes('?')) {
      const matches = glob.sync(file, { nodir: true });
      resolved.push(...matches);
    } else {
      const absolutePath = path.resolve(file);
      if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
        resolved.push(absolutePath);
      } else if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isDirectory()) {
        const dirFiles = fs.readdirSync(absolutePath)
          .filter(f => /\.(json|yaml|yml)$/i.test(f))
          .map(f => path.join(absolutePath, f));
        resolved.push(...dirFiles);
      }
    }
  }

  return [...new Set(resolved)];
}

function validateCheckConfigs(configs: CheckConfig[]): string[] {
  const errors: string[] = [];

  for (let i = 0; i < configs.length; i++) {
    const config = configs[i];
    const prefix = configs.length > 1 ? `配置[${i}]: ` : '';

    if (!config.locale) {
      errors.push(`${prefix}缺少 locale`);
    }

    if (!config.interfacePosition) {
      errors.push(`${prefix}缺少 interfacePosition`);
    }

    if (config.maxWidth === undefined || config.maxWidth === null) {
      errors.push(`${prefix}缺少 maxWidth`);
    } else if (config.maxWidth <= 0) {
      errors.push(`${prefix}maxWidth 必须大于 0`);
    }

    if (config.maxChars !== undefined && config.maxChars <= 0) {
      errors.push(`${prefix}maxChars 必须大于 0`);
    }
  }

  return errors;
}

main().catch((error) => {
  console.error('未处理的错误:', error);
  process.exit(4);
});
