const SchemaParser = require('./schema-parser');

class ReplayPlanner {
  constructor(options = {}) {
    this.options = {
      includeRetries: options.includeRetries !== false,
      skipNonIdempotent: options.skipNonIdempotent === true,
      schemaParser: new SchemaParser(),
      ...options
    };
  }

  generate(timeline, schema, config = {}) {
    const plan = {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      config: {
        includeRetries: config.includeRetries ?? this.options.includeRetries,
        skipNonIdempotent: config.skipNonIdempotent ?? this.options.skipNonIdempotent,
        ...config
      },
      summary: {
        totalCalls: 0,
        plannedCalls: 0,
        skippedCalls: 0,
        hasRisks: false
      },
      steps: [],
      warnings: [],
      risks: [],
      validation: {
        schemaDrift: null,
        parameterIssues: []
      }
    };

    const calls = timeline.calls || [];
    const retries = timeline.retries || [];
    const nonIdempotentRisks = timeline.nonIdempotentRisks || [];

    plan.summary.totalCalls = calls.length;

    const retryToolCallIds = new Set(
      retries.map(r => r.current.tool_call_id)
    );

    const nonIdempotentKeys = new Set(
      nonIdempotentRisks.map(r => 
        `${r.tool_name}:${JSON.stringify(r.parameters)}`
      )
    );

    const sortedCalls = [...calls].sort((a, b) => {
      if (a.timestamp && b.timestamp) {
        return a.timestamp - b.timestamp;
      }
      return 0;
    });

    for (let i = 0; i < sortedCalls.length; i++) {
      const call = sortedCalls[i];
      const step = this.createStep(call, i, {
        retries,
        nonIdempotentRisks,
        retryToolCallIds,
        nonIdempotentKeys,
        schema,
        config
      });

      if (step.shouldSkip) {
        plan.summary.skippedCalls++;
        plan.warnings.push({
          stepIndex: i,
          tool_call_id: call.tool_call_id,
          tool_name: call.tool_name,
          reason: step.skipReason,
          type: step.skipType
        });
      } else {
        plan.summary.plannedCalls++;
      }

      plan.steps.push(step);

      if (step.validation && step.validation.issues.length > 0) {
        plan.validation.parameterIssues.push({
          stepIndex: i,
          tool_call_id: call.tool_call_id,
          tool_name: call.tool_name,
          issues: step.validation.issues
        });
      }
    }

    plan.summary.hasRisks = nonIdempotentRisks.length > 0 || 
      plan.validation.parameterIssues.length > 0;

    plan.risks = this.extractRisks(nonIdempotentRisks, plan);

    return plan;
  }

  createStep(call, index, context) {
    const { retries, nonIdempotentRisks, retryToolCallIds, nonIdempotentKeys, schema, config } = context;

    const step = {
      index,
      id: call.id,
      tool_call_id: call.tool_call_id,
      type: 'tool_call',
      tool_name: call.tool_name,
      parameters: call.parameters,
      expectedResult: call.result,
      expectedSuccess: call.success,
      expectedError: call.error,
      timestamp: call.timestampISO,
      metadata: call.metadata,
      shouldSkip: false,
      skipReason: null,
      skipType: null,
      retryInfo: null,
      riskInfo: null,
      validation: null
    };

    if (retryToolCallIds.has(call.tool_call_id)) {
      const retry = retries.find(r => r.current.tool_call_id === call.tool_call_id);
      if (retry) {
        step.retryInfo = {
          isRetry: true,
          retryType: retry.type,
          retryNumber: retry.retryNumber,
          previousSuccess: retry.successTransition.from,
          currentSuccess: retry.successTransition.to,
          reason: retry.reason
        };

        if (!config.includeRetries) {
          step.shouldSkip = true;
          step.skipReason = '跳过重试调用（根据配置）';
          step.skipType = 'retry_skip';
        }
      }
    }

    const callKey = `${call.tool_name}:${JSON.stringify(call.parameters)}`;
    if (nonIdempotentKeys.has(callKey)) {
      const risk = nonIdempotentRisks.find(r => 
        `${r.tool_name}:${JSON.stringify(r.parameters)}` === callKey
      );
      if (risk) {
        step.riskInfo = {
          type: risk.type,
          riskLevel: risk.risk,
          description: risk.description,
          callCount: risk.callCount
        };

        if (config.skipNonIdempotent) {
          step.shouldSkip = true;
          step.skipReason = '跳过非幂等调用（根据配置）';
          step.skipType = 'non_idempotent_skip';
        }
      }
    }

    if (schema) {
      const validation = this.options.schemaParser.validateToolCall(
        call.tool_name,
        call.parameters,
        schema
      );
      step.validation = validation;

      if (!validation.valid) {
        step.shouldSkip = true;
        step.skipReason = '参数验证失败，与当前 Schema 不兼容';
        step.skipType = 'validation_failure';
      }
    }

    return step;
  }

  extractRisks(nonIdempotentRisks, plan) {
    const risks = [];

    for (const risk of nonIdempotentRisks) {
      risks.push({
        type: risk.type,
        tool_name: risk.tool_name,
        parameters: risk.parameters,
        riskLevel: risk.risk,
        description: risk.description,
        callCount: risk.callCount || risk.calls?.length,
        recommendations: this.getRecommendations(risk)
      });
    }

    for (const issue of plan.validation.parameterIssues) {
      for (const paramIssue of issue.issues) {
        risks.push({
          type: 'schema_compatibility',
          tool_name: issue.tool_name,
          tool_call_id: issue.tool_call_id,
          parameter: paramIssue.parameter,
          severity: paramIssue.severity,
          message: paramIssue.message,
          recommendations: this.getSchemaCompatibilityRecommendations(paramIssue)
        });
      }
    }

    return risks;
  }

  getRecommendations(risk) {
    const recommendations = [];

    switch (risk.type) {
      case 'non_idempotent_result':
        recommendations.push('考虑在回放前保存系统状态快照');
        recommendations.push('手动验证该工具调用的幂等性');
        recommendations.push('如果可能，使用 dry-run 模式进行测试');
        break;
      case 'retry_success_risk':
        recommendations.push('检查是否存在竞态条件');
        recommendations.push('验证重试逻辑是否正确处理暂时性错误');
        recommendations.push('考虑添加指数退避重试策略');
        break;
      case 'multiple_write_risk':
        recommendations.push('高度警告：多次写入操作可能导致数据不一致');
        recommendations.push('在回放前备份数据');
        recommendations.push('考虑合并或去重这些调用');
        break;
    }

    return recommendations;
  }

  getSchemaCompatibilityRecommendations(issue) {
    const recommendations = [];

    switch (issue.type) {
      case 'tool_not_found':
        recommendations.push('该工具已从当前 Schema 中移除');
        recommendations.push('检查是否有替代工具可用');
        break;
      case 'missing_required_parameter':
        recommendations.push(`参数 "${issue.parameter}" 现在是必需的`);
        recommendations.push('检查轨迹中是否有该参数的默认值');
        break;
      case 'unknown_parameter':
        recommendations.push(`参数 "${issue.parameter}" 在当前 Schema 中未定义`);
        recommendations.push('可能是参数已被移除或重命名');
        break;
      case 'type_mismatch':
        recommendations.push(`参数 "${issue.parameter}" 类型已从 "${issue.actual}" 变为 "${issue.expected}"`);
        recommendations.push('考虑类型转换或更新调用代码');
        break;
      case 'deprecated':
        recommendations.push('该工具已被标记为废弃');
        recommendations.push('计划迁移到新的替代工具');
        break;
    }

    return recommendations;
  }

  generateDryRunSummary(plan) {
    const summary = {
      canExecute: true,
      blockers: [],
      warnings: [],
      executionOrder: []
    };

    for (const step of plan.steps) {
      if (step.shouldSkip) {
        if (step.skipType === 'validation_failure') {
          summary.canExecute = false;
          summary.blockers.push({
            stepIndex: step.index,
            tool_name: step.tool_name,
            tool_call_id: step.tool_call_id,
            reason: step.skipReason,
            validation: step.validation
          });
        } else {
          summary.warnings.push({
            stepIndex: step.index,
            tool_name: step.tool_name,
            tool_call_id: step.tool_call_id,
            reason: step.skipReason,
            type: step.skipType
          });
        }
      } else {
        summary.executionOrder.push({
          stepIndex: step.index,
          tool_name: step.tool_name,
          tool_call_id: step.tool_call_id,
          parameters: step.parameters,
          expectedSuccess: step.expectedSuccess
        });
      }
    }

    return summary;
  }

  extractMinimalReproduction(plan, targetCallId = null) {
    const minimal = {
      version: '1.0.0',
      type: 'minimal_reproduction',
      targetCallId: targetCallId,
      prerequisites: [],
      targetCall: null,
      context: []
    };

    if (targetCallId) {
      const targetStep = plan.steps.find(s => s.tool_call_id === targetCallId);
      if (targetStep) {
        minimal.targetCall = {
          tool_call_id: targetStep.tool_call_id,
          tool_name: targetStep.tool_name,
          parameters: targetStep.parameters,
          expectedResult: targetStep.expectedResult,
          expectedSuccess: targetStep.expectedSuccess
        };

        const prerequisites = this.findPrerequisites(plan.steps, targetStep);
        minimal.prerequisites = prerequisites.map(p => ({
          tool_call_id: p.tool_call_id,
          tool_name: p.tool_name,
          parameters: p.parameters,
          why: '可能是前置依赖'
        }));
      }
    } else {
      const failedSteps = plan.steps.filter(s => 
        !s.expectedSuccess && !s.shouldSkip
      );
      
      if (failedSteps.length > 0) {
        minimal.targetCall = {
          tool_call_id: failedSteps[0].tool_call_id,
          tool_name: failedSteps[0].tool_name,
          parameters: failedSteps[0].parameters,
          expectedResult: failedSteps[0].expectedResult,
          expectedSuccess: failedSteps[0].expectedSuccess
        };
      }
    }

    return minimal;
  }

  findPrerequisites(steps, targetStep) {
    const prerequisites = [];
    const targetIndex = steps.findIndex(s => s.index === targetStep.index);

    for (let i = 0; i < targetIndex; i++) {
      const step = steps[i];
      if (!step.shouldSkip) {
        const similarity = this.calculateSimilarity(step, targetStep);
        if (similarity > 0.3 || this.isLikelyDependency(step, targetStep)) {
          prerequisites.push(step);
        }
      }
    }

    return prerequisites;
  }

  calculateSimilarity(step1, step2) {
    if (step1.tool_name === step2.tool_name) {
      const params1 = Object.keys(step1.parameters || {});
      const params2 = Object.keys(step2.parameters || {});
      
      const intersection = params1.filter(p => params2.includes(p));
      const union = [...new Set([...params1, ...params2])];
      
      return union.length > 0 ? intersection.length / union.length : 0;
    }
    return 0;
  }

  isLikelyDependency(step, targetStep) {
    const dependencyKeywords = [
      'create', 'get', 'read', 'list', 'search', 'find', 'lookup',
      '创建', '获取', '读取', '列表', '搜索', '查找'
    ];

    const stepName = (step.tool_name || '').toLowerCase();
    const targetName = (targetStep.tool_name || '').toLowerCase();

    if (dependencyKeywords.some(kw => stepName.includes(kw))) {
      if (targetName.includes('update') || targetName.includes('delete') ||
          targetName.includes('修改') || targetName.includes('删除')) {
        return true;
      }
    }

    const stepParams = Object.values(step.parameters || {});
    const targetParams = Object.values(targetStep.parameters || {});

    for (const sp of stepParams) {
      for (const tp of targetParams) {
        if (typeof sp === 'string' && typeof tp === 'string') {
          if (sp === tp || sp.includes(tp) || tp.includes(sp)) {
            return true;
          }
        }
      }
    }

    return false;
  }
}

module.exports = ReplayPlanner;
