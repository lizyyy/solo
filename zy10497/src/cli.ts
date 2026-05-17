import { Command, Option } from 'commander';
import chalk from 'chalk';
import { CliOptions } from './types';
import fs from 'fs';
import path from 'path';

const DEFAULT_INPUT_DIR = './data';
const DEFAULT_OUTPUT_DIR = './reports';
const DEFAULT_REPO_TIMEOUT = 10000;

export class Cli {
  private program: Command;
  private options!: CliOptions;

  constructor() {
    this.program = new Command();
    this.setupProgram();
  }

  private setupProgram(): void {
    this.program
      .name('service-orphan')
      .description('服务目录孤儿检测CLI - 检测下线服务残留的owner和告警配置')
      .version('1.0.0', '-v, --version', '输出版本号')
      .helpOption('-h, --help', '显示帮助信息');

    this.program
      .option('-i, --input-dir <dir>', '服务目录数据输入路径', DEFAULT_INPUT_DIR)
      .option('-o, --output-dir <dir>', '报告输出目录路径', DEFAULT_OUTPUT_DIR)
      .option('-c, --config-file <path>', '配置文件路径 (YAML/JSON)')
      .option('-f, --format <formats...>', '输出格式: json, markdown, csv, all', ['all'])
      .option('--force', '覆盖已存在的输出文件', false)
      .option('--verbose', '显示详细日志', false)
      .option('--skip-repo-check', '跳过仓库可用性检查', false)
      .option('--skip-alert-check', '跳过告警引用检查', false)
      .option('--repo-timeout <ms>', '仓库探测超时时间(毫秒)', String(DEFAULT_REPO_TIMEOUT))
      .option('--github-token <token>', 'GitHub API访问令牌(可选)');

    this.program.addHelpText('after', `

示例:
  $ service-orphan --input-dir ./services --output-dir ./reports
  $ service-orphan -i ./data -o ./out --format json markdown
  $ service-orphan --config-file ./config.yaml --verbose
  $ service-orphan --skip-repo-check --force
`);
  }

  public parse(args: string[]): CliOptions {
    this.program.parse(args);
    const opts = this.program.opts();
    
    this.options = {
      inputDir: path.resolve(opts.inputDir),
      outputDir: path.resolve(opts.outputDir),
      configFile: opts.configFile ? path.resolve(opts.configFile) : undefined,
      format: this.parseFormat(opts.format),
      force: opts.force,
      verbose: opts.verbose,
      skipRepoCheck: opts.skipRepoCheck,
      skipAlertCheck: opts.skipAlertCheck,
      repoTimeout: parseInt(opts.repoTimeout, 10) || DEFAULT_REPO_TIMEOUT,
      githubToken: opts.githubToken
    };

    this.validateOptions();
    return this.options;
  }

  private parseFormat(formats: string[]): CliOptions['format'] {
    if (formats.includes('all')) {
      return ['json', 'markdown', 'csv'];
    }
    
    const validFormats: CliOptions['format'] = [];
    for (const f of formats) {
      if (['json', 'markdown', 'csv'].includes(f)) {
        validFormats.push(f as any);
      } else {
        console.warn(chalk.yellow(`警告: 未知输出格式 '${f}'，已忽略`));
      }
    }
    
    if (validFormats.length === 0) {
      validFormats.push('json');
    }
    
    return validFormats;
  }

  private validateOptions(): void {
    const errors: string[] = [];

    if (!fs.existsSync(this.options.inputDir)) {
      errors.push(`输入目录不存在: ${this.options.inputDir}`);
    } else if (!fs.statSync(this.options.inputDir).isDirectory()) {
      errors.push(`输入路径不是目录: ${this.options.inputDir}`);
    }

    if (this.options.configFile && !fs.existsSync(this.options.configFile)) {
      errors.push(`配置文件不存在: ${this.options.configFile}`);
    }

    if (isNaN(this.options.repoTimeout) || this.options.repoTimeout <= 0) {
      errors.push(`仓库超时时间必须是正整数: ${this.options.repoTimeout}`);
    }

    if (!fs.existsSync(this.options.outputDir)) {
      try {
        fs.mkdirSync(this.options.outputDir, { recursive: true });
        if (this.options.verbose) {
          console.log(chalk.gray(`创建输出目录: ${this.options.outputDir}`));
        }
      } catch (e: any) {
        errors.push(`无法创建输出目录: ${this.options.outputDir} - ${e.message}`);
      }
    }

    if (!this.options.force) {
      const existingFiles = this.checkExistingOutputs();
      if (existingFiles.length > 0) {
        errors.push(`输出目录中已存在报告文件，使用 --force 参数覆盖:\n  ${existingFiles.join('\n  ')}`);
      }
    }

    if (errors.length > 0) {
      console.error(chalk.red('\n参数校验失败:\n'));
      errors.forEach(err => console.error(chalk.red(`  ✗ ${err}`)));
      console.error('\n使用 --help 查看帮助信息\n');
      process.exit(1);
    }

    if (this.options.verbose) {
      this.printOptions();
    }
  }

  private checkExistingOutputs(): string[] {
    const existing: string[] = [];
    const outputFiles = [
      'orphan-report.json',
      'orphan-report.md',
      'orphan-report.csv',
      'errors.log'
    ];

    for (const file of outputFiles) {
      const filePath = path.join(this.options.outputDir, file);
      if (fs.existsSync(filePath)) {
        existing.push(filePath);
      }
    }

    return existing;
  }

  private printOptions(): void {
    console.log(chalk.cyan('\n运行配置:'));
    console.log(chalk.gray('='.repeat(50)));
    console.log(`  输入目录:    ${chalk.green(this.options.inputDir)}`);
    console.log(`  输出目录:    ${chalk.green(this.options.outputDir)}`);
    console.log(`  配置文件:    ${this.options.configFile ? chalk.green(this.options.configFile) : chalk.gray('(默认)')}`);
    console.log(`  输出格式:    ${chalk.green(this.options.format.join(', '))}`);
    console.log(`  仓库检查:    ${this.options.skipRepoCheck ? chalk.yellow('跳过') : chalk.green('启用')}`);
    console.log(`  告警检查:    ${this.options.skipAlertCheck ? chalk.yellow('跳过') : chalk.green('启用')}`);
    console.log(`  仓库超时:    ${chalk.green(this.options.repoTimeout + 'ms')}`);
    console.log(`  覆盖文件:    ${this.options.force ? chalk.green('是') : chalk.gray('否')}`);
    console.log(chalk.gray('='.repeat(50)));
    console.log();
  }

  public getOptions(): CliOptions {
    return this.options;
  }
}
