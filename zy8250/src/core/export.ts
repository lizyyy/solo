import * as fs from 'fs';
import * as path from 'path';
import { createObjectCsvWriter } from 'csv-writer';
import { 
  JobAudit, 
  Issue, 
  IssueSeverity, 
  IssueType, 
  AuditReport,
  ValidationError
} from '../types';
import { getLastRunTime, getTimeSinceLastRun } from './job-rebuilder';
import { formatDuration } from '../utils';

export function generateAuditReport(audits: JobAudit[]): AuditReport {
  const allIssues = audits.flatMap(a => a.issues);
  
  const issuesBySeverity: Record<IssueSeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0
  };

  const issuesByType: Record<IssueType, number> = {
    DISABLED: 0,
    DUPLICATE_TRIGGER: 0,
    TIMEZONE_MISMATCH: 0,
    SLA_VIOLATION: 0,
    SCRIPT_PATH_INVALID: 0,
    EXPECTED_MISSING: 0,
    ACTUAL_MISSING: 0,
    SCHEDULE_MISMATCH: 0,
    COMMAND_MISMATCH: 0,
    ENVIRONMENT_MISMATCH: 0,
    OWNER_MISMATCH: 0,
    PARSE_ERROR: 0,
    ENABLED_MISMATCH: 0,
    UNEXPECTED_JOB: 0
  };

  for (const issue of allIssues) {
    issuesBySeverity[issue.severity]++;
    issuesByType[issue.type]++;
  }

  const jobsWithIssues = audits.filter(a => a.issues.length > 0).length;
  const jobsWithoutIssues = audits.length - jobsWithIssues;

  const jobsWithExpected = audits.filter(a => a.expected !== null);
  const slaCompliantCount = jobsWithExpected.filter(a => {
    if (!a.actual) return false;
    const timeSinceLastRun = getTimeSinceLastRun(a);
    return timeSinceLastRun !== null && timeSinceLastRun <= a.expected!.sla;
  }).length;

  const slaCompliance = jobsWithExpected.length > 0 
    ? (slaCompliantCount / jobsWithExpected.length) * 100 
    : 100;

  return {
    generatedAt: new Date().toISOString(),
    totalJobs: audits.length,
    issuesBySeverity,
    issuesByType,
    jobsWithIssues,
    jobsWithoutIssues,
    slaCompliance,
    jobs: audits
  };
}

export async function exportIssuesToCsv(
  audits: JobAudit[],
  outputPath: string
): Promise<void> {
  const allIssues = audits.flatMap(audit => 
    audit.issues.map(issue => ({
      ...issue,
      jobType: audit.type,
      owner: audit.ownerInfo?.owner || '未知',
      lastRun: formatLastRun(audit)
    }))
  );

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const csvWriter = createObjectCsvWriter({
    path: outputPath,
    header: [
      { id: 'id', title: 'Issue ID' },
      { id: 'jobName', title: '任务名称' },
      { id: 'jobType', title: '任务类型' },
      { id: 'type', title: '问题类型' },
      { id: 'severity', title: '严重程度' },
      { id: 'message', title: '问题描述' },
      { id: 'owner', title: '负责人' },
      { id: 'lastRun', title: '上次运行' },
      { id: 'timestamp', title: '检测时间' }
    ]
  });

  const records = allIssues.map(issue => ({
    id: issue.id,
    jobName: issue.jobName,
    jobType: issue.jobType,
    type: issue.type,
    severity: issue.severity,
    message: issue.message,
    owner: issue.owner,
    lastRun: issue.lastRun,
    timestamp: new Date(issue.timestamp).toISOString()
  }));

  await csvWriter.writeRecords(records);
}

export async function exportAuditReportToMarkdown(
  report: AuditReport,
  outputPath: string,
  validationErrors: ValidationError[] = []
): Promise<void> {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const markdown = generateMarkdownReport(report, validationErrors);
  fs.writeFileSync(outputPath, markdown, 'utf-8');
}

function generateMarkdownReport(
  report: AuditReport,
  validationErrors: ValidationError[]
): string {
  const lines: string[] = [];

  lines.push('# 定时任务巡检报告');
  lines.push('');
  lines.push(`**生成时间**: ${new Date(report.generatedAt).toLocaleString('zh-CN')}`);
  lines.push('');

  lines.push('## 概览');
  lines.push('');
  lines.push('| 指标 | 数值 |');
  lines.push('|------|------|');
  lines.push(`| 总任务数 | ${report.totalJobs} |`);
  lines.push(`| 有问题的任务 | ${report.jobsWithIssues} |`);
  lines.push(`| 无问题的任务 | ${report.jobsWithoutIssues} |`);
  lines.push(`| SLA 合规率 | ${report.slaCompliance.toFixed(1)}% |`);
  lines.push('');

  lines.push('## 问题统计');
  lines.push('');

  lines.push('### 按严重程度');
  lines.push('');
  lines.push('| 严重程度 | 数量 |');
  lines.push('|----------|------|');
  lines.push(`| 🔴 Critical | ${report.issuesBySeverity.critical} |`);
  lines.push(`| 🟠 High | ${report.issuesBySeverity.high} |`);
  lines.push(`| 🟡 Medium | ${report.issuesBySeverity.medium} |`);
  lines.push(`| 🟢 Low | ${report.issuesBySeverity.low} |`);
  lines.push('');

  lines.push('### 按问题类型');
  lines.push('');
  lines.push('| 问题类型 | 数量 | 说明 |');
  lines.push('|----------|------|------|');

  const typeDescriptions: Record<IssueType, string> = {
    DISABLED: '任务被禁用',
    DUPLICATE_TRIGGER: '重复触发时间',
    TIMEZONE_MISMATCH: '时区不匹配',
    SLA_VIOLATION: '超过SLA未运行',
    SCRIPT_PATH_INVALID: '脚本路径不存在',
    EXPECTED_MISSING: '预期任务缺失',
    ACTUAL_MISSING: '实际任务缺失',
    SCHEDULE_MISMATCH: '计划时间不匹配',
    COMMAND_MISMATCH: '命令不匹配',
    ENVIRONMENT_MISMATCH: '环境变量不匹配',
    OWNER_MISMATCH: '负责人不匹配',
    PARSE_ERROR: '解析错误',
    ENABLED_MISMATCH: '启用状态不匹配',
    UNEXPECTED_JOB: '未预期的任务'
  };

  for (const [type, count] of Object.entries(report.issuesByType)) {
    if (count > 0) {
      lines.push(`| ${type} | ${count} | ${typeDescriptions[type as IssueType]} |`);
    }
  }
  lines.push('');

  if (validationErrors.length > 0) {
    lines.push('## 文件解析错误');
    lines.push('');
    for (const error of validationErrors) {
      let errorLine = `- **文件**: ${error.file}`;
      if (error.line) {
        errorLine += `, **行号**: ${error.line}`;
      }
      if (error.field) {
        errorLine += `, **字段**: ${error.field}`;
      }
      errorLine += `\n  - ${error.message}`;
      lines.push(errorLine);
      lines.push('');
    }
  }

  lines.push('## 任务详情');
  lines.push('');

  const criticalJobs = report.jobs.filter(j => 
    j.issues.some(i => i.severity === 'critical')
  );
  const highJobs = report.jobs.filter(j => 
    j.issues.some(i => i.severity === 'high') && 
    !j.issues.some(i => i.severity === 'critical')
  );
  const mediumJobs = report.jobs.filter(j => 
    j.issues.some(i => i.severity === 'medium') && 
    !j.issues.some(i => i.severity === 'critical' || i.severity === 'high')
  );
  const cleanJobs = report.jobs.filter(j => j.issues.length === 0);

  const jobGroups = [
    { name: '🔴 Critical 问题任务', jobs: criticalJobs },
    { name: '🟠 High 问题任务', jobs: highJobs },
    { name: '🟡 Medium 问题任务', jobs: mediumJobs },
    { name: '🟢 正常任务', jobs: cleanJobs }
  ];

  for (const group of jobGroups) {
    if (group.jobs.length === 0) continue;

    lines.push(`### ${group.name} (${group.jobs.length})`);
    lines.push('');

    for (const job of group.jobs) {
      const statusIcon = job.issues.length === 0 ? '✅' : '⚠️';
      lines.push(`#### ${statusIcon} ${job.jobName}`);
      lines.push('');
      lines.push(`- **类型**: ${job.type === 'launchagent' ? 'LaunchAgent' : 'Cron'}`);
      lines.push(`- **负责人**: ${job.ownerInfo?.owner || '未知'} (${job.ownerInfo?.email || '无邮箱'})`);
      lines.push(`- **部门**: ${job.ownerInfo?.department || '未知'}`);
      lines.push('');

      if (job.expected) {
        lines.push('**预期配置**:');
        lines.push('');
        lines.push('```');
        lines.push(`计划: ${job.expected.schedule}`);
        lines.push(`命令: ${job.expected.command}`);
        lines.push(`启用: ${job.expected.enabled ? '是' : '否'}`);
        lines.push(`SLA: ${formatDuration(job.expected.sla)}`);
        lines.push(`环境变量: ${JSON.stringify(job.expected.environment)}`);
        lines.push('```');
        lines.push('');
      }

      if (job.actual) {
        lines.push('**实际配置**:');
        lines.push('');
        lines.push('```');
        lines.push(`计划: ${job.actual.schedule}`);
        lines.push(`命令: ${job.actual.command}`);
        lines.push(`启用: ${job.actual.enabled ? '是' : '否'}`);
        lines.push(`环境变量: ${JSON.stringify(job.actual.environment)}`);
        if (job.actual.plistPath) {
          lines.push(`Plist路径: ${job.actual.plistPath}`);
        }
        lines.push('```');
        lines.push('');
      }

      const lastRunTime = getLastRunTime(job);
      const timeSinceLastRun = getTimeSinceLastRun(job);
      lines.push(`**运行状态**:`);
      lines.push('');
      lines.push('- 运行次数: ' + job.lastRuns.length);
      if (lastRunTime) {
        lines.push(`- 上次运行: ${new Date(lastRunTime).toLocaleString('zh-CN')}`);
        lines.push(`- 距现在: ${timeSinceLastRun !== null ? formatDuration(timeSinceLastRun) : '未知'}`);
      } else {
        lines.push('- 上次运行: 从未运行');
      }
      lines.push('');

      if (job.issues.length > 0) {
        lines.push('**问题列表**:');
        lines.push('');
        for (const issue of job.issues) {
          const severityIcon = {
            critical: '🔴',
            high: '🟠',
            medium: '🟡',
            low: '🟢'
          }[issue.severity];
          lines.push(`- ${severityIcon} **${issue.type}**: ${issue.message}`);
          if (issue.details) {
            lines.push(`  - 详情: ${JSON.stringify(issue.details, null, 2)}`);
          }
        }
        lines.push('');
      }

      lines.push('---');
      lines.push('');
    }
  }

  lines.push('## 附录');
  lines.push('');
  lines.push('### 问题类型说明');
  lines.push('');
  lines.push('| 类型 | 说明 | 严重程度 |');
  lines.push('|------|------|----------|');
  lines.push('| DISABLED | 任务被禁用 | High |');
  lines.push('| DUPLICATE_TRIGGER | 多个任务有相同的触发时间 | Medium |');
  lines.push('| TIMEZONE_MISMATCH | 时区配置不匹配 | High |');
  lines.push('| SLA_VIOLATION | 超过 SLA 未运行 | Critical |');
  lines.push('| SCRIPT_PATH_INVALID | 脚本路径不存在 | Critical |');
  lines.push('| EXPECTED_MISSING | 实际任务不在预期配置中 | High |');
  lines.push('| ACTUAL_MISSING | 预期任务在实际系统中不存在 | Critical |');
  lines.push('| SCHEDULE_MISMATCH | 计划时间不匹配 | High |');
  lines.push('| COMMAND_MISMATCH | 命令不匹配 | High |');
  lines.push('| ENVIRONMENT_MISMATCH | 环境变量不匹配 | Medium |');
  lines.push('| OWNER_MISMATCH | 负责人不匹配 | Medium |');
  lines.push('| ENABLED_MISMATCH | 启用状态不匹配 | High |');
  lines.push('| UNEXPECTED_JOB | 发现未预期的任务 | Medium |');
  lines.push('');

  return lines.join('\n');
}

function formatLastRun(audit: JobAudit): string {
  const lastRunTime = getLastRunTime(audit);
  if (lastRunTime) {
    return new Date(lastRunTime).toLocaleString('zh-CN');
  }
  return '从未运行';
}
