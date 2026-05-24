#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';
import { collectLicenses } from './collector';
import { loadExceptions } from './exceptions';
import { printTerminalSummary, writeJsonReport, writeMarkdownReport } from './output';
import { ExitCodes, CliOptions } from './types';
import { version } from '../package.json';

const program = new Command();

program
  .name('npm-license')
  .description('NPM 工作区许可证清单生成工具')
  .version(version, '-v, --version', '输出版本号')
  .helpOption('-h, --help', '显示帮助信息');

program
  .option('-c, --cwd <path>', '工作目录路径', process.cwd())
  .option('-o, --output-dir <path>', '输出目录', './license-report')
  .option('--include-workspace', '包含工作区包', true)
  .option('--include-private', '包含私有包', false)
  .option('--exceptions <file>', '例外清单 JSON 文件路径')
  .option('--allowed-licenses <licenses...>', '允许的 SPDX 许可证列表')
  .option('--format <formats...>', '输出格式: terminal,json,markdown', ['terminal', 'json', 'markdown'])
  .option('--verbose', '显示详细日志', false)
  .option('--fail-on-violation', '发现违规时以非零码退出', true);

program.addHelpText('after', `

退出码说明:
  0 - 成功，未发现违规
  1 - 发现许可证违规
  2 - 输入参数错误
  3 - 文件读写错误
  4 - 解析错误

示例:
  $ npm-license
  $ npm-license --cwd ./my-project
  $ npm-license --allowed-licenses MIT Apache-2.0 ISC
  $ npm-license --exceptions ./exceptions.json
  $ npm-license --format json markdown
`);

async function main() {
  try {
    program.parse(process.argv);
    const opts = program.opts();

    const validation = validateOptions(opts);
    if (!validation.valid) {
      console.error(chalk.red(`输入错误: ${validation.message}`));
      process.exit(ExitCodes.INPUT_ERROR);
    }

    const options: CliOptions = {
      cwd: path.resolve(opts.cwd),
      outputDir: path.resolve(opts.outputDir),
      includeWorkspace: opts.includeWorkspace,
      includePrivate: opts.includePrivate,
      exceptionsFile: opts.exceptions ? path.resolve(opts.exceptions) : undefined,
      allowedLicenses: opts.allowedLicenses,
      format: opts.format,
      verbose: opts.verbose,
      failOnViolation: opts.failOnViolation,
    };

    if (options.verbose) {
      console.log(chalk.gray(`工作目录: ${options.cwd}`));
      console.log(chalk.gray(`输出目录: ${options.outputDir}`));
      console.log(chalk.gray(`允许的许可证: ${options.allowedLicenses?.join(', ') || '无'}`));
    }

    if (options.exceptionsFile) {
      loadExceptions(options.exceptionsFile);
    }

    const result = await collectLicenses(options);

    if (options.format.includes('terminal')) {
      printTerminalSummary(result.report);
    }

    if (options.format.includes('json')) {
      const jsonPath = writeJsonReport(result.report, options.outputDir);
      console.log(chalk.green(`✓ JSON 报告已写入: ${jsonPath}`));
    }

    if (options.format.includes('markdown')) {
      const mdPath = writeMarkdownReport(result.report, options.outputDir);
      console.log(chalk.green(`✓ Markdown 报告已写入: ${mdPath}`));
    }

    process.exit(result.exitCode);
  } catch (error: any) {
    console.error(chalk.red(`错误: ${error.message}`));
    if (error.stack && program.opts().verbose) {
      console.error(chalk.gray(error.stack));
    }
    process.exit(ExitCodes.IO_ERROR);
  }
}

function validateOptions(opts: any): { valid: boolean; message?: string } {
  const cwd = path.resolve(opts.cwd);
  if (!fs.existsSync(cwd)) {
    return { valid: false, message: `工作目录不存在: ${cwd}` };
  }

  const pkgJsonPath = path.join(cwd, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) {
    return { valid: false, message: `工作目录中找不到 package.json: ${cwd}` };
  }

  const pkgLockPath = path.join(cwd, 'package-lock.json');
  const yarnLockPath = path.join(cwd, 'yarn.lock');
  if (!fs.existsSync(pkgLockPath) && !fs.existsSync(yarnLockPath)) {
    return { valid: false, message: '找不到 package-lock.json 或 yarn.lock' };
  }

  if (opts.exceptions) {
    const exPath = path.resolve(opts.exceptions);
    if (!fs.existsSync(exPath)) {
      return { valid: false, message: `例外清单文件不存在: ${exPath}` };
    }
    try {
      const content = fs.readFileSync(exPath, 'utf-8');
      JSON.parse(content);
    } catch {
      return { valid: false, message: `例外清单文件格式无效: ${exPath}` };
    }
  }

  const validFormats = ['terminal', 'json', 'markdown'];
  if (opts.format) {
    for (const fmt of opts.format) {
      if (!validFormats.includes(fmt)) {
        return { valid: false, message: `无效的输出格式: ${fmt} (有效值: ${validFormats.join(', ')})` };
      }
    }
  }

  return { valid: true };
}

main().catch((error) => {
  console.error(chalk.red(`致命错误: ${error.message}`));
  process.exit(ExitCodes.IO_ERROR);
});
