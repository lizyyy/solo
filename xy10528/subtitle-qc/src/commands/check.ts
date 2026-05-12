import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import { loadState, saveState, generateId, isInitialized } from '../store';
import { runAllChecks, CheckOptions } from '../checker';
import { Issue, CheckSession, IssueSeverity } from '../types';
import { formatDate } from '../utils';

export interface CheckCommandOptions {
  noOverlap?: boolean;
  noEmpty?: boolean;
  noSensitive?: boolean;
  noTypos?: boolean;
  noTerms?: boolean;
  subtitle?: string;
  skipExisting?: boolean;
}

export async function handleCheck(options: CheckCommandOptions): Promise<void> {
  if (!isInitialized()) {
    console.log(chalk.red('项目未初始化，请先运行: subtitle-qc init'));
    process.exit(1);
  }
  
  const state = loadState();
  const subtitles = Object.values(state.subtitles);
  
  if (subtitles.length === 0) {
    console.log(chalk.yellow('没有已导入的字幕文件，请先运行: subtitle-qc import --subtitle <file>'));
    process.exit(1);
  }
  
  const spinner = ora('正在执行字幕质检...').start();
  
  try {
    const checkOptions: CheckOptions = {
      checkOverlap: !options.noOverlap,
      checkEmpty: !options.noEmpty,
      checkSensitive: !options.noSensitive,
      checkTypos: !options.noTypos,
      checkTerms: !options.noTerms,
    };
    
    const newIssues = runAllChecks(
      subtitles,
      Object.values(state.sensitiveWords),
      Object.values(state.terms),
      checkOptions
    );
    
    let addedCount = 0;
    let keptCount = 0;
    
    for (const issue of newIssues) {
      const existingKey = `${issue.subtitleId}_${issue.type}_${issue.cueIndex ?? 0}_${issue.message}`;
      const existing = Object.values(state.issues).find(
        i => `${i.subtitleId}_${i.type}_${i.cueIndex ?? 0}_${i.message}` === existingKey
      );
      
      if (existing) {
        keptCount++;
        continue;
      }
      
      state.issues[issue.id] = issue;
      addedCount++;
    }
    
    const allIssues = Object.values(state.issues);
    
    const summary = {
      total: allIssues.length,
      blockers: allIssues.filter(i => i.severity === 'blocker' && i.status === 'open').length,
      warnings: allIssues.filter(i => i.severity === 'warning' && i.status === 'open').length,
      infos: allIssues.filter(i => i.severity === 'info' && i.status === 'open').length,
      autoFixable: allIssues.filter(i => i.context.canAutoFix && i.status === 'open').length,
      requiresReview: allIssues.filter(i => i.context.requiresHumanReview && i.status === 'open').length,
    };
    
    const session: CheckSession = {
      id: generateId('session'),
      timestamp: Date.now(),
      subtitleIds: subtitles.map(s => s.id),
      issues: [...allIssues],
      summary,
    };
    
    state.sessions[session.id] = session;
    saveState(state);
    
    spinner.succeed(chalk.green('质检完成'));
    
    console.log('');
    console.log(chalk.bold('  质检结果:'));
    console.log(chalk.gray(`  - 会话ID: ${session.id}`));
    console.log(chalk.gray(`  - 时间: ${formatDate(session.timestamp)}`));
    console.log(chalk.gray(`  - 新增问题: ${addedCount}`));
    console.log(chalk.gray(`  - 历史问题: ${keptCount}`));
    
    console.log('');
    const summaryTable = new Table({
      head: [
        chalk.bold('级别'),
        chalk.bold('数量'),
        chalk.bold('说明'),
      ],
      colWidths: [12, 10, 40],
    });
    
    summaryTable.push([
      chalk.red('阻断 (Blocker)'),
      summary.blockers.toString(),
      '必须修复，否则不能发布',
    ]);
    summaryTable.push([
      chalk.yellow('警告 (Warning)'),
      summary.warnings.toString(),
      '建议修复，可能影响观看体验',
    ]);
    summaryTable.push([
      chalk.blue('信息 (Info)'),
      summary.infos.toString(),
      '参考性建议，可选择修复',
    ]);
    summaryTable.push([
      chalk.green('可自动修复'),
      summary.autoFixable.toString(),
      '系统可自动修复的问题',
    ]);
    summaryTable.push([
      chalk.magenta('需人工审核'),
      summary.requiresReview.toString(),
      '需要人工判断的问题',
    ]);
    
    console.log(summaryTable.toString());
    
    console.log('');
    const openIssues = allIssues.filter(i => i.status === 'open');
    if (openIssues.length > 0) {
      console.log(chalk.bold('  待处理问题 (前10条):'));
      const issuesTable = new Table({
        head: [
          chalk.bold('#'),
          chalk.bold('类型'),
          chalk.bold('严重度'),
          chalk.bold('描述'),
        ],
        colWidths: [5, 18, 12, 45],
        wordWrap: true,
      });
      
      for (const issue of openIssues.slice(0, 10)) {
        const typeColors: Record<string, (s: string) => string> = {
          typo: chalk.yellow,
          timeline_overlap: chalk.red,
          sensitive_word: chalk.magenta,
          missing_segment: chalk.red,
          encoding_error: chalk.cyan,
          time_format_error: chalk.blue,
          empty_segment: chalk.gray,
        };
        
        const severityColors: Record<IssueSeverity, (s: string) => string> = {
          blocker: chalk.red,
          warning: chalk.yellow,
          info: chalk.blue,
        };
        
        issuesTable.push([
          issue.cueIndex?.toString() || '-',
          (typeColors[issue.type] || chalk.white)(issue.type),
          severityColors[issue.severity](issue.severity),
          issue.message,
        ]);
      }
      
      console.log(issuesTable.toString());
      
      if (openIssues.length > 10) {
        console.log(chalk.gray(`  ... 还有 ${openIssues.length - 10} 条问题，使用 subtitle-qc detail 查看详情`));
      }
    } else {
      console.log(chalk.green('  ✅ 所有质检项通过！'));
    }
    
    console.log('');
    console.log(chalk.bold('  下一步:'));
    console.log(chalk.cyan('  - 查看问题详情: subtitle-qc detail'));
    console.log(chalk.cyan('  - 生成质检报告: subtitle-qc report'));
    
    if (summary.blockers > 0) {
      console.log('');
      console.log(chalk.red.bold(`  ⚠️  检测到 ${summary.blockers} 个阻断级问题，建议修复后重新检查`));
      process.exitCode = 1;
    }
  } catch (error) {
    spinner.fail(chalk.red(`质检失败: ${error}`));
    process.exit(1);
  }
}
