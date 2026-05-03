import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { glob } from 'glob';
import { GitHubWorkflow, Job, Step, WorkflowTrigger } from '../types';

export class WorkflowParser {
  private workflowsDir: string;
  
  constructor(workflowsDir: string) {
    this.workflowsDir = workflowsDir;
  }

  async parseAll(): Promise<GitHubWorkflow[]> {
    const pattern = path.join(this.workflowsDir, '*.{yml,yaml}');
    const files = await glob(pattern);
    
    if (files.length === 0) {
      console.warn(`警告: 在 ${this.workflowsDir} 中未找到工作流文件`);
      return [];
    }

    const workflows: GitHubWorkflow[] = [];
    
    for (const file of files) {
      try {
        const workflow = await this.parseFile(file);
        workflows.push(workflow);
      } catch (error) {
        console.error(`解析工作流文件 ${file} 时出错:`, error);
      }
    }

    return workflows;
  }

  async parseFile(filePath: string): Promise<GitHubWorkflow> {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const filename = path.basename(filePath);
    
    let parsed: unknown;
    try {
      parsed = yaml.load(content, { filename });
    } catch (error) {
      throw new Error(`YAML 解析失败: ${filePath} - ${(error as Error).message}`);
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new Error(`无效的工作流格式: ${filePath}`);
    }

    const workflowObj = parsed as Record<string, unknown>;
    
    return {
      name: (workflowObj['name'] as string) || filename,
      filename,
      on: this.parseTrigger(workflowObj['on']),
      jobs: this.parseJobs(workflowObj['jobs']),
      env: workflowObj['env'] as Record<string, string> | undefined,
      defaults: workflowObj['defaults'] as Record<string, unknown> | undefined,
      rawContent: content
    };
  }

  private parseTrigger(triggerData: unknown): WorkflowTrigger {
    if (!triggerData) {
      return {};
    }

    if (typeof triggerData === 'string') {
      return this.parseSingleTriggerType(triggerData);
    }

    if (Array.isArray(triggerData)) {
      const result: WorkflowTrigger = {};
      for (const item of triggerData) {
        const parsed = this.parseSingleTriggerType(item);
        Object.assign(result, parsed);
      }
      return result;
    }

    if (typeof triggerData === 'object') {
      const trigger: WorkflowTrigger = {};
      const triggerObj = triggerData as Record<string, unknown>;

      if (triggerObj['push']) {
        trigger.push = this.parsePushTrigger(triggerObj['push']);
      }
      if (triggerObj['pull_request']) {
        trigger.pull_request = this.parsePullRequestTrigger(triggerObj['pull_request']);
      }
      if (triggerObj['workflow_dispatch'] !== undefined) {
        trigger.workflow_dispatch = this.parseWorkflowDispatchTrigger(triggerObj['workflow_dispatch']);
      }
      if (triggerObj['schedule']) {
        trigger.schedule = this.parseScheduleTrigger(triggerObj['schedule']);
      }
      if (triggerObj['workflow_call'] !== undefined) {
        trigger.workflow_call = this.parseWorkflowCallTrigger(triggerObj['workflow_call']);
      }
      if (triggerObj['repository_dispatch']) {
        trigger.repository_dispatch = this.parseRepositoryDispatchTrigger(triggerObj['repository_dispatch']);
      }
      if (triggerObj['concurrency'] !== undefined) {
        trigger.concurrency = this.parseConcurrencyConfig(triggerObj['concurrency']) as string;
      }

      return trigger;
    }

    return {};
  }

  private parseSingleTriggerType(type: string): WorkflowTrigger {
    switch (type) {
      case 'push':
        return { push: {} };
      case 'pull_request':
        return { pull_request: {} };
      case 'workflow_dispatch':
        return { workflow_dispatch: {} };
      case 'schedule':
        return { schedule: [{ cron: '0 0 * * *' }] };
      case 'workflow_call':
        return { workflow_call: {} };
      case 'repository_dispatch':
        return { repository_dispatch: {} };
      default:
        return {};
    }
  }

  private parsePushTrigger(data: unknown): Partial<Record<string, unknown>> {
    if (typeof data === 'object' && data !== null) {
      return data as Partial<Record<string, unknown>>;
    }
    return {};
  }

  private parsePullRequestTrigger(data: unknown): Partial<Record<string, unknown>> {
    if (typeof data === 'object' && data !== null) {
      return data as Partial<Record<string, unknown>>;
    }
    return {};
  }

  private parseWorkflowDispatchTrigger(data: unknown): Partial<Record<string, unknown>> {
    if (typeof data === 'object' && data !== null) {
      return data as Partial<Record<string, unknown>>;
    }
    return {};
  }

  private parseScheduleTrigger(data: unknown): Array<{ cron: string }> {
    if (Array.isArray(data)) {
      return data.map(item => {
        if (typeof item === 'object' && item !== null && 'cron' in item) {
          return { cron: (item as { cron: string }).cron };
        }
        return { cron: '0 0 * * *' };
      });
    }
    return [];
  }

  private parseWorkflowCallTrigger(data: unknown): Partial<Record<string, unknown>> {
    if (typeof data === 'object' && data !== null) {
      return data as Partial<Record<string, unknown>>;
    }
    return {};
  }

  private parseRepositoryDispatchTrigger(data: unknown): Partial<Record<string, unknown>> {
    if (typeof data === 'object' && data !== null) {
      return data as Partial<Record<string, unknown>>;
    }
    return {};
  }

  private parseConcurrencyConfig(data: unknown): unknown {
    if (typeof data === 'string') {
      return data;
    }
    if (typeof data === 'object' && data !== null) {
      return data;
    }
    return undefined;
  }

  private parseJobs(jobsData: unknown): Record<string, Job> {
    if (!jobsData || typeof jobsData !== 'object') {
      return {};
    }

    const jobs: Record<string, Job> = {};
    const jobsObj = jobsData as Record<string, unknown>;

    for (const [jobName, jobData] of Object.entries(jobsObj)) {
      if (typeof jobData === 'object' && jobData !== null) {
        jobs[jobName] = this.parseJob(jobData as Record<string, unknown>);
      }
    }

    return jobs;
  }

  private parseJob(jobData: Record<string, unknown>): Job {
    const job: Partial<Job> = {};

    if (jobData['name'] !== undefined) {
      job.name = jobData['name'] as string;
    }
    if (jobData['runs-on'] !== undefined) {
      job.runs_on = jobData['runs-on'] as string | string[];
    }
    if (jobData['needs'] !== undefined) {
      job.needs = jobData['needs'] as string | string[];
    }
    if (jobData['if'] !== undefined) {
      job.if = jobData['if'] as string;
    }
    if (jobData['env'] !== undefined) {
      job.env = jobData['env'] as Record<string, string>;
    }
    if (jobData['steps'] !== undefined) {
      job.steps = this.parseSteps(jobData['steps']);
    } else {
      job.steps = [];
    }
    if (jobData['strategy'] !== undefined) {
      job.strategy = jobData['strategy'] as Partial<Record<string, unknown>>;
    }
    if (jobData['concurrency'] !== undefined) {
      job.concurrency = this.parseConcurrencyConfig(jobData['concurrency']) as unknown;
    }
    if (jobData['uses'] !== undefined) {
      job.uses = jobData['uses'] as string;
    }
    if (jobData['with'] !== undefined) {
      job.with = jobData['with'] as Record<string, string | number | boolean>;
    }
    if (jobData['secrets'] !== undefined) {
      job.secrets = jobData['secrets'] as Record<string, string> | string;
    }
    if (jobData['timeout-minutes'] !== undefined) {
      job.timeout_minutes = jobData['timeout-minutes'] as number;
    }
    if (jobData['permissions'] !== undefined) {
      job.permissions = jobData['permissions'] as Record<string, string>;
    }
    if (jobData['environment'] !== undefined) {
      job.environment = jobData['environment'] as Partial<Record<string, unknown>> | string;
    }

    return job as Job;
  }

  private parseSteps(stepsData: unknown): Step[] {
    if (!Array.isArray(stepsData)) {
      return [];
    }

    const steps: Step[] = [];

    for (const stepData of stepsData) {
      if (typeof stepData === 'object' && stepData !== null) {
        const step: Partial<Step> = {};
        const stepObj = stepData as Record<string, unknown>;

        if (stepObj['name'] !== undefined) {
          step.name = stepObj['name'] as string;
        }
        if (stepObj['id'] !== undefined) {
          step.id = stepObj['id'] as string;
        }
        if (stepObj['uses'] !== undefined) {
          step.uses = stepObj['uses'] as string;
        }
        if (stepObj['run'] !== undefined) {
          step.run = stepObj['run'] as string;
        }
        if (stepObj['shell'] !== undefined) {
          step.shell = stepObj['shell'] as string;
        }
        if (stepObj['working-directory'] !== undefined) {
          step.working_directory = stepObj['working-directory'] as string;
        }
        if (stepObj['env'] !== undefined) {
          step.env = stepObj['env'] as Record<string, string>;
        }
        if (stepObj['with'] !== undefined) {
          step.with = stepObj['with'] as Record<string, string | number | boolean>;
        }
        if (stepObj['if'] !== undefined) {
          step.if = stepObj['if'] as string;
        }
        if (stepObj['continue-on-error'] !== undefined) {
          step.continue_on_error = stepObj['continue-on-error'] as boolean;
        }
        if (stepObj['timeout-minutes'] !== undefined) {
          step.timeout_minutes = stepObj['timeout-minutes'] as number;
        }

        steps.push(step as Step);
      }
    }

    return steps;
  }

  getTriggerTypes(workflow: GitHubWorkflow): string[] {
    const types: string[] = [];
    const trigger = workflow.on;

    if (trigger.push) types.push('push');
    if (trigger.pull_request) types.push('pull_request');
    if (trigger.workflow_dispatch) types.push('workflow_dispatch');
    if (trigger.schedule && trigger.schedule.length > 0) types.push('schedule');
    if (trigger.workflow_call) types.push('workflow_call');
    if (trigger.repository_dispatch) types.push('repository_dispatch');

    return types;
  }

  isReusableWorkflow(workflow: GitHubWorkflow): boolean {
    return workflow.on.workflow_call !== undefined;
  }

  usesReusableWorkflow(job: Job): boolean {
    return job.uses !== undefined && job.uses.startsWith('./') || 
           (job.uses !== undefined && job.uses.includes('/'));
  }

  getJobEnvironment(job: Job): string | null {
    if (!job.environment) return null;
    
    if (typeof job.environment === 'string') {
      return job.environment;
    }
    
    if (typeof job.environment === 'object' && 'name' in job.environment) {
      return (job.environment as { name: string }).name;
    }
    
    return null;
  }

  extractSecretReferences(content: string): string[] {
    const secretPattern = /\${{\s*secrets\.([A-Za-z0-9_]+)\s*}}/g;
    const secrets: string[] = [];
    let match;

    while ((match = secretPattern.exec(content)) !== null) {
      if (!secrets.includes(match[1])) {
        secrets.push(match[1]);
      }
    }

    return secrets;
  }

  extractSecretsFromJob(job: Job): string[] {
    const secrets: string[] = [];

    if (job.env) {
      for (const value of Object.values(job.env)) {
        if (typeof value === 'string') {
          const found = this.extractSecretReferences(value);
          secrets.push(...found.filter(s => !secrets.includes(s)));
        }
      }
    }

    if (job.with) {
      for (const value of Object.values(job.with)) {
        if (typeof value === 'string') {
          const found = this.extractSecretReferences(value);
          secrets.push(...found.filter(s => !secrets.includes(s)));
        }
      }
    }

    const steps = job.steps || [];
    for (const step of steps) {
      if (step.env) {
        for (const value of Object.values(step.env)) {
          if (typeof value === 'string') {
            const found = this.extractSecretReferences(value);
            secrets.push(...found.filter(s => !secrets.includes(s)));
          }
        }
      }
      
      if (step.with) {
        for (const value of Object.values(step.with)) {
          if (typeof value === 'string') {
            const found = this.extractSecretReferences(value);
            secrets.push(...found.filter(s => !secrets.includes(s)));
          }
        }
      }

      if (step.run) {
        const found = this.extractSecretReferences(step.run);
        secrets.push(...found.filter(s => !secrets.includes(s)));
      }
    }

    return secrets;
  }

  getBranchesFromTrigger(workflow: GitHubWorkflow): { included: string[]; excluded: string[] } {
    const included: string[] = [];
    const excluded: string[] = [];

    const processBranches = (trigger: { branches?: string[]; branches_ignore?: string[] } | undefined) => {
      if (trigger?.branches) {
        included.push(...trigger.branches.filter(b => !included.includes(b)));
      }
      if (trigger?.branches_ignore) {
        excluded.push(...trigger.branches_ignore.filter(b => !excluded.includes(b)));
      }
    };

    if (workflow.on.push) {
      processBranches(workflow.on.push);
    }
    if (workflow.on.pull_request) {
      processBranches(workflow.on.pull_request);
    }

    return { included, excluded };
  }
}
