import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import { loadState, isInitialized } from '../store';
import { Issue, IssueSeverity } from '../types';
import { formatDate, ensureDir, escapeHtml, truncate } from '../utils';

export interface ReportOptions {
  output?: string;
  format?: 'json' | 'html' | 'all';
  name?: string;
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

function getSeverityBadge(severity: string): string {
  const badges: Record<string, string> = {
    blocker: '<span class="badge badge-blocker">阻断</span>',
    warning: '<span class="badge badge-warning">警告</span>',
    info: '<span class="badge badge-info">信息</span>',
  };
  return badges[severity] || '<span class="badge badge-info">未知</span>';
}

function getStatusBadge(status: string): string {
  const badges: Record<string, string> = {
    open: '<span class="status status-open">待处理</span>',
    fixed: '<span class="status status-fixed">已修复</span>',
    ignored: '<span class="status status-ignored">已忽略</span>',
  };
  return badges[status] || '<span class="status status-open">未知</span>';
}

export async function handleReport(options: ReportOptions): Promise<void> {
  if (!isInitialized()) {
    console.log(chalk.red('项目未初始化，请先运行: subtitle-qc init'));
    process.exit(1);
  }
  
  const state = loadState();
  const outputDir = options.output || 'reports';
  const reportName = options.name || `qc-report-${Date.now()}`;
  
  ensureDir(outputDir);
  
  const spinner = ora('正在生成质检报告...').start();
  
  try {
    const issues = Object.values(state.issues);
    const subtitles = Object.values(state.subtitles);
    const sessions = Object.values(state.sessions).sort((a, b) => b.timestamp - a.timestamp);
    
    const summary = {
      total: issues.length,
      open: issues.filter(i => i.status === 'open').length,
      fixed: issues.filter(i => i.status === 'fixed').length,
      ignored: issues.filter(i => i.status === 'ignored').length,
      blockers: issues.filter(i => i.severity === 'blocker' && i.status === 'open').length,
      warnings: issues.filter(i => i.severity === 'warning' && i.status === 'open').length,
      infos: issues.filter(i => i.severity === 'info' && i.status === 'open').length,
      autoFixable: issues.filter(i => i.context.canAutoFix && i.status === 'open').length,
      requiresReview: issues.filter(i => i.context.requiresHumanReview && i.status === 'open').length,
      subtitleCount: subtitles.length,
      canPublish: issues.filter(i => i.severity === 'blocker' && i.status === 'open').length === 0,
    };
    
    const format = options.format || 'all';
    const reports: string[] = [];
    
    if (format === 'json' || format === 'all') {
      const jsonPath = path.join(outputDir, `${reportName}.json`);
      generateJsonReport(jsonPath, issues, summary, subtitles, sessions);
      reports.push(jsonPath);
    }
    
    if (format === 'html' || format === 'all') {
      const htmlPath = path.join(outputDir, `${reportName}.html`);
      generateHtmlReport(htmlPath, issues, summary, subtitles, sessions);
      reports.push(htmlPath);
    }
    
    spinner.succeed(chalk.green('质检报告生成成功'));
    
    console.log('');
    console.log(chalk.bold('  报告概要:'));
    console.log(chalk.gray(`  - 报告名称: ${reportName}`));
    console.log(chalk.gray(`  - 生成时间: ${formatDate(Date.now())}`));
    console.log(chalk.gray(`  - 字幕数量: ${summary.subtitleCount}`));
    console.log(chalk.gray(`  - 问题总数: ${summary.total}`));
    console.log(chalk.gray(`  - 待处理: ${summary.open}`));
    console.log(chalk.gray(`  - 已修复: ${summary.fixed}`));
    
    console.log('');
    const table = new Table({
      head: [chalk.bold('指标'), chalk.bold('数值'), chalk.bold('状态')],
      colWidths: [20, 15, 25],
    });
    
    table.push([
      '阻断级问题',
      summary.blockers.toString(),
      summary.blockers > 0 ? chalk.red('❌ 需要修复') : chalk.green('✅ 无问题'),
    ]);
    table.push([
      '警告级问题',
      summary.warnings.toString(),
      summary.warnings > 0 ? chalk.yellow('⚠️ 建议检查') : chalk.green('✅ 无问题'),
    ]);
    table.push([
      '信息级问题',
      summary.infos.toString(),
      chalk.blue('ℹ️ 参考信息'),
    ]);
    table.push([
      '可自动修复',
      summary.autoFixable.toString(),
      summary.autoFixable > 0 ? chalk.green('可以一键修复') : '-',
    ]);
    table.push([
      '需人工审核',
      summary.requiresReview.toString(),
      summary.requiresReview > 0 ? chalk.yellow('需要人工判断') : '-',
    ]);
    table.push([
      chalk.bold('发布状态'),
      '',
      summary.canPublish ? chalk.green.bold('✅ 可以发布') : chalk.red.bold('❌ 阻断发布'),
    ]);
    
    console.log(table.toString());
    
    console.log('');
    console.log(chalk.bold('  生成的报告文件:'));
    for (const r of reports) {
      console.log(chalk.cyan(`  - ${r}`));
    }
    
    if (!summary.canPublish) {
      console.log('');
      console.log(chalk.red.bold('  ⚠️  存在阻断级问题，不建议发布'));
      process.exitCode = 1;
    }
  } catch (error) {
    spinner.fail(chalk.red(`报告生成失败: ${error}`));
    process.exit(1);
  }
}

function generateJsonReport(
  filePath: string,
  issues: Issue[],
  summary: any,
  subtitles: any[],
  sessions: any[]
): void {
  const report = {
    generatedAt: Date.now(),
    summary,
    subtitles: subtitles.map(s => ({
      id: s.id,
      name: s.name,
      language: s.language,
      format: s.format,
      cueCount: s.cues.length,
      importTime: s.importTime,
    })),
    issues: issues.map(i => ({
      id: i.id,
      type: i.type,
      typeLabel: getTypeLabel(i.type),
      severity: i.severity,
      severityLabel: getSeverityLabel(i.severity),
      status: i.status,
      message: i.message,
      subtitleId: i.subtitleId,
      cueIndex: i.cueIndex,
      context: i.context,
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
      historyCount: i.history.length,
    })),
    sessions: sessions.slice(0, 5).map(s => ({
      id: s.id,
      timestamp: s.timestamp,
      issueCount: s.issues.length,
      summary: s.summary,
    })),
  };
  
  fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf-8');
}

function generateHtmlReport(
  filePath: string,
  issues: Issue[],
  summary: any,
  subtitles: any[],
  sessions: any[]
): void {
  const openIssues = issues.filter(i => i.status === 'open');
  const blockerIssues = openIssues.filter(i => i.severity === 'blocker');
  const warningIssues = openIssues.filter(i => i.severity === 'warning');
  const infoIssues = openIssues.filter(i => i.severity === 'info');
  
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>字幕质检报告 - ${formatDate(Date.now())}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f7fa; color: #333; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 20px; }
    .header h1 { font-size: 28px; margin-bottom: 10px; }
    .header p { opacity: 0.9; }
    .publish-status { display: inline-block; padding: 8px 20px; border-radius: 20px; font-weight: bold; margin-top: 15px; }
    .publish-status.ok { background: #10b981; }
    .publish-status.not-ok { background: #ef4444; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
    .card { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
    .card .label { color: #6b7280; font-size: 14px; margin-bottom: 8px; }
    .card .value { font-size: 32px; font-weight: bold; }
    .card.blocker .value { color: #ef4444; }
    .card.warning .value { color: #f59e0b; }
    .card.info .value { color: #3b82f6; }
    .card.fixed .value { color: #10b981; }
    .section { background: white; border-radius: 12px; margin-bottom: 20px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
    .section-header { padding: 18px 24px; background: #f9fafb; border-bottom: 1px solid #e5e7eb; font-weight: bold; font-size: 18px; }
    .section-content { padding: 20px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: 600; color: #374151; }
    tr:hover { background: #f9fafb; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 500; }
    .badge-blocker { background: #fee2e2; color: #dc2626; }
    .badge-warning { background: #fef3c7; color: #d97706; }
    .badge-info { background: #dbeafe; color: #2563eb; }
    .status { display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 500; }
    .status-open { background: #fee2e2; color: #dc2626; }
    .status-fixed { background: #d1fae5; color: #059669; }
    .status-ignored { background: #f3f4f6; color: #6b7280; }
    .subtitle-list { display: flex; flex-wrap: wrap; gap: 10px; }
    .subtitle-item { background: #f3f4f6; padding: 10px 15px; border-radius: 8px; font-size: 14px; }
    .subtitle-item .lang { display: inline-block; padding: 2px 6px; background: #dbeafe; color: #2563eb; border-radius: 4px; margin-left: 8px; font-size: 11px; }
    .issue-detail { background: #f9fafb; margin-top: 8px; padding: 12px; border-radius: 6px; font-size: 13px; }
    .issue-detail .label { color: #6b7280; margin-right: 8px; }
    .text-original { color: #dc2626; font-family: monospace; }
    .text-suggested { color: #059669; font-family: monospace; }
    .tabs { display: flex; gap: 8px; margin-bottom: 16px; }
    .tab { padding: 8px 20px; border-radius: 6px; cursor: pointer; background: #f3f4f6; border: none; font-size: 14px; }
    .tab.active { background: #667eea; color: white; }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    .empty-state { text-align: center; padding: 40px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎬 视频字幕质检报告</h1>
      <p>生成时间: ${formatDate(Date.now())}</p>
      <div class="publish-status ${summary.canPublish ? 'ok' : 'not-ok'}">
        ${summary.canPublish ? '✅ 可以发布' : '❌ 阻断发布'}
      </div>
    </div>
    
    <div class="cards">
      <div class="card blocker">
        <div class="label">阻断级问题</div>
        <div class="value">${summary.blockers}</div>
      </div>
      <div class="card warning">
        <div class="label">警告级问题</div>
        <div class="value">${summary.warnings}</div>
      </div>
      <div class="card info">
        <div class="label">信息级问题</div>
        <div class="value">${summary.infos}</div>
      </div>
      <div class="card">
        <div class="label">可自动修复</div>
        <div class="value">${summary.autoFixable}</div>
      </div>
      <div class="card">
        <div class="label">需人工审核</div>
        <div class="value">${summary.requiresReview}</div>
      </div>
      <div class="card fixed">
        <div class="label">已修复</div>
        <div class="value">${summary.fixed}</div>
      </div>
    </div>
    
    <div class="section">
      <div class="section-header">📄 已导入的字幕文件</div>
      <div class="section-content">
        <div class="subtitle-list">
          ${subtitles.map(s => `
            <div class="subtitle-item">
              ${escapeHtml(s.name)}
              <span class="lang">${s.language === 'zh' ? '中文' : s.language === 'en' ? '英文' : '双语'}</span>
              <span class="lang">${s.cues.length}段</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
    
    <div class="section">
      <div class="section-header">🔴 阻断级问题 (${blockerIssues.length})</div>
      <div class="section-content">
        ${blockerIssues.length === 0 ? '<div class="empty-state">🎉 无阻断级问题</div>' : renderIssuesTable(blockerIssues)}
      </div>
    </div>
    
    <div class="section">
      <div class="section-header">🟡 警告级问题 (${warningIssues.length})</div>
      <div class="section-content">
        ${warningIssues.length === 0 ? '<div class="empty-state">无警告级问题</div>' : renderIssuesTable(warningIssues)}
      </div>
    </div>
    
    <div class="section">
      <div class="section-header">🔵 信息级问题 (${infoIssues.length})</div>
      <div class="section-content">
        ${infoIssues.length === 0 ? '<div class="empty-state">无信息级问题</div>' : renderIssuesTable(infoIssues)}
      </div>
    </div>
    
    <div class="section">
      <div class="section-header">📊 质检记录</div>
      <div class="section-content">
        <table>
          <thead>
            <tr>
              <th>时间</th>
              <th>会话ID</th>
              <th>问题数</th>
              <th>阻断</th>
              <th>警告</th>
              <th>信息</th>
            </tr>
          </thead>
          <tbody>
            ${sessions.slice(0, 10).map(s => `
              <tr>
                <td>${formatDate(s.timestamp)}</td>
                <td><code>${s.id.substring(0, 12)}...</code></td>
                <td>${s.issues.length}</td>
                <td><span class="badge badge-blocker">${s.summary.blockers}</span></td>
                <td><span class="badge badge-warning">${s.summary.warnings}</span></td>
                <td><span class="badge badge-info">${s.summary.infos}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
    
  </div>
</body>
</html>`;
  
  fs.writeFileSync(filePath, html, 'utf-8');
}

function renderIssuesTable(issues: Issue[]): string {
  const state = loadState();
  
  return `
    <table>
      <thead>
        <tr>
          <th>状态</th>
          <th>类型</th>
          <th>严重度</th>
          <th>段落</th>
          <th>描述</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        ${issues.map(i => {
          const subtitle = state.subtitles[i.subtitleId];
          return `
            <tr>
              <td>${getStatusBadge(i.status)}</td>
              <td>${getTypeLabel(i.type)}</td>
              <td>${getSeverityBadge(i.severity)}</td>
              <td>${i.cueIndex || '-'}</td>
              <td>${escapeHtml(i.message)}</td>
              <td>${i.context.canAutoFix ? '<span class="badge badge-info">可自动修复</span>' : ''} ${i.context.requiresHumanReview ? '<span class="badge badge-warning">需人工</span>' : ''}</td>
            </tr>
            ${i.context.originalText || i.context.suggestedFix ? `
              <tr>
                <td colspan="6">
                  <div class="issue-detail">
                    <div><span class="label">字幕文件:</span>${escapeHtml(subtitle?.name || '未知')}</div>
                    ${i.context.startTime ? `<div><span class="label">时间:</span>${i.context.startTime} --> ${i.context.endTime}</div>` : ''}
                    ${i.context.originalText ? `<div><span class="label">原文:</span><span class="text-original">${escapeHtml(i.context.originalText)}</span></div>` : ''}
                    ${i.context.suggestedFix ? `<div><span class="label">建议:</span><span class="text-suggested">${escapeHtml(i.context.suggestedFix)}</span></div>` : ''}
                  </div>
                </td>
              </tr>
            ` : ''}
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}
