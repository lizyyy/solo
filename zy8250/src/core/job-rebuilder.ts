import * as path from 'path';
import { 
  ExpectedJob, 
  LaunchAgentPlist, 
  CronJob, 
  LastRun, 
  Owner, 
  JobAudit,
  ValidationError
} from '../types';
import { convertPlistToSchedule, convertPlistToCommand } from '../parsers/plist-parser';
import { convertCronToSchedule } from '../parsers/cron-parser';
import { getLastRunForJob } from '../parsers/jsonl-parser';
import { findOwnerByJobName } from '../parsers/csv-parser';

export interface RebuildResult {
  audits: JobAudit[];
  errors: ValidationError[];
}

export interface RebuildInput {
  expectedJobs: ExpectedJob[];
  launchAgents: { plist: LaunchAgentPlist; filePath: string }[];
  cronJobs: { job: CronJob; filePath: string }[];
  lastRuns: LastRun[];
  owners: Owner[];
}

export function rebuildAllJobs(input: RebuildInput): RebuildResult {
  const audits: JobAudit[] = [];
  const errors: ValidationError[] = [];

  const expectedJobMap = new Map<string, ExpectedJob>();
  const launchAgentMap = new Map<string, { plist: LaunchAgentPlist; filePath: string }>();
  const cronJobMap = new Map<string, { job: CronJob; filePath: string }>();

  for (const job of input.expectedJobs) {
    expectedJobMap.set(job.name, job);
  }

  for (const agent of input.launchAgents) {
    launchAgentMap.set(agent.plist.Label, agent);
  }

  for (const cron of input.cronJobs) {
    const jobName = generateCronJobName(cron.job);
    cronJobMap.set(jobName, cron);
  }

  const allJobNames = new Set<string>();
  for (const name of expectedJobMap.keys()) allJobNames.add(name);
  for (const name of launchAgentMap.keys()) allJobNames.add(name);
  for (const name of cronJobMap.keys()) allJobNames.add(name);

  for (const jobName of allJobNames) {
    const audit = rebuildSingleJob(
      jobName,
      expectedJobMap,
      launchAgentMap,
      cronJobMap,
      input.lastRuns,
      input.owners
    );
    audits.push(audit);
  }

  return { audits, errors };
}

function rebuildSingleJob(
  jobName: string,
  expectedJobMap: Map<string, ExpectedJob>,
  launchAgentMap: Map<string, { plist: LaunchAgentPlist; filePath: string }>,
  cronJobMap: Map<string, { job: CronJob; filePath: string }>,
  lastRuns: LastRun[],
  owners: Owner[]
): JobAudit {
  const expected = expectedJobMap.get(jobName) || null;
  
  const launchAgent = launchAgentMap.get(jobName);
  const cronJob = cronJobMap.get(jobName);
  
  const jobLastRuns = lastRuns.filter(run => run.jobName === jobName);
  const ownerInfo = findOwnerByJobName(owners, jobName);

  let actual: JobAudit['actual'] = null;
  let jobType: 'launchagent' | 'cron' = expected?.type || 'launchagent';

  if (launchAgent) {
    jobType = 'launchagent';
    actual = {
      schedule: convertPlistToSchedule(launchAgent.plist),
      command: convertPlistToCommand(launchAgent.plist),
      enabled: !launchAgent.plist.Disabled,
      environment: launchAgent.plist.EnvironmentVariables || {},
      plistPath: launchAgent.filePath
    };
  } else if (cronJob) {
    jobType = 'cron';
    actual = {
      schedule: convertCronToSchedule(cronJob.job),
      command: cronJob.job.command,
      enabled: true,
      environment: {}
    };
  }

  return {
    jobName,
    type: jobType,
    expected,
    actual,
    lastRuns: jobLastRuns,
    ownerInfo,
    issues: []
  };
}

function generateCronJobName(cronJob: CronJob): string {
  const commandParts = cronJob.command.split(/\s+/);
  if (commandParts.length > 0) {
    const scriptName = path.basename(commandParts[0]);
    return `cron_${scriptName.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  }
  return `cron_job_${cronJob.lineNumber}`;
}

export function getLastRunTime(jobAudit: JobAudit): number | null {
  if (jobAudit.lastRuns.length === 0) {
    return null;
  }
  const sortedRuns = [...jobAudit.lastRuns].sort((a, b) => b.timestamp - a.timestamp);
  return sortedRuns[0].timestamp;
}

export function getTimeSinceLastRun(jobAudit: JobAudit): number | null {
  const lastRunTime = getLastRunTime(jobAudit);
  if (lastRunTime === null) {
    return null;
  }
  return Math.floor((Date.now() - lastRunTime) / 1000);
}
