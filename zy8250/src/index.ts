#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

import { 
  parseExpectedJobsYaml 
} from './parsers/yaml-parser';
import { 
  parsePlistFile,
  convertPlistToSchedule,
  convertPlistToCommand
} from './parsers/plist-parser';
import { 
  parseCronDump,
  convertCronToSchedule
} from './parsers/cron-parser';
import { 
  parseLastRunsJsonl 
} from './parsers/jsonl-parser';
import { 
  parseOwnersCsv 
} from './parsers/csv-parser';

import { 
  rebuildAllJobs,
  RebuildInput
} from './core/job-rebuilder';
import { 
  detectAllIssues 
} from './core/issue-detector';
import { 
  generateAuditReport,
  exportIssuesToCsv,
  exportAuditReportToMarkdown
} from './core/export';

import { 
  getPlistFilesInDirectory 
} from './utils';
import { 
  ValidationError, 
  AuditReport,
  IssueSeverity
} from './types';

const program = new Command();

program
  .name('scheduler-audit')
  .description('巡检 macOS LaunchAgent 和 cron 定时任务的 CLI 工具')
  .version('1.0.0')
  .option('-e, --expected-jobs <path>', '预期任务 YAML 文件路径', 'expected_jobs.yaml')
  .option('-l, --launch-agents-dir <path>', 'LaunchAgents plist 目录路径', 'launchagents')
  .option('-c, --cron-dump <path>', 'cron 导出文件路径', 'cron_dump.txt')
  .option('-r, --last-runs <path>', '上次运行记录 JSONL 文件路径', 'last_runs.jsonl')
  .option('-o, --owners <path>', '负责人 CSV 文件路径', 'owners.csv');

interface GlobalOptions {
  expectedJobs: string;
  launchAgentsDir: string;
  cronDump: string;
  lastRuns: string;
  owners: string;
}

function getGlobalOptions(): GlobalOptions {
  const opts = program.opts();
  return {
    expectedJobs: opts.expectedJobs,
    launchAgentsDir: opts.launchAgentsDir,
    cronDump: opts.cronDump,
    lastRuns: opts.lastRuns,
    owners: opts.owners
  };
}

function printValidationErrors(errors: ValidationError[]): void {
  if (errors.length === 0) {
    console.log(chalk.green('✓ 所有文件验证通过'));
    return;
  }

  console.log(chalk.red(`✗ 发现 ${errors.length} 个验证错误:`));
  console.log('');

  for (const error of errors) {
    let msg = `  ${chalk.red('•')} 文件: ${chalk.yellow(error.file)}`;
    if (error.line) {
      msg += `, 行号: ${chalk.cyan(error.line.toString())}`;
    }
    if (error.field) {
      msg += `, 字段: ${chalk.magenta(error.field)}`;
    }
    console.log(msg);
    console.log(`    ${error.message}`);
    console.log('');
  }
}

function printIssueSummary(report: AuditReport): void {
  console.log('');
  console.log(chalk.bold('问题统计:'));
  console.log('');

  const { critical, high, medium, low } = report.issuesBySeverity;
  
  console.log(`  ${chalk.red('🔴 Critical:')} ${critical}`);
  console.log(`  ${chalk.yellow('🟠 High:')} ${high}`);
  console.log(`  ${chalk.yellow('🟡 Medium:')} ${medium}`);
  console.log(`  ${chalk.green('🟢 Low:')} ${low}`);
  console.log('');

  console.log(`总任务数: ${report.totalJobs}`);
  console.log(`有问题的任务: ${report.jobsWithIssues}`);
  console.log(`无问题的任务: ${report.jobsWithoutIssues}`);
  console.log(`SLA 合规率: ${report.slaCompliance.toFixed(1)}%`);
  console.log('');
}

async function parseAllFiles(options: GlobalOptions): Promise<{
  validationErrors: ValidationError[];
  rebuildInput: RebuildInput | null;
}> {
  const validationErrors: ValidationError[] = [];

  const yamlResult = parseExpectedJobsYaml(options.expectedJobs);
  if (!yamlResult.validation.valid) {
    validationErrors.push(...yamlResult.validation.errors);
  }

  const plistFiles = getPlistFilesInDirectory(options.launchAgentsDir);
  const launchAgents: RebuildInput['launchAgents'] = [];

  for (const plistPath of plistFiles) {
    const plistResult = parsePlistFile(plistPath);
    if (!plistResult.validation.valid) {
      validationErrors.push(...plistResult.validation.errors);
    }
    if (plistResult.plist) {
      launchAgents.push({
        plist: plistResult.plist,
        filePath: plistPath
      });
    }
  }

  let cronJobs: RebuildInput['cronJobs'] = [];
  if (fs.existsSync(options.cronDump)) {
    const cronResult = parseCronDump(options.cronDump);
    if (!cronResult.validation.valid) {
      validationErrors.push(...cronResult.validation.errors);
    }
    cronJobs = cronResult.jobs.map(job => ({
      job,
      filePath: options.cronDump
    }));
  }

  let lastRuns: RebuildInput['lastRuns'] = [];
  if (fs.existsSync(options.lastRuns)) {
    const jsonlResult = parseLastRunsJsonl(options.lastRuns);
    if (!jsonlResult.validation.valid) {
      validationErrors.push(...jsonlResult.validation.errors);
    }
    lastRuns = jsonlResult.runs;
  }

  let owners: RebuildInput['owners'] = [];
  if (fs.existsSync(options.owners)) {
    const csvResult = await parseOwnersCsv(options.owners);
    if (!csvResult.validation.valid) {
      validationErrors.push(...csvResult.validation.errors);
    }
    owners = csvResult.owners;
  }

  const rebuildInput: RebuildInput = {
    expectedJobs: yamlResult.jobs,
    launchAgents,
    cronJobs,
    lastRuns,
    owners
  };

  return {
    validationErrors,
    rebuildInput
  };
}

program
  .command('validate')
  .description('验证所有输入文件的格式和内容')
  .action(async () => {
    const options = getGlobalOptions();
    
    console.log(chalk.bold('📋 验证输入文件...'));
    console.log('');

    const { validationErrors } = await parseAllFiles(options);
    
    printValidationErrors(validationErrors);

    if (validationErrors.length > 0) {
      process.exit(1);
    }

    console.log(chalk.green('✓ 所有文件验证成功!'));
  });

program
  .command('audit')
  .description('执行完整的任务巡检')
  .option('--json', '以 JSON 格式输出结果')
  .action(async (cmd) => {
    const options = getGlobalOptions();
    const outputJson = cmd.json as boolean;
    
    if (!outputJson) {
      console.log(chalk.bold('🔍 执行任务巡检...'));
      console.log('');
    }

    const { validationErrors, rebuildInput } = await parseAllFiles(options);

    if (validationErrors.length > 0 && !outputJson) {
      printValidationErrors(validationErrors);
      console.log(chalk.yellow('⚠ 存在验证错误，但继续执行巡检...'));
      console.log('');
    }

    if (!rebuildInput) {
      console.error(chalk.red('✗ 无法解析输入文件'));
      process.exit(1);
    }

    const rebuildResult = rebuildAllJobs(rebuildInput);
    const auditsWithIssues = detectAllIssues(rebuildResult.audits);
    const report = generateAuditReport(auditsWithIssues);

    if (outputJson) {
      console.log(JSON.stringify({
        report,
        validationErrors
      }, null, 2));
    } else {
      printIssueSummary(report);

      const criticalIssues = auditsWithIssues.filter(a => 
        a.issues.some(i => i.severity === 'critical')
      );

      if (criticalIssues.length > 0) {
        console.log(chalk.red.bold('🔴 Critical 问题详情:'));
        console.log('');
        for (const audit of criticalIssues) {
          const critIssues = audit.issues.filter(i => i.severity === 'critical');
          console.log(`  ${chalk.bold(audit.jobName)}:`);
          for (const issue of critIssues) {
            console.log(`    - ${issue.type}: ${issue.message}`);
          }
          console.log('');
        }
      }

      if (report.issuesBySeverity.critical > 0 || report.issuesBySeverity.high > 0) {
        console.log(chalk.yellow('⚠ 建议立即处理 Critical 和 High 级别的问题'));
      }
    }

    if (report.issuesBySeverity.critical > 0) {
      process.exit(2);
    }
  });

program
  .command('export')
  .description('导出巡检结果到文件')
  .option('--issues-csv <path>', '导出问题列表到 CSV 文件', 'issues.csv')
  .option('--report-md <path>', '导出巡检报告到 Markdown 文件', 'scheduler_audit.md')
  .action(async (cmd) => {
    const options = getGlobalOptions();
    const issuesCsvPath = cmd.issuesCsv as string;
    const reportMdPath = cmd.reportMd as string;
    
    console.log(chalk.bold('📤 导出巡检结果...'));
    console.log('');

    const { validationErrors, rebuildInput } = await parseAllFiles(options);

    if (!rebuildInput) {
      console.error(chalk.red('✗ 无法解析输入文件'));
      process.exit(1);
    }

    const rebuildResult = rebuildAllJobs(rebuildInput);
    const auditsWithIssues = detectAllIssues(rebuildResult.audits);
    const report = generateAuditReport(auditsWithIssues);

    const allIssues = auditsWithIssues.flatMap(a => a.issues);
    
    if (allIssues.length > 0) {
      console.log(`  导出问题列表到: ${chalk.cyan(issuesCsvPath)}`);
      await exportIssuesToCsv(auditsWithIssues, issuesCsvPath);
    } else {
      console.log(chalk.yellow('  没有发现问题，跳过 issues.csv 导出'));
    }

    console.log(`  导出巡检报告到: ${chalk.cyan(reportMdPath)}`);
    await exportAuditReportToMarkdown(report, reportMdPath, validationErrors);

    console.log('');
    console.log(chalk.green('✓ 导出完成!'));
    printIssueSummary(report);
  });

program.parse(process.argv);
