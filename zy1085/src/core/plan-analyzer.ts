import {
  Commit,
  Issue,
  DeployPlan,
  Migration,
  ConfigChange,
  ReleasePlan,
  BreakingChange,
  RiskAssessment,
  RiskFactor,
  ImpactAnalysis,
  OwnerResponsibility,
  RollbackReadiness,
  MissingRollbackPlan,
  RollbackChecklistItem
} from '../types';

/**
 * 计划分析器
 * 负责汇总版本变更、风险评估、影响分析
 */
export class PlanAnalyzer {
  /**
   * 分析所有数据并生成发布计划
   */
  analyze(
    commits: Commit[],
    issues: Issue[],
    deployPlan: DeployPlan,
    migrations: Migration[]
  ): ReleasePlan {
    // 构建issue-commit关联
    const linkedIssues = this.linkIssuesAndCommits(commits, issues);
    
    // 检测破坏性变更
    const breakingChanges = this.detectBreakingChanges(commits, migrations, deployPlan.configChanges);
    
    // 风险评估
    const riskAssessment = this.assessRisk(breakingChanges, migrations, deployPlan.configChanges, issues);
    
    // 影响分析
    const impactAnalysis = this.analyzeImpact(issues, migrations, deployPlan);
    
    // 负责人责任分配
    const ownerResponsibility = this.assignOwnerResponsibility(commits, issues, migrations, deployPlan);
    
    // 回滚准备状态
    const rollbackReadiness = this.checkRollbackReadiness(issues, migrations, deployPlan.configChanges, deployPlan);
    
    // 生成摘要
    const summary = this.generateSummary(commits, issues, migrations, deployPlan, breakingChanges);

    return {
      version: deployPlan.version,
      date: deployPlan.date,
      summary,
      commits,
      issues: linkedIssues,
      migrations,
      configChanges: deployPlan.configChanges,
      analysis: {
        breakingChanges,
        riskAssessment,
        impactAnalysis,
        ownerResponsibility,
        rollbackReadiness
      }
    };
  }

  /**
   * 关联Issue和Commit
   */
  private linkIssuesAndCommits(commits: Commit[], issues: Issue[]): Issue[] {
    const issueMap = new Map<string, Issue>();
    issues.forEach(issue => {
      issueMap.set(issue.id, { ...issue, relatedCommits: [...issue.relatedCommits] });
    });

    // 从commit的relatedIssues建立反向关联
    commits.forEach(commit => {
      commit.relatedIssues.forEach(issueRef => {
        // 尝试精确匹配
        let issue = issueMap.get(issueRef);
        
        // 如果没有精确匹配，尝试模糊匹配
        if (!issue) {
          const foundIssue = issues.find(i => 
            i.id === issueRef ||
            i.id.toLowerCase() === issueRef.toLowerCase() ||
            issueRef.includes(i.id) ||
            i.id.includes(issueRef.replace('issue-', ''))
          );
          if (foundIssue) {
            issue = issueMap.get(foundIssue.id);
          }
        }

        if (issue && !issue.relatedCommits.includes(commit.id) && !issue.relatedCommits.includes(commit.hash)) {
          issue.relatedCommits.push(commit.id);
        }
      });
    });

    return Array.from(issueMap.values());
  }

  /**
   * 检测破坏性变更
   */
  private detectBreakingChanges(
    commits: Commit[],
    migrations: Migration[],
    configChanges: ConfigChange[]
  ): BreakingChange[] {
    const changes: BreakingChange[] = [];

    // 从commits检测
    commits.filter(c => c.isBreaking).forEach((commit, index) => {
      changes.push({
        id: `breaking-commit-${index + 1}`,
        type: 'commit',
        description: commit.breakingDescription || commit.message,
        affectedAreas: [commit.module],
        severity: this.assessBreakingSeverity(commit.message, commit.module),
        mitigation: '回滚到之前的版本，或者应用修复补丁'
      });
    });

    // 从migrations检测
    migrations.filter(m => m.isBreaking).forEach((migration, index) => {
      changes.push({
        id: `breaking-migration-${index + 1}`,
        type: 'migration',
        description: migration.description,
        affectedAreas: [migration.module, 'database'],
        severity: 'critical',
        mitigation: migration.rollbackScript || '需要手动恢复数据库'
      });
    });

    // 从configChanges检测破坏性配置变更
    configChanges.filter(c => c.isRequired).forEach((config, index) => {
      // 检测是否是破坏性配置变更
      const isBreaking = this.isBreakingConfigChange(config);
      if (isBreaking) {
        changes.push({
          id: `breaking-config-${index + 1}`,
          type: 'config',
          description: `${config.key}: ${config.description}`,
          affectedAreas: [config.environment],
          severity: 'high',
          mitigation: config.rollbackAction || '回滚配置值'
        });
      }
    });

    return changes;
  }

  /**
   * 评估破坏性变更的严重程度
   */
  private assessBreakingSeverity(message: string, module: string): 'critical' | 'high' | 'medium' | 'low' {
    const lowerMessage = message.toLowerCase();
    
    // 关键模块
    const criticalModules = ['auth', 'payment', 'database', 'api'];
    if (criticalModules.includes(module.toLowerCase())) {
      return 'critical';
    }

    // 关键词检测
    if (lowerMessage.includes('api') && lowerMessage.includes('remove')) return 'high';
    if (lowerMessage.includes('deprecated')) return 'medium';
    if (lowerMessage.includes('rename')) return 'medium';
    
    return 'medium';
  }

  /**
   * 检测是否是破坏性配置变更
   */
  private isBreakingConfigChange(config: ConfigChange): boolean {
    const breakingKeywords = ['timeout', 'retry', 'max', 'limit', 'threshold', 'enabled', 'disabled'];
    const lowerKey = config.key.toLowerCase();
    
    // 检查是否是开关类配置
    if (lowerKey.includes('enabled') || lowerKey.includes('disabled')) {
      return true;
    }
    
    // 检查是否是临界值配置
    for (const keyword of breakingKeywords) {
      if (lowerKey.includes(keyword)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 风险评估
   */
  private assessRisk(
    breakingChanges: BreakingChange[],
    migrations: Migration[],
    configChanges: ConfigChange[],
    issues: Issue[]
  ): RiskAssessment {
    const riskFactors: RiskFactor[] = [];

    // 破坏性变更风险
    if (breakingChanges.length > 0) {
      const criticalBreaking = breakingChanges.filter(c => c.severity === 'critical').length;
      const highBreaking = breakingChanges.filter(c => c.severity === 'high').length;
      
      riskFactors.push({
        category: '破坏性变更',
        description: `存在 ${breakingChanges.length} 个破坏性变更（${criticalBreaking} 个严重，${highBreaking} 个高危）`,
        likelihood: criticalBreaking > 0 ? 'high' : highBreaking > 0 ? 'medium' : 'low',
        impact: criticalBreaking > 0 ? 'high' : 'medium',
        score: this.calculateRiskScore(
          criticalBreaking > 0 ? 'high' : highBreaking > 0 ? 'medium' : 'low',
          criticalBreaking > 0 ? 'high' : 'medium'
        )
      });
    }

    // 数据库迁移风险
    if (migrations.length > 0) {
      const breakingMigrations = migrations.filter(m => m.isBreaking).length;
      const migrationsWithoutRollback = migrations.filter(m => m.isBreaking && !m.rollbackScript).length;

      riskFactors.push({
        category: '数据库迁移',
        description: `共 ${migrations.length} 个迁移，${breakingMigrations} 个破坏性迁移`,
        likelihood: breakingMigrations > 0 ? 'high' : 'medium',
        impact: migrationsWithoutRollback > 0 ? 'high' : 'medium',
        score: this.calculateRiskScore(
          breakingMigrations > 0 ? 'high' : 'medium',
          migrationsWithoutRollback > 0 ? 'high' : 'medium'
        )
      });
    }

    // 配置变更风险
    if (configChanges.length > 0) {
      const requiredConfigs = configChanges.filter(c => c.isRequired).length;
      const configsWithoutRollback = configChanges.filter(c => c.isRequired && !c.rollbackAction).length;

      if (requiredConfigs > 0) {
        riskFactors.push({
          category: '配置变更',
          description: `${requiredConfigs} 个必需配置项需要更新`,
          likelihood: configsWithoutRollback > 0 ? 'medium' : 'low',
          impact: 'medium',
          score: this.calculateRiskScore(
            configsWithoutRollback > 0 ? 'medium' : 'low',
            'medium'
          )
        });
      }
    }

    // 高优先级Issue风险
    const highPriorityIssues = issues.filter(i => i.priority === 'high');
    if (highPriorityIssues.length > 0) {
      const issuesWithoutRollback = highPriorityIssues.filter(i => !i.hasRollbackPlan).length;

      riskFactors.push({
        category: '高优先级变更',
        description: `${highPriorityIssues.length} 个高优先级Issue`,
        likelihood: issuesWithoutRollback > 0 ? 'medium' : 'low',
        impact: issuesWithoutRollback > 0 ? 'high' : 'medium',
        score: this.calculateRiskScore(
          issuesWithoutRollback > 0 ? 'medium' : 'low',
          issuesWithoutRollback > 0 ? 'high' : 'medium'
        )
      });
    }

    // 计算整体风险
    let overallRisk: 'critical' | 'high' | 'medium' | 'low' = 'low';
    const totalScore = riskFactors.reduce((sum, f) => sum + f.score, 0);
    
    if (totalScore >= 15) overallRisk = 'critical';
    else if (totalScore >= 10) overallRisk = 'high';
    else if (totalScore >= 5) overallRisk = 'medium';

    // 生成缓解计划
    const mitigationPlan: string[] = [];
    
    if (breakingChanges.length > 0) {
      mitigationPlan.push('准备好回滚环境，确保可以快速回滚');
      mitigationPlan.push('在测试环境充分验证破坏性变更');
    }
    
    if (migrations.filter(m => m.isBreaking).length > 0) {
      mitigationPlan.push('在执行迁移前备份数据库');
      mitigationPlan.push('准备好数据库回滚脚本');
    }
    
    if (configChanges.filter(c => c.isRequired).length > 0) {
      mitigationPlan.push('更新配置前记录当前配置值');
      mitigationPlan.push('准备配置回滚操作');
    }
    
    if (highPriorityIssues.filter(i => !i.hasRollbackPlan).length > 0) {
      mitigationPlan.push('为所有高优先级Issue补充回滚计划');
    }

    return {
      overallRisk,
      riskFactors,
      mitigationPlan: mitigationPlan.length > 0 ? mitigationPlan : ['标准发布流程即可']
    };
  }

  /**
   * 计算风险分数
   */
  private calculateRiskScore(likelihood: 'high' | 'medium' | 'low', impact: 'high' | 'medium' | 'low'): number {
    const likelihoodScore: Record<string, number> = { high: 3, medium: 2, low: 1 };
    const impactScore: Record<string, number> = { high: 3, medium: 2, low: 1 };
    return likelihoodScore[likelihood] * impactScore[impact];
  }

  /**
   * 影响分析
   */
  private analyzeImpact(
    issues: Issue[],
    migrations: Migration[],
    deployPlan: DeployPlan
  ): ImpactAnalysis {
    // 收集受影响的客户
    const affectedCustomers = new Set<string>();
    issues.forEach(issue => {
      issue.affectedCustomers.forEach(customer => affectedCustomers.add(customer));
    });

    // 收集受影响的模块
    const affectedModules = new Set<string>();
    issues.forEach(issue => {
      if (issue.module && issue.module !== 'unknown') {
        affectedModules.add(issue.module);
      }
    });
    migrations.forEach(migration => {
      if (migration.module && migration.module !== 'unknown') {
        affectedModules.add(migration.module);
      }
    });

    // 检查是否需要停机
    const breakingMigrations = migrations.filter(m => m.isBreaking);
    const downtimeRequired = breakingMigrations.length > 0 || 
      deployPlan.configChanges.some(c => c.isRequired && c.key.toLowerCase().includes('maintenance'));

    // 估算停机时间
    let downtimeEstimate: string | undefined;
    if (downtimeRequired) {
      const migrationTime = breakingMigrations.length * 5; // 假设每个迁移5分钟
      downtimeEstimate = `约 ${Math.max(10, migrationTime)} 分钟`;
    }

    return {
      affectedCustomers: Array.from(affectedCustomers),
      affectedModules: Array.from(affectedModules),
      dependentServices: deployPlan.dependencies || [],
      downtimeRequired,
      downtimeEstimate
    };
  }

  /**
   * 分配负责人责任
   */
  private assignOwnerResponsibility(
    commits: Commit[],
    issues: Issue[],
    migrations: Migration[],
    deployPlan: DeployPlan
  ): OwnerResponsibility[] {
    const ownerMap = new Map<string, OwnerResponsibility>();

    // 初始化部署计划中的模块负责人
    Object.entries(deployPlan.moduleOwners || {}).forEach(([module, owner]) => {
      if (!ownerMap.has(owner)) {
        ownerMap.set(owner, {
          owner,
          modules: [],
          issues: [],
          commits: [],
          migrations: []
        });
      }
      const ownerData = ownerMap.get(owner)!;
      if (!ownerData.modules.includes(module)) {
        ownerData.modules.push(module);
      }
    });

    // 分配Issue
    issues.forEach(issue => {
      const owner = issue.assignee || deployPlan.moduleOwners[issue.module];
      if (owner) {
        if (!ownerMap.has(owner)) {
          ownerMap.set(owner, {
            owner,
            modules: [],
            issues: [],
            commits: [],
            migrations: []
          });
        }
        const ownerData = ownerMap.get(owner)!;
        ownerData.issues.push(issue.id);
      }
    });

    // 分配Commit
    commits.forEach(commit => {
      const owner = deployPlan.moduleOwners[commit.module];
      if (owner) {
        if (!ownerMap.has(owner)) {
          ownerMap.set(owner, {
            owner,
            modules: [],
            issues: [],
            commits: [],
            migrations: []
          });
        }
        const ownerData = ownerMap.get(owner)!;
        ownerData.commits.push(commit.id);
      }
    });

    // 分配Migration
    migrations.forEach(migration => {
      const owner = deployPlan.moduleOwners[migration.module];
      if (owner) {
        if (!ownerMap.has(owner)) {
          ownerMap.set(owner, {
            owner,
            modules: [],
            issues: [],
            commits: [],
            migrations: []
          });
        }
        const ownerData = ownerMap.get(owner)!;
        ownerData.migrations.push(migration.id);
      }
    });

    // 去重并清理空数据
    const result: OwnerResponsibility[] = [];
    ownerMap.forEach(ownerData => {
      if (ownerData.issues.length > 0 || ownerData.commits.length > 0 || ownerData.migrations.length > 0) {
        result.push({
          owner: ownerData.owner,
          modules: [...new Set(ownerData.modules)],
          issues: [...new Set(ownerData.issues)],
          commits: [...new Set(ownerData.commits)],
          migrations: [...new Set(ownerData.migrations)]
        });
      }
    });

    return result;
  }

  /**
   * 检查回滚准备状态
   */
  private checkRollbackReadiness(
    issues: Issue[],
    migrations: Migration[],
    configChanges: ConfigChange[],
    deployPlan: DeployPlan
  ): RollbackReadiness {
    const missingRollbackPlans: MissingRollbackPlan[] = [];
    const rollbackChecklist: RollbackChecklistItem[] = [];

    // 检查高优先级Issue的回滚计划
    const highPriorityWithoutRollback = issues.filter(i => i.priority === 'high' && !i.hasRollbackPlan);
    highPriorityWithoutRollback.forEach(issue => {
      missingRollbackPlans.push({
        id: `missing-issue-${issue.id}`,
        type: 'issue',
        description: `高优先级Issue "${issue.title}" (${issue.id}) 缺少回滚计划`,
        suggestedAction: '请为该Issue补充回滚方案，包括回滚步骤和验证方法'
      });
    });

    // 检查破坏性迁移的回滚脚本
    const breakingMigrationsWithoutRollback = migrations.filter(m => m.isBreaking && !m.rollbackScript);
    breakingMigrationsWithoutRollback.forEach(migration => {
      missingRollbackPlans.push({
        id: `missing-migration-${migration.id}`,
        type: 'migration',
        description: `破坏性数据库迁移 "${migration.filename}" 缺少回滚脚本`,
        suggestedAction: '请编写数据库回滚SQL脚本，并确保已测试可用'
      });
    });

    // 检查必需配置项的回滚操作
    const requiredConfigsWithoutRollback = configChanges.filter(c => c.isRequired && !c.rollbackAction);
    requiredConfigsWithoutRollback.forEach(config => {
      missingRollbackPlans.push({
        id: `missing-config-${config.key}`,
        type: 'config',
        description: `必需配置项 "${config.key}" 缺少回滚操作`,
        suggestedAction: '请记录配置的回滚操作步骤，如恢复旧值等'
      });
    });

    // 生成回滚核对清单
    rollbackChecklist.push(
      {
        id: 'checklist-1',
        category: '代码回滚',
        task: '确认可以回滚到上一个稳定版本的代码',
        status: 'required',
        completed: true,
        notes: 'Git revert 或重新部署上一个版本'
      },
      {
        id: 'checklist-2',
        category: '数据库',
        task: '确认数据库备份已完成',
        status: migrations.length > 0 ? 'required' : 'optional',
        completed: false,
        notes: migrations.length > 0 ? '执行迁移前必须备份数据库' : '无数据库迁移，可选备份'
      },
      {
        id: 'checklist-3',
        category: '数据库',
        task: '准备好数据库回滚脚本',
        status: migrations.some(m => m.isBreaking) ? 'required' : 'optional',
        completed: !breakingMigrationsWithoutRollback.length,
        notes: breakingMigrationsWithoutRollback.length > 0 ? '部分破坏性迁移缺少回滚脚本' : '所有迁移都有回滚脚本'
      },
      {
        id: 'checklist-4',
        category: '配置',
        task: '记录当前配置值，准备配置回滚',
        status: configChanges.filter(c => c.isRequired).length > 0 ? 'required' : 'optional',
        completed: !requiredConfigsWithoutRollback.length,
        notes: requiredConfigsWithoutRollback.length > 0 ? '部分必需配置缺少回滚操作' : '配置回滚已准备就绪'
      },
      {
        id: 'checklist-5',
        category: '验证',
        task: '准备回滚后的验证测试用例',
        status: 'required',
        completed: false,
        notes: '需要验证回滚后的系统功能是否正常'
      },
      {
        id: 'checklist-6',
        category: '通信',
        task: '确认相关负责人已待命',
        status: 'required',
        completed: false,
        notes: '确保模块负责人和运维人员可以及时响应'
      }
    );

    // 为每个高优先级Issue添加核对项
    issues.filter(i => i.priority === 'high').forEach((issue, index) => {
      rollbackChecklist.push({
        id: `checklist-issue-${index}`,
        category: 'Issue验证',
        task: `回滚后验证Issue "${issue.title}" 的功能是否正常`,
        status: 'required',
        completed: issue.hasRollbackPlan,
        notes: issue.hasRollbackPlan ? `回滚计划: ${issue.rollbackPlan?.substring(0, 100)}...` : '缺少回滚计划'
      });
    });

    // 检查整体回滚准备状态
    const isReady = missingRollbackPlans.length === 0 && 
      rollbackChecklist.every(item => item.status !== 'required' || item.completed);

    return {
      isReady,
      missingRollbackPlans,
      rollbackChecklist
    };
  }

  /**
   * 生成摘要
   */
  private generateSummary(
    commits: Commit[],
    issues: Issue[],
    migrations: Migration[],
    deployPlan: DeployPlan,
    breakingChanges: BreakingChange[]
  ): string {
    const parts: string[] = [];

    parts.push(`版本 ${deployPlan.version} 发布计划`);
    
    if (deployPlan.description) {
      parts.push(deployPlan.description);
    }

    const stats: string[] = [];
    if (commits.length > 0) stats.push(`${commits.length} 个提交`);
    if (issues.length > 0) stats.push(`${issues.length} 个Issue`);
    if (migrations.length > 0) stats.push(`${migrations.length} 个数据库迁移`);
    if (deployPlan.configChanges.length > 0) stats.push(`${deployPlan.configChanges.length} 项配置变更`);
    
    if (stats.length > 0) {
      parts.push(`包含: ${stats.join(', ')}`);
    }

    if (breakingChanges.length > 0) {
      const criticalCount = breakingChanges.filter(c => c.severity === 'critical').length;
      const highCount = breakingChanges.filter(c => c.severity === 'high').length;
      
      if (criticalCount > 0 || highCount > 0) {
        parts.push(`⚠️ 注意: 包含 ${breakingChanges.length} 个破坏性变更`);
      }
    }

    return parts.join('。');
  }
}
