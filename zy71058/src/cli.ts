#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { ScanOptions } from './types';
import { loadRules, loadExceptions, validateOptions, ensureOutputDir } from './utils/config-loader';
import { ScanEngine } from './core/scan-engine';
import { printTerminalSummary, getExitCode } from './reporters/terminal-reporter';
import { writeJsonReport, writeLatestJsonReport } from './reporters/json-reporter';
import { writeMarkdownReport, writeLatestMarkdownReport } from './reporters/markdown-reporter';
import { runSelfTests } from './core/self-test';

const program = new Command();

program
  .name('hss')
  .description('Helm Values 泄密扫描 CLI - 检查 Helm chart 中的敏感信息')
  .version('1.0.0');

program
  .command('scan')
  .description('扫描 values 文件中的敏感信息')
  .requiredOption('-f, --values <path>', 'values.yaml 文件路径')
  .option('-t, --templates <path>', 'Helm 模板目录路径（可选，用于渲染后扫描）')
  .option('-r, --rules <path>', '自定义敏感规则文件路径（YAML 格式）')
  .option('-e, --exceptions <path>', '例外配置文件路径（YAML 格式）')
  .option('-E, --environment <name>', '环境名称 (如: prod, staging, test)', 'prod')
  .option('-o, --output <dir>', '报告输出目录', './hss-reports')
  .option('--fail-on <severities>', '指定失败的严重级别，逗号分隔 (critical,high,medium,low)', 'critical,high')
  .option('-v, --verbose', '显示详细信息')
  .option('--no-color', '禁用彩色输出')
  .action(async (options) => {
    if (options.noColor) {
      chalk.level = 0;
    }

    const scanOptions: ScanOptions = {
      valuesPath: options.values,
      templateDir: options.templates,
      rulesPath: options.rules,
      environment: options.environment,
      exceptionsPath: options.exceptions,
      outputDir: options.output,
      failOnSeverity: options.failOn.split(','),
      verbose: options.verbose || false
    };

    const validationErrors = validateOptions(scanOptions);
    if (validationErrors.length > 0) {
      console.error(chalk.red('参数验证错误:'));
      for (const err of validationErrors) {
        console.error(chalk.red(`  ${err.field}: ${err.message}`));
      }
      process.exit(2);
    }

    try {
      const rules = loadRules(scanOptions.rulesPath);
      const exceptions = loadExceptions(scanOptions.exceptionsPath);
      
      ensureOutputDir(scanOptions.outputDir);

      const engine = new ScanEngine({
        options: scanOptions,
        rules,
        exceptions
      });

      console.log(chalk.cyan('🔍 开始扫描...'));
      console.log(chalk.gray(`   Values 文件: ${scanOptions.valuesPath}`));
      if (scanOptions.templateDir) {
        console.log(chalk.gray(`   模板目录: ${scanOptions.templateDir}`));
      }
      console.log(chalk.gray(`   环境: ${scanOptions.environment}`));
      console.log(chalk.gray(`   规则数: ${rules.length}`));
      console.log(chalk.gray(`   例外数: ${exceptions.length}`));
      console.log('');

      const result = await engine.scan();

      printTerminalSummary(result, scanOptions.verbose);

      const jsonPath = writeJsonReport(result, scanOptions.outputDir);
      const latestJsonPath = writeLatestJsonReport(result, scanOptions.outputDir);
      const mdPath = writeMarkdownReport(result, scanOptions.outputDir);
      const latestMdPath = writeLatestMarkdownReport(result, scanOptions.outputDir);

      console.log(chalk.cyan('📄 报告已生成:'));
      console.log(chalk.gray(`   JSON 报告: ${jsonPath}`));
      console.log(chalk.gray(`   Markdown 报告: ${mdPath}`));
      console.log(chalk.gray(`   最新报告: ${latestJsonPath}, ${latestMdPath}`));
      console.log('');

      const exitCode = getExitCode(result, scanOptions.failOnSeverity);
      process.exit(exitCode);

    } catch (e) {
      console.error(chalk.red(`\n❌ 扫描失败: ${(e as Error).message}`));
      if (scanOptions.verbose) {
        console.error(chalk.red((e as Error).stack || ''));
      }
      process.exit(2);
    }
  });

program
  .command('self-test')
  .description('运行自检，验证扫描器功能正常')
  .option('-v, --verbose', '显示详细信息')
  .option('--no-color', '禁用彩色输出')
  .action(async (options) => {
    if (options.noColor) {
      chalk.level = 0;
    }

    console.log(chalk.cyan('🧪 运行自检...'));
    console.log('');

    const results = await runSelfTests();
    
    const passed = results.filter(r => r.passed).length;
    const total = results.length;

    console.log(chalk.bold(`自检结果: ${passed}/${total} 通过`));
    console.log('');

    for (const result of results) {
      if (result.passed) {
        console.log(chalk.green(`  ✅ ${result.name}: ${result.message}`));
      } else {
        console.log(chalk.red(`  ❌ ${result.name}: ${result.message}`));
      }
      if (options.verbose && result.details) {
        console.log(chalk.gray(`     详情: ${JSON.stringify(result.details)}`));
      }
    }

    console.log('');

    if (passed === total) {
      console.log(chalk.green.bold('✅ 所有自检通过！'));
      process.exit(0);
    } else {
      console.log(chalk.red.bold('❌ 部分自检失败，请检查问题'));
      process.exit(1);
    }
  });

program
  .command('list-rules')
  .description('列出所有内置的敏感规则')
  .option('-r, --rules <path>', '自定义规则文件路径')
  .action((options) => {
    try {
      const rules = loadRules(options.rules);
      
      console.log(chalk.cyan('📋 敏感规则列表'));
      console.log('');
      
      for (const rule of rules) {
        const severityColor: Record<string, chalk.Chalk> = {
          critical: chalk.red,
          high: chalk.red,
          medium: chalk.yellow,
          low: chalk.blue
        };
        const color = severityColor[rule.severity] || chalk.gray;
        
        console.log(chalk.bold(`[${rule.id}] ${rule.name}`));
        console.log(color(`  级别: ${rule.severity} | 分类: ${rule.category}`));
        console.log(chalk.gray(`  描述: ${rule.description}`));
        console.log(chalk.gray(`  正则: ${rule.pattern}`));
        if (rule.examples) {
          console.log(chalk.gray(`  示例: ${rule.examples.join(', ')}`));
        }
        console.log('');
      }
      
      console.log(chalk.gray(`共 ${rules.length} 条规则`));
    } catch (e) {
      console.error(chalk.red(`❌ 加载规则失败: ${(e as Error).message}`));
      process.exit(1);
    }
  });

program
  .command('init-exceptions')
  .description('生成例外配置文件模板')
  .option('-o, --output <path>', '输出文件路径', './exceptions.yaml')
  .action((options) => {
    const template = `# Helm Secret Scanner 例外配置
# 可配置多个例外项，匹配时任一条件满足即可

exceptions:
  # 示例：例外某个路径下的所有发现
  - id: "exception-001"
    reason: "这是测试环境的示例密钥，用于集成测试"
    path: "database.test.password"
    environment: "test"
    expiresAt: "2025-12-31"
    createdAt: "2024-01-01"
    createdBy: "devops-team"

  # 示例：例外某个规则的所有发现
  - id: "exception-002"
    reason: "内网 IP 是预期配置"
    ruleId: "intranet-ip"
    environment: "staging"
    createdAt: "2024-01-01"
    createdBy: "network-team"

  # 示例：例外匹配某个值的发现（支持通配符）
  - id: "exception-003"
    reason: "这是示例密码，不是真实凭证"
    value: "*example*"
    createdAt: "2024-01-01"
    createdBy: "security-team"
`;

    const fs = require('fs');
    const path = require('path');
    
    const outputPath = path.resolve(options.output);
    fs.writeFileSync(outputPath, template, 'utf-8');
    
    console.log(chalk.green(`✅ 例外配置模板已生成: ${outputPath}`));
  });

program.parse(process.argv);

if (process.argv.length <= 2) {
  program.help();
}
