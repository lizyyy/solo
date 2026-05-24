import {
  SamplingConfig,
  SamplingRule,
  Trace,
  Span,
  SamplingResult,
  RuleMatchDetail,
  SamplingDecision,
  BudgetStats
} from './types';

interface BudgetState {
  globalUsed: number;
  ruleUsed: Map<string, number>;
  lastResetTime: number;
}

export class SamplingEngine {
  private config: SamplingConfig;
  private budgetState: BudgetState;
  private globalBudgetLimit: number;
  private ruleBudgetLimits: Map<string, number>;
  private budgetStats: BudgetStats;

  constructor(config: SamplingConfig, overrideBudget?: number) {
    this.config = this.normalizeConfig(config);
    this.budgetState = {
      globalUsed: 0,
      ruleUsed: new Map(),
      lastResetTime: 0
    };

    this.globalBudgetLimit = overrideBudget ?? config.globalPerSecondLimit ?? Infinity;
    this.ruleBudgetLimits = new Map();

    for (const rule of config.rules) {
      if (rule.perSecondLimit) {
        this.ruleBudgetLimits.set(rule.name, rule.perSecondLimit);
      }
    }

    this.budgetStats = this.initBudgetStats();
  }

  private normalizeConfig(config: SamplingConfig): SamplingConfig {
    const sortedRules = [...config.rules].sort((a, b) => b.priority - a.priority);
    return {
      ...config,
      rules: sortedRules
    };
  }

  private initBudgetStats(): BudgetStats {
    const ruleBudgets: Record<string, any> = {};

    for (const rule of this.config.rules) {
      if (rule.perSecondLimit) {
        ruleBudgets[rule.name] = {
          limitPerSecond: rule.perSecondLimit,
          used: 0,
          remaining: rule.perSecondLimit,
          exhausted: false
        };
      }
    }

    return {
      globalBudget: this.globalBudgetLimit !== Infinity ? {
        limitPerSecond: this.globalBudgetLimit,
        allocated: this.globalBudgetLimit,
        used: 0,
        remaining: this.globalBudgetLimit,
        exhausted: false
      } : undefined,
      ruleBudgets,
      totalTracesEvaluated: 0,
      totalTracesSampled: 0,
      totalTracesDropped: 0,
      effectiveSamplingRate: 0
    };
  }

  public evaluateTrace(trace: Trace): SamplingResult {
    const evaluationStart = Date.now();
    const caseAdjustments: Array<{ field: string; original: string; adjusted: string }> = [];
    const missingFields: string[] = [];

    if (!trace.rootSpan) {
      missingFields.push('rootSpan');
    }

    const ruleEvaluations: RuleMatchDetail[] = [];
    let matchedRule: SamplingRule | undefined;

    for (const rule of this.config.rules) {
      const evaluation = this.evaluateRule(rule, trace, caseAdjustments);
      ruleEvaluations.push(evaluation);

      if (evaluation.matched) {
        matchedRule = rule;
        break;
      }
    }

    const effectiveRatio = matchedRule?.samplingRatio ?? this.config.defaultSamplingRatio;
    const randomNumber = Math.random();
    const ratioPassed = randomNumber < effectiveRatio;

    let droppedDueToBudget = false;
    let budgetExhausted = false;

    if (ratioPassed && matchedRule) {
      const budgetCheck = this.checkAndConsumeBudget(matchedRule);
      droppedDueToBudget = !budgetCheck.allowed;
      budgetExhausted = budgetCheck.exhausted;
    }

    const shouldSample = ratioPassed && !droppedDueToBudget;
    const baseDecision = matchedRule?.decision ?? this.config.defaultDecision;

    let finalDecision: SamplingDecision;
    if (baseDecision === SamplingDecision.DROP) {
      finalDecision = SamplingDecision.DROP;
    } else if (!shouldSample) {
      finalDecision = SamplingDecision.DROP;
    } else {
      finalDecision = baseDecision;
    }

    this.updateStats(finalDecision, matchedRule);

    const evaluationEnd = Date.now();

    return {
      traceId: trace.traceId,
      finalDecision,
      matchedRule,
      effectiveSamplingRatio: effectiveRatio,
      randomNumber,
      ruleEvaluations,
      droppedDueToBudget,
      budgetExhausted,
      missingFields,
      caseAdjustments,
      timing: {
        evaluationStart,
        evaluationEnd,
        totalDurationMs: evaluationEnd - evaluationStart
      }
    };
  }

  private evaluateRule(
    rule: SamplingRule,
    trace: Trace,
    caseAdjustments: Array<{ field: string; original: string; adjusted: string }>
  ): RuleMatchDetail {
    const matchReasons: string[] = [];
    const mismatchReasons: string[] = [];
    const attributeMatches: RuleMatchDetail['attributeMatches'] = [];

    const caseSensitive = this.config.caseSensitive ?? false;

    let serviceNameMatch: boolean | undefined;

    if (rule.serviceName) {
      const traceServices = trace.serviceNames;
      const match = caseSensitive
        ? traceServices.some(s => s === rule.serviceName)
        : traceServices.some(s => s.toLowerCase() === rule.serviceName!.toLowerCase());

      serviceNameMatch = match;

      if (match) {
        matchReasons.push(`服务名匹配: ${rule.serviceName}`);
      } else {
        mismatchReasons.push(`服务名不匹配: 期望 ${rule.serviceName}, 实际 [${traceServices.join(', ')}]`);
      }

      if (!caseSensitive && rule.serviceName) {
        const matchedService = traceServices.find(s =>
          s.toLowerCase() === rule.serviceName!.toLowerCase() && s !== rule.serviceName
        );
        if (matchedService) {
          caseAdjustments.push({
            field: 'serviceName',
            original: matchedService,
            adjusted: rule.serviceName
          });
        }
      }
    } else if (rule.serviceNamePattern) {
      try {
        const pattern = caseSensitive
          ? new RegExp(rule.serviceNamePattern)
          : new RegExp(rule.serviceNamePattern, 'i');

        const match = trace.serviceNames.some(s => pattern.test(s));
        serviceNameMatch = match;

        if (match) {
          matchReasons.push(`服务名模式匹配: ${rule.serviceNamePattern}`);
        } else {
          mismatchReasons.push(`服务名模式不匹配: ${rule.serviceNamePattern}`);
        }
      } catch (e) {
        mismatchReasons.push(`服务名模式无效: ${rule.serviceNamePattern}`);
        serviceNameMatch = false;
      }
    }

    if (rule.attributes && rule.attributes.length > 0) {
      const allAttrs = this.collectAllAttributes(trace);

      for (const attrFilter of rule.attributes) {
        const actualValue = this.getAttributeValue(allAttrs, attrFilter.key, caseSensitive);

        let attrMatched = false;

        if (actualValue === undefined) {
          attributeMatches.push({
            key: attrFilter.key,
            matched: false,
            actual: undefined
          });
          if (this.config.strictAttributeMatch) {
            mismatchReasons.push(`属性缺失: ${attrFilter.key}`);
          }
          continue;
        }

        if (attrFilter.value !== undefined) {
          const expected = attrFilter.value;
          attrMatched = caseSensitive
            ? String(actualValue) === String(expected)
            : String(actualValue).toLowerCase() === String(expected).toLowerCase();

          attributeMatches.push({
            key: attrFilter.key,
            expected,
            actual: actualValue,
            matched: attrMatched,
            caseAdjusted: !caseSensitive && String(actualValue).toLowerCase() === String(expected).toLowerCase() && String(actualValue) !== String(expected)
          });

          if (attrMatched) {
            matchReasons.push(`属性匹配: ${attrFilter.key}=${expected}`);
          } else {
            mismatchReasons.push(`属性值不匹配: ${attrFilter.key} 期望 ${expected}, 实际 ${actualValue}`);
          }
        } else if (attrFilter.pattern) {
          try {
            const pattern = caseSensitive
              ? new RegExp(attrFilter.pattern)
              : new RegExp(attrFilter.pattern, 'i');

            attrMatched = pattern.test(String(actualValue));
            attributeMatches.push({
              key: attrFilter.key,
              expected: attrFilter.pattern,
              actual: actualValue,
              matched: attrMatched
            });

            if (attrMatched) {
              matchReasons.push(`属性模式匹配: ${attrFilter.key} ~= ${attrFilter.pattern}`);
            } else {
              mismatchReasons.push(`属性模式不匹配: ${attrFilter.key}`);
            }
          } catch (e) {
            mismatchReasons.push(`属性模式无效: ${attrFilter.key} = ${attrFilter.pattern}`);
            attributeMatches.push({
              key: attrFilter.key,
              matched: false
            });
          }
        }
      }
    }

    let attributesConditionMet = true;
    if (rule.attributes && rule.attributes.length > 0) {
      const hasAnyActualValue = attributeMatches.some(m => m.actual !== undefined);
      const allExistingMatched = attributeMatches.every(m => 
        m.matched || (this.config.strictAttributeMatch === false && m.actual === undefined)
      );
      
      if (this.config.strictAttributeMatch) {
        attributesConditionMet = allExistingMatched && hasAnyActualValue;
      } else {
        attributesConditionMet = hasAnyActualValue ? allExistingMatched : false;
      }
    }

    const allConditionsMet =
      (serviceNameMatch === undefined || serviceNameMatch) &&
      attributesConditionMet;

    return {
      ruleName: rule.name,
      rulePriority: rule.priority,
      matched: allConditionsMet,
      matchReasons,
      mismatchReasons,
      serviceNameMatch,
      attributeMatches
    };
  }

  private collectAllAttributes(trace: Trace): Record<string, string | number | boolean> {
    const allAttrs: Record<string, string | number | boolean> = {};

    for (const span of trace.spans) {
      for (const [key, value] of Object.entries(span.attributes)) {
        if (allAttrs[key] === undefined) {
          allAttrs[key] = value;
        }
      }
    }

    return allAttrs;
  }

  private getAttributeValue(
    attrs: Record<string, string | number | boolean>,
    key: string,
    caseSensitive: boolean
  ): string | number | boolean | undefined {
    if (caseSensitive) {
      return attrs[key];
    }

    const lowerKey = key.toLowerCase();
    for (const [k, v] of Object.entries(attrs)) {
      if (k.toLowerCase() === lowerKey) {
        return v;
      }
    }

    return undefined;
  }

  private checkAndConsumeBudget(rule: SamplingRule): { allowed: boolean; exhausted: boolean } {
    const now = Date.now();
    const currentSecond = Math.floor(now / 1000);

    if (currentSecond !== this.budgetState.lastResetTime) {
      this.budgetState.globalUsed = 0;
      this.budgetState.ruleUsed.clear();
      this.budgetState.lastResetTime = currentSecond;

      if (this.budgetStats.globalBudget) {
        this.budgetStats.globalBudget.used = 0;
        this.budgetStats.globalBudget.remaining = this.globalBudgetLimit;
        this.budgetStats.globalBudget.exhausted = false;
      }

      for (const [ruleName, limit] of this.ruleBudgetLimits) {
        if (this.budgetStats.ruleBudgets[ruleName]) {
          this.budgetStats.ruleBudgets[ruleName].used = 0;
          this.budgetStats.ruleBudgets[ruleName].remaining = limit;
          this.budgetStats.ruleBudgets[ruleName].exhausted = false;
        }
      }
    }

    let globalExhausted = false;
    if (this.globalBudgetLimit !== Infinity) {
      if (this.budgetState.globalUsed >= this.globalBudgetLimit) {
        globalExhausted = true;
      }
    }

    const ruleLimit = this.ruleBudgetLimits.get(rule.name);
    let ruleExhausted = false;
    if (ruleLimit !== undefined) {
      const ruleUsed = this.budgetState.ruleUsed.get(rule.name) ?? 0;
      if (ruleUsed >= ruleLimit) {
        ruleExhausted = true;
      }
    }

    const exhausted = globalExhausted || ruleExhausted;

    if (!exhausted) {
      if (this.globalBudgetLimit !== Infinity) {
        this.budgetState.globalUsed++;
        if (this.budgetStats.globalBudget) {
          this.budgetStats.globalBudget.used++;
          this.budgetStats.globalBudget.remaining--;
          this.budgetStats.globalBudget.exhausted = this.budgetStats.globalBudget.used >= this.globalBudgetLimit;
        }
      }

      if (ruleLimit !== undefined) {
        const current = this.budgetState.ruleUsed.get(rule.name) ?? 0;
        this.budgetState.ruleUsed.set(rule.name, current + 1);

        if (this.budgetStats.ruleBudgets[rule.name]) {
          this.budgetStats.ruleBudgets[rule.name].used++;
          this.budgetStats.ruleBudgets[rule.name].remaining--;
          this.budgetStats.ruleBudgets[rule.name].exhausted =
            this.budgetStats.ruleBudgets[rule.name].used >= ruleLimit;
        }
      }
    }

    return {
      allowed: !exhausted,
      exhausted
    };
  }

  private updateStats(decision: SamplingDecision, matchedRule?: SamplingRule): void {
    this.budgetStats.totalTracesEvaluated++;

    if (decision === SamplingDecision.RECORD_AND_SAMPLE) {
      this.budgetStats.totalTracesSampled++;
    } else if (decision === SamplingDecision.DROP) {
      this.budgetStats.totalTracesDropped++;
    }

    this.budgetStats.effectiveSamplingRate =
      this.budgetStats.totalTracesEvaluated > 0
        ? this.budgetStats.totalTracesSampled / this.budgetStats.totalTracesEvaluated
        : 0;
  }

  public getBudgetStats(): BudgetStats {
    return JSON.parse(JSON.stringify(this.budgetStats));
  }

  public getConfig(): SamplingConfig {
    return this.config;
  }
}
