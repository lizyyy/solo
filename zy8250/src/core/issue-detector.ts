import * as path from 'path';
import * as fs from 'fs';
import { JobAudit, Issue, IssueType, IssueSeverity, ExpectedJob } from '../types';
import { createIssue, isScriptPathValid } from '../utils';
import { getLastRunTime, getTimeSinceLastRun } from './job-rebuilder';

export function detectAllIssues(audits: JobAudit[]): JobAudit[] {
  return audits.map(audit => detectIssuesForJob(audit, audits));
}

function detectIssuesForJob(jobAudit: JobAudit, allAudits: JobAudit[]): JobAudit {
  const issues: Issue[] = [];

  issues.push(...detectMissingJobs(jobAudit));
  issues.push(...detectDisabledJob(jobAudit));
  issues.push(...detectScheduleMismatch(jobAudit));
  issues.push(...detectCommandMismatch(jobAudit));
  issues.push(...detectEnvironmentMismatch(jobAudit));
  issues.push(...detectOwnerMismatch(jobAudit));
  issues.push(...detectEnabledMismatch(jobAudit));
  issues.push(...detectSlaViolation(jobAudit));
  issues.push(...detectScriptPathInvalid(jobAudit));
  issues.push(...detectTimezoneMismatch(jobAudit));
  issues.push(...detectDuplicateTrigger(jobAudit, allAudits));
  issues.push(...detectUnexpectedJob(jobAudit));

  return {
    ...jobAudit,
    issues
  };
}

function detectMissingJobs(jobAudit: JobAudit): Issue[] {
  const issues: Issue[] = [];

  if (jobAudit.expected && !jobAudit.actual) {
    issues.push(createIssue(
      jobAudit.jobName,
      'ACTUAL_MISSING',
      'critical',
      `预期任务 "${jobAudit.jobName}" 在实际系统中不存在`,
      {
        expected: {
          type: jobAudit.expected.type,
          schedule: jobAudit.expected.schedule,
          command: jobAudit.expected.command
        }
      }
    ));
  }

  if (!jobAudit.expected && jobAudit.actual) {
    issues.push(createIssue(
      jobAudit.jobName,
      'EXPECTED_MISSING',
      'high',
      `实际任务 "${jobAudit.jobName}" 不在预期配置中`,
      {
        actual: {
          type: jobAudit.type,
          schedule: jobAudit.actual.schedule,
          command: jobAudit.actual.command
        }
      }
    ));
  }

  return issues;
}

function detectDisabledJob(jobAudit: JobAudit): Issue[] {
  const issues: Issue[] = [];

  if (jobAudit.actual && !jobAudit.actual.enabled) {
    issues.push(createIssue(
      jobAudit.jobName,
      'DISABLED',
      'high',
      `任务 "${jobAudit.jobName}" 已被禁用`,
      {
        plistPath: jobAudit.actual.plistPath
      }
    ));
  }

  return issues;
}

function detectScheduleMismatch(jobAudit: JobAudit): Issue[] {
  const issues: Issue[] = [];

  if (jobAudit.expected && jobAudit.actual) {
    const expectedSchedule = jobAudit.expected.schedule;
    const actualSchedule = jobAudit.actual.schedule;

    if (!areSchedulesEquivalent(expectedSchedule, actualSchedule)) {
      issues.push(createIssue(
        jobAudit.jobName,
        'SCHEDULE_MISMATCH',
        'high',
        `任务 "${jobAudit.jobName}" 计划时间不匹配`,
        {
          expected: expectedSchedule,
          actual: actualSchedule
        }
      ));
    }
  }

  return issues;
}

function detectCommandMismatch(jobAudit: JobAudit): Issue[] {
  const issues: Issue[] = [];

  if (jobAudit.expected && jobAudit.actual) {
    const expectedCommand = jobAudit.expected.command.trim();
    const actualCommand = jobAudit.actual.command.trim();

    if (expectedCommand !== actualCommand) {
      issues.push(createIssue(
        jobAudit.jobName,
        'COMMAND_MISMATCH',
        'high',
        `任务 "${jobAudit.jobName}" 命令不匹配`,
        {
          expected: expectedCommand,
          actual: actualCommand
        }
      ));
    }
  }

  return issues;
}

function detectEnvironmentMismatch(jobAudit: JobAudit): Issue[] {
  const issues: Issue[] = [];

  if (jobAudit.expected && jobAudit.actual) {
    const expectedEnv = jobAudit.expected.environment;
    const actualEnv = jobAudit.actual.environment;

    const allKeys = new Set([
      ...Object.keys(expectedEnv),
      ...Object.keys(actualEnv)
    ]);

    const differences: Record<string, { expected?: string; actual?: string }> = {};

    for (const key of allKeys) {
      const expectedValue = expectedEnv[key];
      const actualValue = actualEnv[key];

      if (expectedValue !== actualValue) {
        differences[key] = {
          expected: expectedValue,
          actual: actualValue
        };
      }
    }

    if (Object.keys(differences).length > 0) {
      issues.push(createIssue(
        jobAudit.jobName,
        'ENVIRONMENT_MISMATCH',
        'medium',
        `任务 "${jobAudit.jobName}" 环境变量不匹配`,
        {
          differences
        }
      ));
    }
  }

  return issues;
}

function detectOwnerMismatch(jobAudit: JobAudit): Issue[] {
  const issues: Issue[] = [];

  if (jobAudit.expected && jobAudit.ownerInfo) {
    const expectedOwner = jobAudit.expected.owner;
    const actualOwner = jobAudit.ownerInfo.owner;

    if (expectedOwner !== actualOwner) {
      issues.push(createIssue(
        jobAudit.jobName,
        'OWNER_MISMATCH',
        'medium',
        `任务 "${jobAudit.jobName}" 负责人不匹配`,
        {
          expected: expectedOwner,
          actual: actualOwner,
          ownerInfo: jobAudit.ownerInfo
        }
      ));
    }
  }

  return issues;
}

function detectEnabledMismatch(jobAudit: JobAudit): Issue[] {
  const issues: Issue[] = [];

  if (jobAudit.expected && jobAudit.actual) {
    const expectedEnabled = jobAudit.expected.enabled;
    const actualEnabled = jobAudit.actual.enabled;

    if (expectedEnabled !== actualEnabled) {
      issues.push(createIssue(
        jobAudit.jobName,
        'ENABLED_MISMATCH',
        'high',
        `任务 "${jobAudit.jobName}" 启用状态不匹配`,
        {
          expected: expectedEnabled,
          actual: actualEnabled
        }
      ));
    }
  }

  return issues;
}

function detectSlaViolation(jobAudit: JobAudit): Issue[] {
  const issues: Issue[] = [];

  if (jobAudit.expected && jobAudit.actual) {
    const slaSeconds = jobAudit.expected.sla;
    const timeSinceLastRun = getTimeSinceLastRun(jobAudit);

    if (timeSinceLastRun === null) {
      issues.push(createIssue(
        jobAudit.jobName,
        'SLA_VIOLATION',
        'critical',
        `任务 "${jobAudit.jobName}" 从未运行过，超过 SLA (${slaSeconds}秒)`,
        {
          slaSeconds,
          lastRun: '从未运行'
        }
      ));
    } else if (timeSinceLastRun > slaSeconds) {
      issues.push(createIssue(
        jobAudit.jobName,
        'SLA_VIOLATION',
        'critical',
        `任务 "${jobAudit.jobName}" 超过 SLA 未运行`,
        {
          slaSeconds,
          timeSinceLastRunSeconds: timeSinceLastRun,
          lastRunTimestamp: getLastRunTime(jobAudit)
        }
      ));
    }
  }

  return issues;
}

function detectScriptPathInvalid(jobAudit: JobAudit): Issue[] {
  const issues: Issue[] = [];

  if (jobAudit.actual) {
    const command = jobAudit.actual.command;
    const scriptPath = extractScriptPath(command);

    if (scriptPath && !isScriptPathValid(scriptPath)) {
      issues.push(createIssue(
        jobAudit.jobName,
        'SCRIPT_PATH_INVALID',
        'critical',
        `任务 "${jobAudit.jobName}" 脚本路径不存在`,
        {
          command,
          scriptPath
        }
      ));
    }
  }

  return issues;
}

function detectTimezoneMismatch(jobAudit: JobAudit): Issue[] {
  const issues: Issue[] = [];

  if (jobAudit.expected && jobAudit.actual) {
    const expectedEnv = jobAudit.expected.environment;
    const actualEnv = jobAudit.actual.environment;

    const expectedTZ = expectedEnv['TZ'] || expectedEnv['TIMEZONE'];
    const actualTZ = actualEnv['TZ'] || actualEnv['TIMEZONE'];

    if (expectedTZ && actualTZ && expectedTZ !== actualTZ) {
      issues.push(createIssue(
        jobAudit.jobName,
        'TIMEZONE_MISMATCH',
        'high',
        `任务 "${jobAudit.jobName}" 时区配置不匹配，可能导致跨时区误判`,
        {
          expected: expectedTZ,
          actual: actualTZ
        }
      ));
    }
  }

  return issues;
}

function detectDuplicateTrigger(jobAudit: JobAudit, allAudits: JobAudit[]): Issue[] {
  const issues: Issue[] = [];

  if (!jobAudit.actual) {
    return issues;
  }

  const sameScheduleJobs = allAudits.filter(other => {
    if (other.jobName === jobAudit.jobName) {
      return false;
    }
    if (!other.actual) {
      return false;
    }
    return areSchedulesEquivalent(
      jobAudit.actual!.schedule,
      other.actual.schedule
    );
  });

  if (sameScheduleJobs.length > 0) {
    issues.push(createIssue(
      jobAudit.jobName,
      'DUPLICATE_TRIGGER',
      'medium',
      `任务 "${jobAudit.jobName}" 与其他任务有相同的触发时间`,
      {
        schedule: jobAudit.actual.schedule,
        duplicateJobs: sameScheduleJobs.map(j => j.jobName)
      }
    ));
  }

  return issues;
}

function detectUnexpectedJob(jobAudit: JobAudit): Issue[] {
  const issues: Issue[] = [];

  if (!jobAudit.expected && jobAudit.actual) {
    issues.push(createIssue(
      jobAudit.jobName,
      'UNEXPECTED_JOB',
      'medium',
      `发现未预期的任务 "${jobAudit.jobName}"，不在预期配置中`,
      {
        type: jobAudit.type,
        schedule: jobAudit.actual.schedule,
        command: jobAudit.actual.command
      }
    ));
  }

  return issues;
}

function areSchedulesEquivalent(schedule1: string, schedule2: string): boolean {
  const norm1 = normalizeSchedule(schedule1);
  const norm2 = normalizeSchedule(schedule2);
  return norm1 === norm2;
}

function normalizeSchedule(schedule: string): string {
  let normalized = schedule.trim();
  normalized = normalized.replace(/\s+/g, ' ');
  normalized = normalized.toLowerCase();
  return normalized;
}

function extractScriptPath(command: string): string | null {
  const parts = command.split(/\s+/);
  if (parts.length === 0) {
    return null;
  }

  const firstPart = parts[0];
  
  if (firstPart.startsWith('/') || firstPart.startsWith('~') || firstPart.startsWith('./')) {
    return firstPart;
  }

  for (const part of parts) {
    if (part.endsWith('.sh') || part.endsWith('.py') || 
        part.endsWith('.js') || part.endsWith('.rb')) {
      return part;
    }
  }

  return null;
}
