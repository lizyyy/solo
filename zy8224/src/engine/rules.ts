import {
  GitHubWorkflow,
  Step,
  Issue,
  EnvironmentManifest,
  SecretWhitelist,
  ApprovalRule,
  WorkflowSummary
} from '../types';
import { WorkflowParser } from '../parser/workflow';
import { ConfigParser } from '../parser/config';

export interface RuleEngineConfig {
  workflows: GitHubWorkflow[];
  environments: EnvironmentManifest;
  secretWhitelist: SecretWhitelist;
  approvalRules: ApprovalRule;
}

export class RuleEngine {
  private config: RuleEngineConfig;
  private workflowParser: WorkflowParser;
  private configParser: ConfigParser;
  private issueCounter: number;

  constructor(config: RuleEngineConfig, workflowsDir: string) {
    this.config = config;
    this.workflowParser = new WorkflowParser(workflowsDir);
    this.configParser = new ConfigParser();
    this.issueCounter = 0;
  }

  private generateIssueId(): string {
    return `ISSUE-${String(++this.issueCounter).padStart(4, '0')}`;
  }

  async runAllRules(): Promise<{ issues: Issue[]; workflowSummaries: WorkflowSummary[] }> {
    const issues: Issue[] = [];
    const workflowSummaries: WorkflowSummary[] = [];

    for (const workflow of this.config.workflows) {
      const workflowIssues = await this.checkWorkflow(workflow);
      issues.push(...workflowIssues);

      workflowSummaries.push(this.createWorkflowSummary(workflow));
    }

    const crossWorkflowIssues = this.checkCrossWorkflowIssues();
    issues.push(...crossWorkflowIssues);

    return { issues, workflowSummaries };
  }

  private async checkWorkflow(workflow: GitHubWorkflow): Promise<Issue[]> {
    const issues: Issue[] = [];

    issues.push(...this.checkSecretExposure(workflow));
    issues.push(...this.checkMatrixCoverage(workflow));
    issues.push(...this.checkConcurrencyConflicts(workflow));
    issues.push(...this.checkArtifactExpiration(workflow));
    issues.push(...this.checkApprovalMissing(workflow));

    return issues;
  }

  private checkSecretExposure(workflow: GitHubWorkflow): Issue[] {
    const issues: Issue[] = [];
    const triggerTypes = this.workflowParser.getTriggerTypes(workflow);
    const { included, excluded } = this.workflowParser.getBranchesFromTrigger(workflow);

    const nonProdBranches = this.getNonProdBranches();
    const prodBranches = this.getProdBranches();

    const canRunOnNonProdBranches = this.canTriggerRunOnBranches(
      triggerTypes,
      included,
      excluded,
      nonProdBranches
    );

    if (!canRunOnNonProdBranches) {
      return issues;
    }

    const restrictsToProdBranches = this.restrictsToBranches(
      included,
      excluded,
      prodBranches
    );

    if (restrictsToProdBranches) {
      return issues;
    }

    for (const [jobName, job] of Object.entries(workflow.jobs)) {
      const jobSecrets = this.workflowParser.extractSecretsFromJob(job);
      const jobEnvironment = this.workflowParser.getJobEnvironment(job);

      for (const secret of jobSecrets) {
        if (this.configParser.isProdSecret(secret, this.config.secretWhitelist)) {
          const isAllowed = jobEnvironment 
            ? this.configParser.isSecretAllowedForEnvironment(
                secret, 
                jobEnvironment, 
                this.config.secretWhitelist
              )
            : false;

          if (!isAllowed) {
            issues.push({
              id: this.generateIssueId(),
              category: 'secret_exposure',
              severity: 'critical',
              workflow: workflow.name,
              job: jobName,
              title: 'Prod Secret 可能暴露到非 Prod 分支',
              description: `Job "${jobName}" 使用了 prod secret "${secret}"，` +
                          `但工作流可能在非 prod 分支上运行。` +
                          `触发类型: ${triggerTypes.join(', ')}`,
              remediation: '建议添加 branch 限制或使用 environment 来保护 prod secret',
              location: { line: this.findLineNumber(workflow.rawContent, jobName) }
            });
          }
        }
      }
    }

    return issues;
  }

  private checkMatrixCoverage(workflow: GitHubWorkflow): Issue[] {
    const issues: Issue[] = [];

    for (const [jobName, job] of Object.entries(workflow.jobs)) {
      const strategy = job.strategy as { matrix?: unknown } | undefined;
      if (!strategy?.matrix) {
        continue;
      }

      const matrix = strategy.matrix as Record<string, unknown>;
      const matrixKeys = Object.keys(matrix).filter(k => 
        k !== 'include' && k !== 'exclude'
      );

      if (matrixKeys.length === 0) {
        continue;
      }

      const baseMatrix: Record<string, (string | number)[]> = {};
      for (const key of matrixKeys) {
        const value = matrix[key];
        if (Array.isArray(value)) {
          baseMatrix[key] = value;
        }
      }

      const expectedCombinations = this.calculateCombinations(baseMatrix);
      
      const include = matrix.include as Array<Record<string, string | number>> | undefined;
      const exclude = matrix.exclude as Array<Record<string, string | number>> | undefined;

      if (include && include.length > 0) {
        for (const included of include) {
          const missingKeys = matrixKeys.filter(k => !(k in included));
          if (missingKeys.length > 0) {
            issues.push({
              id: this.generateIssueId(),
              category: 'matrix_coverage',
              severity: 'medium',
              workflow: workflow.name,
              job: jobName,
              title: 'Matrix include 缺少维度',
              description: `Job "${jobName}" 的 matrix.include 条目缺少维度: ${missingKeys.join(', ')}。` +
                          `这可能导致某些组合被跳过。`,
              remediation: '确保所有 matrix include 条目包含完整的维度值'
            });
          }
        }
      }

      if (exclude && exclude.length > 0) {
        for (const excluded of exclude) {
          const validKeys = Object.keys(excluded).filter(k => matrixKeys.includes(k));
          if (validKeys.length === 0) {
            issues.push({
              id: this.generateIssueId(),
              category: 'matrix_coverage',
              severity: 'low',
              workflow: workflow.name,
              job: jobName,
              title: 'Matrix exclude 维度不匹配',
              description: `Job "${jobName}" 的 matrix.exclude 包含不存在的维度。`,
              remediation: '检查 matrix exclude 中的维度名称是否正确'
            });
          }
        }
      }

      const hasEmptyArray = Object.entries(baseMatrix).some(([_, values]) => 
        values.length === 0
      );

      if (hasEmptyArray) {
        issues.push({
          id: this.generateIssueId(),
          category: 'matrix_coverage',
          severity: 'high',
          workflow: workflow.name,
          job: jobName,
          title: 'Matrix 维度为空数组',
          description: `Job "${jobName}" 的某个 matrix 维度是空数组，这会导致 job 被跳过。`,
          remediation: '确保所有 matrix 维度至少有一个值'
        });
      }

      if (expectedCombinations === 0 && Object.keys(baseMatrix).length > 0) {
        issues.push({
          id: this.generateIssueId(),
          category: 'matrix_coverage',
          severity: 'critical',
          workflow: workflow.name,
          job: jobName,
          title: 'Matrix 将产生零个 job',
          description: `Job "${jobName}" 的 matrix 配置将产生零个 job 实例。`,
          remediation: '检查 matrix 配置，确保至少有一个有效组合'
        });
      }
    }

    return issues;
  }

  private checkConcurrencyConflicts(workflow: GitHubWorkflow): Issue[] {
    const issues: Issue[] = [];
    const concurrencyGroups: Map<string, { jobName: string; workflowName: string }[]> = new Map();

    if (workflow.on.concurrency) {
      const group = this.extractConcurrencyGroup(workflow.on.concurrency);
      if (group) {
        if (!concurrencyGroups.has(group)) {
          concurrencyGroups.set(group, []);
        }
        concurrencyGroups.get(group)!.push({
          jobName: '(workflow level)',
          workflowName: workflow.name
        });
      }
    }

    for (const [jobName, job] of Object.entries(workflow.jobs)) {
      if (job.concurrency) {
        const group = this.extractConcurrencyGroup(job.concurrency);
        if (group) {
          if (!concurrencyGroups.has(group)) {
            concurrencyGroups.set(group, []);
          }
          concurrencyGroups.get(group)!.push({
            jobName,
            workflowName: workflow.name
          });
        }
      }
    }

    for (const [group, usages] of concurrencyGroups) {
      if (usages.length > 1) {
        const hasStaticGroup = !this.containsDynamicVariable(group);
        
        if (hasStaticGroup) {
          const jobList = usages.map(u => u.jobName).join(', ');
          issues.push({
            id: this.generateIssueId(),
            category: 'concurrency_conflict',
            severity: 'medium',
            workflow: workflow.name,
            title: 'Concurrency 组可能导致竞争',
            description: `多个 job (${jobList}) 使用相同的静态 concurrency group "${group}"。` +
                        `这可能导致 job 被意外取消或排队。`,
            remediation: '考虑使用动态变量如 ${{ github.run_id }} 来区分并发组，' +
                        '或者确认这是预期行为并设置 cancel-in-progress 策略'
          });
        }
      }
    }

    return issues;
  }

  private checkArtifactExpiration(workflow: GitHubWorkflow): Issue[] {
    const issues: Issue[] = [];
    const ARTIFACT_ACTION = 'actions/upload-artifact';
    const DEFAULT_RETENTION_DAYS = 90;
    const WARNING_THRESHOLD_DAYS = 365;

    for (const [jobName, job] of Object.entries(workflow.jobs)) {
      const steps = job.steps || [];
      for (const [stepIndex, step] of steps.entries()) {
        if (step.uses && step.uses.startsWith(ARTIFACT_ACTION)) {
          const retentionDays = this.getRetentionDays(step);
          const stepName = step.name || `Step ${stepIndex + 1}`;

          if (retentionDays === undefined) {
            issues.push({
              id: this.generateIssueId(),
              category: 'artifact_expiration',
              severity: 'low',
              workflow: workflow.name,
              job: jobName,
              step: stepName,
              title: 'Artifact 未设置保留期',
              description: `Job "${jobName}" 中的 "${stepName}" 上传 artifact 但未指定 retention-days。` +
                          `将使用默认保留期 ${DEFAULT_RETENTION_DAYS} 天。`,
              remediation: '根据合规要求设置明确的 retention-days 值'
            });
          } else if (retentionDays > WARNING_THRESHOLD_DAYS) {
            issues.push({
              id: this.generateIssueId(),
              category: 'artifact_expiration',
              severity: 'medium',
              workflow: workflow.name,
              job: jobName,
              step: stepName,
              title: 'Artifact 保留期过长',
              description: `Job "${jobName}" 中的 "${stepName}" 设置了 ${retentionDays} 天的保留期，` +
                          `超过了建议阈值 ${WARNING_THRESHOLD_DAYS} 天。`,
              remediation: '考虑缩短 artifact 保留期或确认这符合数据保留政策'
            });
          } else if (retentionDays === 0) {
            issues.push({
              id: this.generateIssueId(),
              category: 'artifact_expiration',
              severity: 'high',
              workflow: workflow.name,
              job: jobName,
              step: stepName,
              title: 'Artifact 保留期为 0 天',
              description: `Job "${jobName}" 中的 "${stepName}" 设置了 0 天保留期。` +
                          `Artifact 将立即过期。`,
              remediation: '确认是否为预期行为，否则设置合适的 retention-days 值'
            });
          }
        }
      }
    }

    return issues;
  }

  private checkApprovalMissing(workflow: GitHubWorkflow): Issue[] {
    const issues: Issue[] = [];
    const triggerTypes = this.workflowParser.getTriggerTypes(workflow);

    const hasManualTrigger = triggerTypes.includes('workflow_dispatch') || 
                            triggerTypes.includes('repository_dispatch');
    const hasCronTrigger = triggerTypes.includes('schedule');

    for (const [jobName, job] of Object.entries(workflow.jobs)) {
      const jobEnvironment = this.workflowParser.getJobEnvironment(job);
      
      if (!jobEnvironment) {
        continue;
      }

      const isProdEnv = this.configParser.isProdEnvironment(
        jobEnvironment, 
        this.config.environments
      );

      if (!isProdEnv) {
        continue;
      }

      for (const triggerType of triggerTypes) {
        const needsApproval = this.configParser.requiresApproval(
          jobEnvironment,
          triggerType,
          this.config.approvalRules
        );

        if (needsApproval) {
          const hasEnvironmentConfig = typeof job.environment === 'object' && 
                                      'url' in (job.environment as object);

          if (!hasEnvironmentConfig && !this.hasEnvironmentProtection(jobEnvironment)) {
            const triggerDesc = hasCronTrigger ? '定时 (cron)' : 
                                hasManualTrigger ? '手动 (workflow_dispatch)' :
                                '自动';
            
            issues.push({
              id: this.generateIssueId(),
              category: 'approval_missing',
              severity: 'critical',
              workflow: workflow.name,
              job: jobName,
              title: 'Prod 环境部署缺少审批保护',
              description: `Job "${jobName}" 部署到 prod 环境 "${jobEnvironment}"，` +
                          `但未配置环境审批。触发方式: ${triggerDesc} (${triggerType})。`,
              remediation: '在 GitHub 环境设置中配置必需的审批者，' +
                          '或使用 environment 规则确保审批步骤'
            });
          }
        }
      }

      if (hasCronTrigger && isProdEnv) {
        issues.push({
          id: this.generateIssueId(),
          category: 'approval_missing',
          severity: 'high',
          workflow: workflow.name,
          job: jobName,
          title: 'Cron 触发可能绕过审批',
          description: `Job "${jobName}" 部署到 prod 环境 "${jobEnvironment}"，` +
                      `但工作流包含 cron 触发器。定时触发可能绕过手动审批流程。`,
          remediation: '考虑移除 prod 部署的 cron 触发器，或添加 if 条件限制分支'
        });
      }
    }

    return issues;
  }

  private checkCrossWorkflowIssues(): Issue[] {
    const issues: Issue[] = [];
    const allConcurrencyGroups: Map<string, { workflow: string; job: string }[]> = new Map();

    for (const workflow of this.config.workflows) {
      if (workflow.on.concurrency) {
        const group = this.extractConcurrencyGroup(workflow.on.concurrency);
        if (group && !this.containsDynamicVariable(group)) {
          if (!allConcurrencyGroups.has(group)) {
            allConcurrencyGroups.set(group, []);
          }
          allConcurrencyGroups.get(group)!.push({
            workflow: workflow.name,
            job: '(workflow level)'
          });
        }
      }

      for (const [jobName, job] of Object.entries(workflow.jobs)) {
        if (job.concurrency) {
          const group = this.extractConcurrencyGroup(job.concurrency);
          if (group && !this.containsDynamicVariable(group)) {
            if (!allConcurrencyGroups.has(group)) {
              allConcurrencyGroups.set(group, []);
            }
            allConcurrencyGroups.get(group)!.push({
              workflow: workflow.name,
              job: jobName
            });
          }
        }
      }
    }

    for (const [group, usages] of allConcurrencyGroups) {
      const uniqueWorkflows = new Set(usages.map(u => u.workflow));
      if (uniqueWorkflows.size > 1) {
        const workflowList = Array.from(uniqueWorkflows).join(', ');
        issues.push({
          id: this.generateIssueId(),
          category: 'concurrency_conflict',
          severity: 'high',
          workflow: '(cross-workflow)',
          title: '跨工作流 Concurrency 组冲突',
          description: `多个工作流 (${workflowList}) 使用相同的静态 concurrency group "${group}"。` +
                      `这可能导致不同工作流的 job 互相取消。`,
          remediation: '为每个工作流使用唯一的并发组，或添加工作流特定的前缀/后缀'
        });
      }
    }

    return issues;
  }

  private createWorkflowSummary(workflow: GitHubWorkflow): WorkflowSummary {
    const triggerTypes = this.workflowParser.getTriggerTypes(workflow);
    const environments = new Set<string>();

    for (const job of Object.values(workflow.jobs)) {
      const env = this.workflowParser.getJobEnvironment(job);
      if (env) {
        environments.add(env);
      }
    }

    return {
      name: workflow.name,
      filename: workflow.filename,
      triggerTypes,
      jobCount: Object.keys(workflow.jobs).length,
      hasWorkflowCall: this.workflowParser.isReusableWorkflow(workflow) ||
                       Object.values(workflow.jobs).some(j => this.workflowParser.usesReusableWorkflow(j)),
      environments: Array.from(environments)
    };
  }

  private getNonProdBranches(): string[] {
    const branches: string[] = [];
    for (const env of this.config.environments.environments) {
      if (env.type === 'non-prod') {
        branches.push(...env.branches);
      }
    }
    return branches;
  }

  private getProdBranches(): string[] {
    const branches: string[] = [];
    for (const env of this.config.environments.environments) {
      if (env.type === 'prod') {
        branches.push(...env.branches);
      }
    }
    return branches;
  }

  private canTriggerRunOnBranches(
    triggerTypes: string[],
    includedBranches: string[],
    excludedBranches: string[],
    targetBranches: string[]
  ): boolean {
    if (triggerTypes.length === 0) {
      return false;
    }

    for (const trigger of triggerTypes) {
      if (['workflow_dispatch', 'repository_dispatch', 'workflow_call'].includes(trigger)) {
        return true;
      }
    }

    if (includedBranches.length === 0) {
      for (const target of targetBranches) {
        if (!excludedBranches.some(ex => this.matchGlobPattern(target, ex))) {
          return true;
        }
      }
      return false;
    }

    for (const included of includedBranches) {
      for (const target of targetBranches) {
        if (this.matchGlobPattern(target, included)) {
          const isExcluded = excludedBranches.some(ex => 
            this.matchGlobPattern(target, ex)
          );
          if (!isExcluded) {
            return true;
          }
        }
      }
    }

    return false;
  }

  private restrictsToBranches(
    includedBranches: string[],
    excludedBranches: string[],
    allowedBranches: string[]
  ): boolean {
    if (includedBranches.length === 0) {
      for (const excluded of excludedBranches) {
        for (const allowed of allowedBranches) {
          if (this.matchGlobPattern(allowed, excluded)) {
            return true;
          }
        }
      }
      return false;
    }

    for (const included of includedBranches) {
      let matchesAllowed = false;
      for (const allowed of allowedBranches) {
        if (this.matchGlobPattern(allowed, included)) {
          matchesAllowed = true;
          break;
        }
      }
      if (!matchesAllowed) {
        return false;
      }
    }

    return true;
  }

  private matchGlobPattern(str: string, pattern: string): boolean {
    if (pattern === '*') return true;
    if (pattern === str) return true;

    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(str);
  }

  private calculateCombinations(matrix: Record<string, (string | number)[]>): number {
    if (Object.keys(matrix).length === 0) return 0;
    
    let combinations = 1;
    for (const values of Object.values(matrix)) {
      combinations *= values.length;
    }
    return combinations;
  }

  private extractConcurrencyGroup(concurrency: unknown): string | null {
    if (typeof concurrency === 'string') {
      return concurrency;
    }
    if (typeof concurrency === 'object' && concurrency !== null) {
      const obj = concurrency as Record<string, unknown>;
      if (typeof obj['group'] === 'string') {
        return obj['group'];
      }
    }
    return null;
  }

  private containsDynamicVariable(str: string): boolean {
    return str.includes('${{') || str.includes('github.') || 
           str.includes('vars.') || str.includes('env.');
  }

  private getRetentionDays(step: Step): number | undefined {
    if (step.with && 'retention-days' in step.with) {
      const value = step.with['retention-days'];
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const parsed = parseInt(value, 10);
        if (!isNaN(parsed)) return parsed;
      }
    }
    return undefined;
  }

  private hasEnvironmentProtection(_environmentName: string): boolean {
    return false;
  }

  private findLineNumber(content: string, searchTerm: string): number {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(searchTerm)) {
        return i + 1;
      }
    }
    return 1;
  }
}
