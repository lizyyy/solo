#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { handleInit, InitOptions } from './commands/init';
import { handleImport, ImportOptions } from './commands/import';
import { handleCheck, CheckCommandOptions } from './commands/check';
import { handleDetail, DetailOptions } from './commands/detail';
import { handleReport, ReportOptions } from './commands/report';
import { isInitialized, loadState } from './store';
import { formatDate } from './utils';

const program = new Command();

program
  .name('subtitle-qc')
  .description('视频字幕质检 CLI 工具 - 检查错别字、时间轴重叠、敏感词和双语缺段')
  .version('1.0.0');

program
  .command('init')
  .description('初始化字幕质检项目')
  .option('--force', '强制重新初始化，覆盖现有数据')
  .action(async (options: InitOptions) => {
    await handleInit(options);
  });

program
  .command('import')
  .description('导入字幕文件、敏感词表、术语表等数据')
  .option('-s, --subtitle <file>', '字幕文件 (.srt/.vtt)')
  .option('-l, --language <lang>', '字幕语言: zh, en, bilingual', 'zh')
  .option('-m, --metadata <file>', '视频元数据文件 (.json)')
  .option('--sensitive <file>', '敏感词表文件 (.json/.txt)')
  .option('--terms <file>', '术语表文件 (.json/.txt)')
  .option('-o, --operator <name>', '操作者名称', 'system')
  .action(async (options: ImportOptions) => {
    await handleImport(options);
  });

program
  .command('check')
  .description('执行字幕质检检查')
  .option('--no-overlap', '跳过时间轴重叠检查')
  .option('--no-empty', '跳过空段落检查')
  .option('--no-sensitive', '跳过敏感词检查')
  .option('--no-typos', '跳过错别字检查')
  .option('--no-terms', '跳过术语一致性检查')
  .option('-s, --subtitle <id>', '只检查指定的字幕文件')
  .action(async (options: CheckCommandOptions) => {
    await handleCheck(options);
  });

program
  .command('detail')
  .description('查看问题详情、历史记录和修复状态')
  .option('-i, --issue-id <id>', '查看指定问题的详情')
  .option('-s, --status <status>', '按状态筛选: all, open, fixed, ignored', 'open')
  .option('-t, --type <type>', '按问题类型筛选')
  .option('--fix <id>', '标记问题为已修复')
  .option('--ignore <id>', '标记问题为已忽略')
  .option('-o, --operator <name>', '操作者名称', 'user')
  .option('-c, --comment <text>', '操作备注')
  .action(async (options: DetailOptions) => {
    await handleDetail(options);
  });

program
  .command('report')
  .description('生成质检报告 (HTML/JSON)')
  .option('-o, --output <dir>', '输出目录', 'reports')
  .option('-f, --format <format>', '报告格式: json, html, all', 'all')
  .option('-n, --name <name>', '报告名称', `qc-report-${Date.now()}`)
  .action(async (options: ReportOptions) => {
    await handleReport(options);
  });

program
  .command('status')
  .description('查看当前项目状态')
  .action(() => {
    if (!isInitialized()) {
      console.log(chalk.yellow('项目未初始化'));
      console.log(chalk.cyan('  运行: subtitle-qc init'));
      return;
    }
    
    const state = loadState();
    const issues = Object.values(state.issues);
    const subtitles = Object.values(state.subtitles);
    
    console.log('');
    console.log(chalk.bold('  项目状态:'));
    console.log(chalk.gray(`  - 初始化时间: ${formatDate(state.initializedAt)}`));
    console.log(chalk.gray(`  - 字幕文件: ${subtitles.length} 个`));
    console.log(chalk.gray(`  - 敏感词库: ${Object.keys(state.sensitiveWords).length} 个`));
    console.log(chalk.gray(`  - 术语表: ${Object.keys(state.terms).length} 个`));
    console.log(chalk.gray(`  - 问题总数: ${issues.length}`));
    console.log(chalk.gray(`  - 质检会话: ${Object.keys(state.sessions).length} 次`));
    console.log('');
    
    const openIssues = issues.filter(i => i.status === 'open');
    if (openIssues.length > 0) {
      const blockers = openIssues.filter(i => i.severity === 'blocker').length;
      const warnings = openIssues.filter(i => i.severity === 'warning').length;
      const infos = openIssues.filter(i => i.severity === 'info').length;
      
      console.log(chalk.bold('  待处理问题:'));
      if (blockers > 0) console.log(chalk.red(`    - 阻断: ${blockers}`));
      if (warnings > 0) console.log(chalk.yellow(`    - 警告: ${warnings}`));
      if (infos > 0) console.log(chalk.blue(`    - 信息: ${infos}`));
      console.log('');
      
      if (blockers > 0) {
        console.log(chalk.red.bold('  ⚠️  存在阻断级问题，请先修复'));
      }
    } else {
      console.log(chalk.green('  ✅ 当前无待处理问题'));
    }
  });

program.parseAsync(process.argv).catch(err => {
  console.error(chalk.red(`错误: ${err.message}`));
  process.exit(1);
});
