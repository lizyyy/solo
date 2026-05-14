import {
  ApprovalRule,
  RuleCondition,
  RuleEvaluationResult,
  ApprovalTimeline,
  ApprovalTicket,
  TimelineEvent,
  LogEventType
} from '../types';

export class RuleEngine {
  private rules: ApprovalRule[] = [];
  private ruleVersion: string = '1.0.0';

  loadRules(rules: ApprovalRule[]): void {
    this.rules = rules;
    this.updateRuleVersion();
  }

  addRule(rule: ApprovalRule): void {
    this.rules.push(rule);
    this.updateRuleVersion();
  }

  getRuleVersion(): string {
    return this.ruleVersion;
  }

  private updateRuleVersion(): void {
    const activeRules = this.rules.filter(r => r.isActive);
    const versionHash = activeRules
      .map(r => `${r.id}-${r.version}`)
      .sort()
      .join('|');
    this.ruleVersion = Buffer.from(versionHash).toString('base64').slice(0, 8);
  }

  getRulesForDate(evaluationDate: Date): ApprovalRule[] {
    return this.rules.filter(rule => {
      if (!rule.isActive) return false;
      const fromDate = new Date(rule.effectiveFrom);
      const toDate = rule.effectiveTo ? new Date(rule.effectiveTo) : null;
      
      if (evaluationDate < fromDate) return false;
      if (toDate && evaluationDate > toDate) return false;
      
      return true;
    });
  }

  evaluateTimeline(
    timeline: ApprovalTimeline,
    ticket: ApprovalTicket,
    evaluationDate?: Date
  ): RuleEvaluationResult[] {
    const evalDate = evaluationDate || new Date();
    const applicableRules = this.getRulesForDate(evalDate);
    
    return applicableRules.map(rule => 
      this.evaluateSingleRule(rule, timeline, ticket, evalDate)
    );
  }

  private evaluateSingleRule(
    rule: ApprovalRule,
    timeline: ApprovalTimeline,
    ticket: ApprovalTicket,
    evaluatedAt: Date
  ): RuleEvaluationResult {
    const allConditionsPassed = rule.conditions.every(condition => 
      this.evaluateCondition(condition, timeline, ticket)
    );

    const passed = !allConditionsPassed; 
    
    return {
      ruleId: rule.id,
      ruleVersion: rule.version,
      ruleName: rule.name,
      passed,
      failureExplanation: passed ? undefined : rule.failureExplanation,
      nextStepSuggestion: passed ? undefined : rule.nextStepSuggestion,
      evaluatedAt
    };
  }

  private evaluateCondition(
    condition: RuleCondition,
    timeline: ApprovalTimeline,
    ticket: ApprovalTicket
  ): boolean {
    const fieldValue = this.getFieldValue(condition.field, timeline, ticket);
    
    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      case 'not_equals':
        return fieldValue !== condition.value;
      case 'contains':
        return String(fieldValue).includes(String(condition.value));
      case 'not_contains':
        return !String(fieldValue).includes(String(condition.value));
      case 'exists':
        return fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
      case 'not_exists':
        return fieldValue === undefined || fieldValue === null || fieldValue === '';
      case 'greater_than':
        return Number(fieldValue) > Number(condition.value);
      case 'less_than':
        return Number(fieldValue) < Number(condition.value);
      default:
        return false;
    }
  }

  private getFieldValue(
    field: string,
    timeline: ApprovalTimeline,
    ticket: ApprovalTicket
  ): any {
    if (field.startsWith('ticket.')) {
      const ticketField = field.replace('ticket.', '');
      return (ticket as any)[ticketField];
    }

    if (field.startsWith('timeline.')) {
      const timelineField = field.replace('timeline.', '');
      
      if (timelineField === 'missingApprovalComments') {
        const approveEvents = timeline.events.filter(
          e => e.eventType === LogEventType.APPROVE
        );
        const missingComments = approveEvents.filter(e => !e.approvalComment);
        return missingComments.length;
      }

      if (timelineField === 'eventCount') {
        return timeline.events.length;
      }

      if (timelineField === 'durationHours') {
        return timeline.totalDurationMs ? timeline.totalDurationMs / 3600000 : 0;
      }

      return (timeline as any)[timelineField];
    }

    return undefined;
  }

  explainFailure(result: RuleEvaluationResult, rule: ApprovalRule): string {
    return `
规则名称: ${rule.name} (v${rule.version})
生效时间: ${rule.effectiveFrom.toLocaleDateString()}${rule.effectiveTo ? ` 至 ${rule.effectiveTo.toLocaleDateString()}` : ' (长期有效)'}
检查结果: 未通过
原因说明: ${result.failureExplanation}
处理建议: ${result.nextStepSuggestion}
    `.trim();
  }

  getRuleSnapshot(): ApprovalRule[] {
    return JSON.parse(JSON.stringify(this.rules));
  }
}

export function createDefaultRules(): ApprovalRule[] {
  return [
    {
      id: 'RULE-001',
      version: '2.1.0',
      name: '审批意见必填检查',
      description: '所有审批通过操作必须填写审批意见',
      effectiveFrom: new Date('2024-01-15'),
      isActive: true,
      conditions: [
        {
          field: 'timeline.missingApprovalComments',
          operator: 'greater_than',
          value: 0
        }
      ],
      actions: [
        {
          type: 'block',
          message: '存在未填写审批意见的审批记录'
        }
      ],
      failureExplanation: '根据2024年1月15日生效的《审批管理规范V2.1》第3.2条规定：所有审批通过操作必须填写具体的审批意见，说明同意的理由或确认的内容。经核查，本批次中有审批记录仅点击了"通过"但未填写任何审批意见。',
      nextStepSuggestion: '请联系审批人补充填写审批意见，或通过工单系统提交审批意见补录申请（工单号需关联原始审批单号），经复核通过后可继续流程。'
    },
    {
      id: 'RULE-002',
      version: '1.5.0',
      name: '审批超时检查',
      description: '临时权限申请需在24小时内完成审批',
      effectiveFrom: new Date('2023-06-01'),
      isActive: true,
      conditions: [
        {
          field: 'timeline.durationHours',
          operator: 'greater_than',
          value: 24
        },
        {
          field: 'ticket.requestType',
          operator: 'equals',
          value: '临时权限'
        }
      ],
      actions: [
        {
          type: 'warn',
          message: '审批已超时'
        }
      ],
      failureExplanation: '根据《临时权限管理办法》规定，临时权限申请必须在24小时内完成审批流程。本批次申请从提交到当前状态已超过24小时，不符合时效要求。',
      nextStepSuggestion: '请核实超时原因，如需继续办理需重新提交申请并备注超时说明，或联系审批管理员进行特殊通道处理。'
    },
    {
      id: 'RULE-003',
      version: '1.0.0',
      name: '历史规则-仅部门经理审批',
      description: '（已废止）2023年前仅需部门经理审批',
      effectiveFrom: new Date('2022-01-01'),
      effectiveTo: new Date('2022-12-31'),
      isActive: false,
      conditions: [],
      actions: [],
      failureExplanation: '此规则仅适用于2022年及之前的历史数据',
      nextStepSuggestion: '历史批次请使用当时的规则口径进行解释'
    }
  ];
}
