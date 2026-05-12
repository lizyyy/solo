import chalk from 'chalk';
import Table from 'cli-table3';
import { loadState, saveState, generateId, isInitialized } from '../store';
import { Issue, IssueHistory } from '../types';
import { formatDate, truncate } from '../utils';

export interface DetailOptions {
  issueId?: string;
  status?: 'all' | 'open' | 'fixed' | 'ignored';
  type?: string;
  fix?: string;
  ignore?: string;
  operator?: string;
  comment?: string;
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'open': return '🔴';
    case 'fixed': return '🟢';
    case 'ignored': return '⚪';
    default: return '⚪';
  }
}

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    typo: '错别字',
    timeline_overlap: '时间轴重叠',
    sensitive_word: '敏感词',
    missing_segment: '缺段检测',
    encoding_error: '编码错误',
    time_format_error: '时间格式',
    empty_segment: '空段落',
  };
  return labels[type] || type;
}

function getSeverityLabel(severity: string): string {
  const labels: Record<string, string> = {
    blocker: '阻断',
    warning: '警告',
    info: '信息',
  };
  return labels[severity] || severity;
}

export async function handleDetail(options: DetailOptions): Promise<void> {
  if (!isInitialized()) {
    console.log(chalk.red('项目未初始化，请先运行: subtitle-qc init'));
    process.exit(1);
  }
  
  const state = loadState();
  const operator = options.operator || 'user';
  
  if (!state.operators.includes(operator)) {
    state.operators.push(operator);
  }
  
  if (options.fix) {
    await handleFix(options.fix, operator, options.comment);
    return;
  }
  
  if (options.ignore) {
    await handleIgnore(options.ignore, operator, options.comment);
    return;
  }
  
  let issues = Object.values(state.issues);
  
  if (options.status && options.status !== 'all') {
    issues = issues.filter(i => i.status === options.status);
  } else if (!options.issueId) {
    issues = issues.filter(i => i.status === 'open');
  }
  
  if (options.type) {
    issues = issues.filter(i => i.type === options.type);
  }
  
  if (options.issueId) {
    const issue = issues.find(i => i.id === options.issueId);
    if (!issue) {
      console.log(chalk.red(`未找到问题: ${options.issueId}`));
      process.exit(1);
    }
    displayIssueDetail(issue);
    return;
  }
  
  if (issues.length === 0) {
    console.log(chalk.green('没有匹配的问题记录'));
    return;
  }
  
  const table = new Table({
    head: [
      chalk.bold('ID'),
      chalk.bold('状态'),
      chalk.bold('类型'),
      chalk.bold('严重度'),
      chalk.bold('段落'),
      chalk.bold('描述'),
    ],
    colWidths: [22, 8, 14, 10, 8, 40],
    wordWrap: true,
  });
  
  for (const issue of issues) {
    table.push([
      issue.id.substring(0, 20),
      getStatusIcon(issue.status) + ' ' + issue.status,
      getTypeLabel(issue.type),
      getSeverityLabel(issue.severity),
      issue.cueIndex?.toString() || '-',
      truncate(issue.message, 35),
    ]);
  }
  
  console.log(chalk.bold(`\n  问题列表 (${issues.length} 条):`));
  console.log(table.toString());
  console.log('');
  console.log(chalk.gray('  查看详情: subtitle-qc detail --issue-id <ID>'));
  console.log(chalk.gray('  标记修复: subtitle-qc detail --fix <ID> --operator <name> --comment <desc>'));
  console.log(chalk.gray('  标记忽略: subtitle-qc detail --ignore <ID> --operator <name> --comment <desc>'));
}

function displayIssueDetail(issue: Issue): void {
  const state = loadState();
  const subtitle = state.subtitles[issue.subtitleId];
  
  console.log('');
  console.log(chalk.bold('='.repeat(60)));
  console.log(chalk.bold('  问题详情'));
  console.log(chalk.bold('='.repeat(60)));
  
  const table = new Table({
    colWidths: [15, 45],
    wordWrap: true,
  });
  
  table.push([chalk.bold('问题ID'), issue.id]);
  table.push([chalk.bold('状态'), getStatusIcon(issue.status) + ' ' + issue.status]);
  table.push([chalk.bold('类型'), getTypeLabel(issue.type)]);
  table.push([chalk.bold('严重度'), getSeverityLabel(issue.severity)]);
  table.push([chalk.bold('所属字幕'), subtitle?.name || '未知']);
  table.push([chalk.bold('字幕段落'), issue.cueIndex?.toString() || '通用']);
  table.push([chalk.bold('时间范围'), `${issue.context.startTime || '-'} --> ${issue.context.endTime || '-'}`]);
  table.push([chalk.bold('创建时间'), formatDate(issue.createdAt)]);
  table.push([chalk.bold('更新时间'), formatDate(issue.updatedAt)]);
  table.push([chalk.bold('可自动修复'), issue.context.canAutoFix ? '✅ 是' : '❌ 否']);
  table.push([chalk.bold('需人工审核'), issue.context.requiresHumanReview ? '⚠️ 是' : '否']);
  table.push([chalk.bold('消息'), issue.message]);
  
  if (issue.context.originalText) {
    table.push([chalk.bold('原文'), chalk.red(issue.context.originalText)]);
  }
  
  if (issue.context.suggestedFix) {
    table.push([chalk.bold('建议修复'), chalk.green(issue.context.suggestedFix)]);
  }
  
  console.log(table.toString());
  
  if (issue.history && issue.history.length > 0) {
    console.log('');
    console.log(chalk.bold('  历史记录:'));
    
    const historyTable = new Table({
      head: [
        chalk.bold('时间'),
        chalk.bold('操作'),
        chalk.bold('操作者'),
        chalk.bold('修改前'),
        chalk.bold('修改后'),
        chalk.bold('备注'),
      ],
      colWidths: [20, 12, 10, 15, 15, 20],
      wordWrap: true,
    });
    
    for (const h of issue.history) {
      historyTable.push([
        formatDate(h.timestamp),
        h.action,
        h.operator,
        truncate(h.before || '-', 12),
        truncate(h.after || '-', 12),
        h.comment || '-',
      ]);
    }
    
    console.log(historyTable.toString());
  }
  
  console.log('');
}

async function handleFix(issueId: string, operator: string, comment?: string): Promise<void> {
  const state = loadState();
  const issue = state.issues[issueId];
  
  if (!issue) {
    console.log(chalk.red(`未找到问题: ${issueId}`));
    process.exit(1);
  }
  
  const history: IssueHistory = {
    id: generateId('history'),
    timestamp: Date.now(),
    action: issue.context.canAutoFix ? 'auto_fixed' : 'manual_fixed',
    operator,
    before: issue.context.originalText,
    after: issue.context.suggestedFix,
    comment,
  };
  
  issue.history.push(history);
  issue.status = 'fixed';
  issue.updatedAt = Date.now();
  
  saveState(state);
  
  console.log(chalk.green(`问题已标记为已修复: ${issueId}`));
  console.log(chalk.gray(`  操作者: ${operator}`));
  console.log(chalk.gray(`  操作类型: ${history.action}`));
  if (comment) {
    console.log(chalk.gray(`  备注: ${comment}`));
  }
}

async function handleIgnore(issueId: string, operator: string, comment?: string): Promise<void> {
  const state = loadState();
  const issue = state.issues[issueId];
  
  if (!issue) {
    console.log(chalk.red(`未找到问题: ${issueId}`));
    process.exit(1);
  }
  
  const history: IssueHistory = {
    id: generateId('history'),
    timestamp: Date.now(),
    action: 'ignored',
    operator,
    before: issue.context.originalText,
    comment: comment || '人工确认无问题',
  };
  
  issue.history.push(history);
  issue.status = 'ignored';
  issue.updatedAt = Date.now();
  
  saveState(state);
  
  console.log(chalk.yellow(`问题已标记为已忽略: ${issueId}`));
  console.log(chalk.gray(`  操作者: ${operator}`));
  if (comment) {
    console.log(chalk.gray(`  备注: ${comment}`));
  }
}
