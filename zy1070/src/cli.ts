#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { runScan, runReport, initProject, scanProject } from './core';
import { getIssueExplanation, getAllIssueExplanations } from './analyzer';
import { IssueType } from './types';

const program = new Command();

program
  .name('token-drift')
  .description('Design Token 漂移检测 CLI 工具')
  .version('1.0.0', '-v, --version', '输出版本号');

program
  .command('init')
  .description('初始化示例项目')
  .argument('[directory]', '目标目录', './token-drift-demo')
  .action((directory: string) => {
    console.log(chalk.blue('🚀 初始化示例项目...'));
    initProject(directory);
  });

program
  .command('scan')
  .description('扫描项目并在终端显示摘要')
  .option('-p, --project <path>', '项目根目录', process.cwd())
  .action(async (options: { project: string }) => {
    try {
      await runScan(options.project);
    } catch (error) {
      console.error(chalk.red('\n❌ 扫描失败:'));
      console.error(chalk.red(`   ${(error as Error).message}`));
      process.exit(1);
    }
  });

program
  .command('report')
  .description('生成报告文件')
  .option('-p, --project <path>', '项目根目录', process.cwd())
  .option(
    '-f, --format <formats...>',
    '输出格式 (json, markdown, html)',
    ['json', 'markdown', 'html']
  )
  .action(async (options: { project: string; format: string[] }) => {
    try {
      const formats = options.format.map((f) => f.toLowerCase());
      const validFormats = ['json', 'markdown', 'md', 'html'];
      
      const invalidFormats = formats.filter((f) => !validFormats.includes(f));
      if (invalidFormats.length > 0) {
        console.error(chalk.red(`❌ 不支持的格式: ${invalidFormats.join(', ')}`));
        console.error(chalk.gray(`   支持的格式: ${validFormats.join(', ')}`));
        process.exit(1);
      }

      await runReport(formats, options.project);
    } catch (error) {
      console.error(chalk.red('\n❌ 生成报告失败:'));
      console.error(chalk.red(`   ${(error as Error).message}`));
      process.exit(1);
    }
  });

program
  .command('explain')
  .description('查看问题类型的详细说明')
  .argument('[issueType]', '问题类型 (如: hardcoded_color, missing_token)')
  .option('-a, --all', '显示所有问题类型的说明')
  .action((issueType: string | undefined, options: { all: boolean }) => {
    if (options.all) {
      console.log(chalk.bold('\n📖 所有问题类型说明\n'));
      
      const allExplanations = getAllIssueExplanations();
      
      for (const exp of allExplanations) {
        console.log(chalk.bold(`\n${getSeverityEmoji(exp.severity)} ${exp.title}`));
        console.log(chalk.gray(`   类型: ${exp.type}`));
        console.log(chalk.gray(`   严重程度: ${getSeverityLabel(exp.severity)}`));
        console.log(`\n   ${exp.description}\n`);
        
        console.log(chalk.bold('   示例:\n'));
        for (const example of exp.examples) {
          console.log(chalk.red('   ❌ 不推荐:'));
          console.log(`      ${example.bad}\n`);
          console.log(chalk.green('   ✅ 推荐:'));
          console.log(`      ${example.good}\n`);
          console.log(`   💡 ${example.explanation}\n`);
        }
      }
      return;
    }

    if (!issueType) {
      console.log(chalk.yellow('⚠️  请指定问题类型或使用 --all 查看所有类型'));
      console.log('\n可用的问题类型:');
      
      const allExplanations = getAllIssueExplanations();
      for (const exp of allExplanations) {
        console.log(`  • ${exp.type}`);
      }
      
      console.log('\n示例:');
      console.log('  token-drift explain hardcoded_color');
      console.log('  token-drift explain --all');
      return;
    }

    const typeKey = issueType.replace(/-/g, '_').toLowerCase() as IssueType;
    
    try {
      const explanation = getIssueExplanation(typeKey);
      
      console.log(chalk.bold(`\n📖 ${explanation.title}\n`));
      console.log(`   类型: ${chalk.cyan(explanation.type)}`);
      console.log(`   严重程度: ${getSeverityEmoji(explanation.severity)} ${getSeverityLabel(explanation.severity)}`);
      console.log(`\n   ${explanation.description}\n`);
      
      console.log(chalk.bold('   示例:\n'));
      for (const example of explanation.examples) {
        console.log(chalk.red('   ❌ 不推荐:'));
        console.log(`      ${example.bad}\n`);
        console.log(chalk.green('   ✅ 推荐:'));
        console.log(`      ${example.good}\n`);
        console.log(`   💡 ${example.explanation}\n`);
      }
    } catch {
      console.error(chalk.red(`❌ 未知的问题类型: ${issueType}`));
      console.log('\n可用的问题类型:');
      
      const allExplanations = getAllIssueExplanations();
      for (const exp of allExplanations) {
        console.log(`  • ${exp.type}`);
      }
      process.exit(1);
    }
  });

function getSeverityLabel(severity: string): string {
  const labels: Record<string, string> = {
    critical: '严重',
    high: '高',
    medium: '中',
    low: '低',
  };
  return labels[severity] || severity;
}

function getSeverityEmoji(severity: string): string {
  const emojis: Record<string, string> = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🟢',
  };
  return emojis[severity] || '⚪';
}

program.parseAsync(process.argv).catch((error) => {
  console.error(chalk.red('\n❌ 执行出错:'));
  console.error(chalk.red(`   ${error.message}`));
  process.exit(1);
});
