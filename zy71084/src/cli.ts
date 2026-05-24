#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import { ProvisionParser } from './provisionParser';
import { CertificateValidator } from './certificateValidator';
import { ConfigParser } from './configParser';
import { CheckEngine } from './checkEngine';
import { ReportGenerator } from './reportGenerator';
import { CheckOptions, OutputFormats, TargetConfig } from './types';

const program = new Command();

program
  .name('cert-check')
  .description('Xcode 证书体检 CLI - 检查 profile、证书、bundle id 的一致性')
  .version('1.0.0');

program
  .command('check')
  .description('执行证书体检')
  .option('-p, --profile <paths...>', 'MobileProvision 文件或目录路径（多个用空格分隔）')
  .option('-c, --certificate <paths...>', '证书文件或目录路径（多个用空格分隔）')
  .option('-t, --target <bundleIds...>', 'Target Bundle ID 列表（多个用空格分隔）')
  .option('-f, --config <path>', 'Target 配置文件（YAML/JSON）')
  .option('-o, --output <dir>', '报告输出目录', './cert-check-reports')
  .option('-w, --warn-days <days>', '过期提醒天数', '30')
  .option('--strict', '严格模式：警告也返回非零退出码')
  .option('--no-terminal', '不输出终端报告')
  .option('--no-json', '不生成 JSON 报告')
  .option('--no-markdown', '不生成 Markdown 报告')
  .option('--cert-password <password>', 'P12 证书密码')
  .action(async (options) => {
    try {
      await runCheck(options);
    } catch (error: any) {
      console.error(chalk.red.bold('\n❌ 执行失败:'));
      console.error(chalk.red(`   ${error.message}`));
      process.exit(3);
    }
  });

program
  .command('parse-profile <path>')
  .description('解析并显示 MobileProvision 文件信息')
  .action((path) => {
    try {
      const profile = ProvisionParser.parse(path);
      console.log(JSON.stringify(profile, null, 2));
    } catch (error: any) {
      console.error(chalk.red(`解析失败: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('parse-cert <path>')
  .description('解析并显示证书文件信息')
  .option('-p, --password <password>', 'P12 证书密码')
  .action((path, options) => {
    try {
      const cert = CertificateValidator.parseFromFile(path, options.password);
      console.log(JSON.stringify(cert, null, 2));
    } catch (error: any) {
      console.error(chalk.red(`解析失败: ${error.message}`));
      process.exit(1);
    }
  });

async function runCheck(options: any) {
  console.log(chalk.cyan.bold('\n🔍 开始 Xcode 证书体检...\n'));

  if (!options.profile && !options.certificate && !options.target && !options.config) {
    console.error(chalk.red('错误: 请至少指定 --profile、--certificate、--target 或 --config 中的一项'));
    program.outputHelp();
    process.exit(1);
  }

  let targets: TargetConfig[] = [];

  if (options.config) {
    validateFileExists(options.config, '配置文件');
    targets = ConfigParser.parseTargetsFromFile(options.config);
    console.log(chalk.gray(`从配置文件加载了 ${targets.length} 个 Target`));
  }

  if (options.target) {
    const cliTargets = options.target.map((bundleId: string) => 
      ConfigParser.parseSimpleTarget(bundleId)
    );
    targets = [...targets, ...cliTargets];
  }

  let profiles: any[] = [];
  if (options.profile) {
    validatePathsExist(options.profile, 'Profile');
    console.log(chalk.gray(`正在解析 Profile 文件...`));
    profiles = ProvisionParser.parseFiles(options.profile);
    console.log(chalk.gray(`共解析 ${profiles.length} 个 Profile`));
  }

  let certificates: any[] = [];
  if (options.certificate) {
    validatePathsExist(options.certificate, '证书');
    console.log(chalk.gray(`正在解析证书文件...`));
    certificates = CertificateValidator.parseFiles(options.certificate, options.certPassword);
    console.log(chalk.gray(`共解析 ${certificates.length} 个证书`));
  }

  const warnDays = parseInt(options.warnDays, 10);
  if (isNaN(warnDays) || warnDays < 0) {
    console.error(chalk.red('错误: --warn-days 必须是一个非负整数'));
    process.exit(1);
  }

  const checkOptions: CheckOptions = {
    profiles: options.profile || [],
    certificates: options.certificate || [],
    targets,
    outputDir: options.output,
    warnDaysBeforeExpiration: warnDays,
    strictMode: options.strict || false
  };

  console.log(chalk.gray(`\n正在执行检查...\n`));
  
  const report = CheckEngine.runFullCheck(
    profiles,
    certificates,
    targets,
    checkOptions
  );

  const outputFormats: OutputFormats = {
    terminal: options.terminal !== false,
    json: options.json !== false,
    markdown: options.markdown !== false
  };

  ReportGenerator.generateReport(report, options.output, outputFormats);

  process.exit(report.exitCode);
}

function validateFileExists(path: string, description: string): void {
  if (!fs.existsSync(path)) {
    throw new Error(`${description}不存在: ${path}`);
  }
  if (!fs.statSync(path).isFile()) {
    throw new Error(`${description}不是文件: ${path}`);
  }
}

function validatePathsExist(paths: string[], description: string): void {
  paths.forEach(path => {
    if (!fs.existsSync(path)) {
      throw new Error(`${description}路径不存在: ${path}`);
    }
  });
}

program.parseAsync(process.argv).catch((error) => {
  console.error(chalk.red.bold('\n❌ 错误:'));
  console.error(chalk.red(`   ${error.message}`));
  process.exit(1);
});
