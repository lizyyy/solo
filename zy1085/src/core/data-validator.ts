import {
  Commit,
  Issue,
  DeployPlan,
  Migration,
  ConfigChange,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ValidationInfo
} from '../types';

/**
 * 数据校验器
 * 负责校验输入数据的完整性、格式正确性
 */
export class DataValidator {
  /**
   * 综合校验所有数据
   */
  validateAll(
    commits: Commit[],
    issues: Issue[],
    deployPlan: DeployPlan,
    migrations: Migration[]
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const info: ValidationInfo[] = [];

    // 校验commits
    const commitResult = this.validateCommits(commits);
    errors.push(...commitResult.errors);
    warnings.push(...commitResult.warnings);
    info.push(...commitResult.info);

    // 校验issues
    const issueResult = this.validateIssues(issues);
    errors.push(...issueResult.errors);
    warnings.push(...issueResult.warnings);
    info.push(...issueResult.info);

    // 校验deploy plan
    const planResult = this.validateDeployPlan(deployPlan);
    errors.push(...planResult.errors);
    warnings.push(...planResult.warnings);
    info.push(...planResult.info);

    // 校验migrations
    const migrationResult = this.validateMigrations(migrations);
    errors.push(...migrationResult.errors);
    warnings.push(...migrationResult.warnings);
    info.push(...migrationResult.info);

    // 校验关联关系
    const relationResult = this.validateRelations(commits, issues, migrations);
    errors.push(...relationResult.errors);
    warnings.push(...relationResult.warnings);
    info.push(...relationResult.info);

    // 检查回滚准备状态
    const rollbackResult = this.validateRollbackReadiness(issues, migrations, deployPlan.configChanges);
    errors.push(...rollbackResult.errors);
    warnings.push(...rollbackResult.warnings);
    info.push(...rollbackResult.info);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      info
    };
  }

  /**
   * 校验commits
   */
  validateCommits(commits: Commit[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const info: ValidationInfo[] = [];

    if (commits.length === 0) {
      warnings.push({
        type: 'empty_data',
        field: 'commits',
        message: '没有提交记录，这可能是一个空版本',
        severity: 'warning'
      });
    }

    const seenIds = new Set<string>();

    for (const commit of commits) {
      // 检查ID重复
      if (seenIds.has(commit.id)) {
        errors.push({
          type: 'duplicate_id',
          field: `commit.${commit.id}`,
          message: `重复的Commit ID: ${commit.id}`,
          severity: 'error'
        });
      }
      seenIds.add(commit.id);

      // 检查必填字段
      if (!commit.hash && !commit.id) {
        warnings.push({
          type: 'missing_field',
          field: `commit.${commit.id || 'unknown'}.hash`,
          message: `Commit ${commit.id} 缺少hash值`,
          severity: 'warning'
        });
      }

      if (!commit.message || commit.message.trim().length === 0) {
        warnings.push({
          type: 'missing_field',
          field: `commit.${commit.id}.message`,
          message: `Commit ${commit.id} 缺少提交信息`,
          severity: 'warning'
        });
      }

      // 检查破坏性变更
      if (commit.isBreaking && (!commit.breakingDescription || commit.breakingDescription.trim().length === 0)) {
        warnings.push({
          type: 'incomplete_breaking_change',
          field: `commit.${commit.id}.breakingDescription`,
          message: `破坏性变更 ${commit.id} 缺少详细描述`,
          severity: 'warning'
        });
      }

      // 检查模块推断
      if (commit.module === 'unknown') {
        info.push({
          type: 'module_inference',
          field: `commit.${commit.id}.module`,
          message: `Commit ${commit.id} 的模块无法推断，被标记为 'unknown'`
        });
      }
    }

    info.push({
      type: 'count',
      field: 'commits',
      message: `共 ${commits.length} 条提交记录`
    });

    return { valid: errors.length === 0, errors, warnings, info };
  }

  /**
   * 校验issues
   */
  validateIssues(issues: Issue[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const info: ValidationInfo[] = [];

    if (issues.length === 0) {
      info.push({
        type: 'empty_data',
        field: 'issues',
        message: '没有关联的Issue'
      });
    }

    const seenIds = new Set<string>();

    for (const issue of issues) {
      // 检查ID重复
      if (seenIds.has(issue.id)) {
        errors.push({
          type: 'duplicate_id',
          field: `issue.${issue.id}`,
          message: `重复的Issue ID: ${issue.id}`,
          severity: 'error'
        });
      }
      seenIds.add(issue.id);

      // 检查必填字段
      if (!issue.title || issue.title.trim().length === 0) {
        warnings.push({
          type: 'missing_field',
          field: `issue.${issue.id}.title`,
          message: `Issue ${issue.id} 缺少标题`,
          severity: 'warning'
        });
      }

      // 检查状态
      const validStatuses = ['open', 'in_progress', 'closed', 'resolved', 'reopened'];
      if (!validStatuses.includes(issue.status.toLowerCase())) {
        warnings.push({
          type: 'invalid_status',
          field: `issue.${issue.id}.status`,
          message: `Issue ${issue.id} 状态 '${issue.status}' 不是标准状态`,
          severity: 'warning'
        });
      }

      // 检查高优先级Issue是否有回滚计划
      if (issue.priority === 'high' && !issue.hasRollbackPlan) {
        warnings.push({
          type: 'missing_rollback_plan',
          field: `issue.${issue.id}.rollbackPlan`,
          message: `高优先级Issue ${issue.id} 缺少回滚计划`,
          severity: 'warning'
        });
      }

      // 检查受影响客户
      if (issue.affectedCustomers.length === 0 && issue.priority === 'high') {
        warnings.push({
          type: 'missing_customer_info',
          field: `issue.${issue.id}.affectedCustomers`,
          message: `高优先级Issue ${issue.id} 未指定受影响客户`,
          severity: 'warning'
        });
      }
    }

    info.push({
      type: 'count',
      field: 'issues',
      message: `共 ${issues.length} 个Issue`
    });

    // 按优先级统计
    const highPriority = issues.filter(i => i.priority === 'high').length;
    const mediumPriority = issues.filter(i => i.priority === 'medium').length;
    const lowPriority = issues.filter(i => i.priority === 'low').length;

    if (highPriority > 0) {
      info.push({
        type: 'priority_count',
        field: 'issues',
        message: `高优先级: ${highPriority}, 中优先级: ${mediumPriority}, 低优先级: ${lowPriority}`
      });
    }

    return { valid: errors.length === 0, errors, warnings, info };
  }

  /**
   * 校验deploy plan
   */
  validateDeployPlan(plan: DeployPlan): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const info: ValidationInfo[] = [];

    // 检查版本号
    if (!plan.version || plan.version === '0.0.0') {
      warnings.push({
        type: 'missing_version',
        field: 'deployPlan.version',
        message: '未指定版本号，将使用默认值',
        severity: 'warning'
      });
    }

    // 检查环境
    const validEnvironments = ['production', 'staging', 'testing', 'development'];
    if (!validEnvironments.includes(plan.environment.toLowerCase())) {
      warnings.push({
        type: 'unknown_environment',
        field: 'deployPlan.environment',
        message: `未知的环境类型: ${plan.environment}`,
        severity: 'warning'
      });
    }

    // 检查配置变更
    for (const config of plan.configChanges) {
      if (!config.key) {
        errors.push({
          type: 'invalid_config',
          field: 'deployPlan.configChanges',
          message: '配置变更缺少key',
          severity: 'error'
        });
      }

      if (config.isRequired && !config.rollbackAction) {
        warnings.push({
          type: 'missing_rollback_action',
          field: `deployPlan.config.${config.key}.rollbackAction`,
          message: `必需配置项 ${config.key} 缺少回滚操作`,
          severity: 'warning'
        });
      }
    }

    // 检查回滚策略
    if (!plan.rollbackStrategy || plan.rollbackStrategy.trim().length === 0) {
      warnings.push({
        type: 'missing_rollback_strategy',
        field: 'deployPlan.rollbackStrategy',
        message: '部署计划缺少整体回滚策略',
        severity: 'warning'
      });
    }

    info.push({
      type: 'version_info',
      field: 'deployPlan',
      message: `版本: ${plan.version}, 环境: ${plan.environment}, 日期: ${plan.date}`
    });

    if (plan.configChanges.length > 0) {
      info.push({
        type: 'config_count',
        field: 'deployPlan',
        message: `包含 ${plan.configChanges.length} 项配置变更`
      });
    }

    return { valid: errors.length === 0, errors, warnings, info };
  }

  /**
   * 校验migrations
   */
  validateMigrations(migrations: Migration[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const info: ValidationInfo[] = [];

    if (migrations.length === 0) {
      info.push({
        type: 'empty_data',
        field: 'migrations',
        message: '没有数据库迁移'
      });
    }

    const seenIds = new Set<string>();

    for (const migration of migrations) {
      // 检查ID重复
      if (seenIds.has(migration.id)) {
        errors.push({
          type: 'duplicate_id',
          field: `migration.${migration.id}`,
          message: `重复的迁移ID: ${migration.id}`,
          severity: 'error'
        });
      }
      seenIds.add(migration.id);

      // 检查破坏性迁移
      if (migration.isBreaking) {
        warnings.push({
          type: 'breaking_migration',
          field: `migration.${migration.id}`,
          message: `破坏性数据库迁移: ${migration.filename} - ${migration.description}`,
          severity: 'warning'
        });

        // 检查破坏性迁移是否有回滚脚本
        if (!migration.rollbackScript) {
          errors.push({
            type: 'missing_rollback_script',
            field: `migration.${migration.id}.rollbackScript`,
            message: `破坏性迁移 ${migration.filename} 缺少回滚脚本`,
            severity: 'critical'
          });
        }
      }

      // 检查依赖是否存在
      for (const dep of migration.dependencies) {
        if (!seenIds.has(dep) && !migrations.some(m => m.id === dep || m.filename === dep)) {
          warnings.push({
            type: 'missing_dependency',
            field: `migration.${migration.id}.dependencies`,
            message: `迁移 ${migration.filename} 依赖 ${dep}，但未找到该迁移`,
            severity: 'warning'
          });
        }
      }
    }

    info.push({
      type: 'count',
      field: 'migrations',
      message: `共 ${migrations.length} 个数据库迁移`
    });

    const breakingCount = migrations.filter(m => m.isBreaking).length;
    if (breakingCount > 0) {
      info.push({
        type: 'breaking_count',
        field: 'migrations',
        message: `其中 ${breakingCount} 个是破坏性迁移`
      });
    }

    return { valid: errors.length === 0, errors, warnings, info };
  }

  /**
   * 校验关联关系
   */
  validateRelations(
    commits: Commit[],
    issues: Issue[],
    migrations: Migration[]
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const info: ValidationInfo[] = [];

    const commitIds = new Set(commits.map(c => c.id));
    const issueIds = new Set(issues.map(i => i.id));
    const migrationIds = new Set(migrations.map(m => m.id));

    // 检查commit引用的issue是否存在
    for (const commit of commits) {
      for (const issueRef of commit.relatedIssues) {
        if (!issueIds.has(issueRef) && !issues.some(i => i.id === issueRef || i.title.includes(issueRef))) {
          // 尝试宽松匹配
          const looseMatch = issues.some(i => 
            i.id.toLowerCase().includes(issueRef.toLowerCase()) ||
            issueRef.toLowerCase().includes(i.id.toLowerCase())
          );
          
          if (!looseMatch) {
            warnings.push({
              type: 'broken_reference',
              field: `commit.${commit.id}.relatedIssues`,
              message: `Commit ${commit.id} 引用的 Issue ${issueRef} 不存在`,
              severity: 'warning'
            });
          }
        }
      }
    }

    // 检查issue引用的commit是否存在
    for (const issue of issues) {
      for (const commitRef of issue.relatedCommits) {
        if (!commitIds.has(commitRef) && !commits.some(c => c.hash === commitRef)) {
          warnings.push({
            type: 'broken_reference',
            field: `issue.${issue.id}.relatedCommits`,
            message: `Issue ${issue.id} 引用的 Commit ${commitRef} 不存在`,
            severity: 'warning'
          });
        }
      }
    }

    // 统计关联情况
    const commitsWithIssues = commits.filter(c => c.relatedIssues.length > 0).length;
    const issuesWithCommits = issues.filter(i => i.relatedCommits.length > 0).length;

    info.push({
      type: 'relation_stats',
      field: 'relations',
      message: `${commitsWithIssues}/${commits.length} 个Commit有关联Issue，${issuesWithCommits}/${issues.length} 个Issue有关联Commit`
    });

    // 检查孤儿commit（没有关联任何issue）
    const orphanCommits = commits.filter(c => c.relatedIssues.length === 0);
    if (orphanCommits.length > 0) {
      info.push({
        type: 'orphan_commits',
        field: 'commits',
        message: `${orphanCommits.length} 个Commit没有关联任何Issue`
      });
    }

    return { valid: errors.length === 0, errors, warnings, info };
  }

  /**
   * 校验回滚准备状态
   */
  validateRollbackReadiness(
    issues: Issue[],
    migrations: Migration[],
    configChanges: ConfigChange[]
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const info: ValidationInfo[] = [];

    // 检查高优先级Issue的回滚计划
    const highPriorityWithoutRollback = issues.filter(
      i => i.priority === 'high' && !i.hasRollbackPlan
    );

    if (highPriorityWithoutRollback.length > 0) {
      warnings.push({
        type: 'missing_rollback',
        field: 'issues',
        message: `${highPriorityWithoutRollback.length} 个高优先级Issue缺少回滚计划`,
        severity: 'warning'
      });
    }

    // 检查破坏性迁移的回滚脚本
    const breakingMigrationsWithoutRollback = migrations.filter(
      m => m.isBreaking && !m.rollbackScript
    );

    if (breakingMigrationsWithoutRollback.length > 0) {
      errors.push({
        type: 'critical_missing_rollback',
        field: 'migrations',
        message: `${breakingMigrationsWithoutRollback.length} 个破坏性迁移缺少回滚脚本，这是严重问题！`,
        severity: 'critical'
      });
    }

    // 检查必需配置项的回滚操作
    const requiredConfigsWithoutRollback = configChanges.filter(
      c => c.isRequired && !c.rollbackAction
    );

    if (requiredConfigsWithoutRollback.length > 0) {
      warnings.push({
        type: 'missing_config_rollback',
        field: 'configChanges',
        message: `${requiredConfigsWithoutRollback.length} 个必需配置项缺少回滚操作`,
        severity: 'warning'
      });
    }

    // 统计回滚准备情况
    const totalCriticalItems = 
      highPriorityWithoutRollback.length + 
      breakingMigrationsWithoutRollback.length + 
      requiredConfigsWithoutRollback.length;

    if (totalCriticalItems === 0) {
      info.push({
        type: 'rollback_ready',
        field: 'rollback',
        message: '所有关键项都已准备好回滚方案'
      });
    }

    return { valid: errors.length === 0, errors, warnings, info };
  }
}
