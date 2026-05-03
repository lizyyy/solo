import { CanaryPolicy, CanaryRule, TrafficSample, CanaryEvaluationResult } from '../types';
import { userInBucket } from '../utils/hash';
import { logger } from '../utils/logger';

export class CanaryEvaluator {
  private policy: CanaryPolicy;

  constructor(policy: CanaryPolicy) {
    this.policy = policy;
  }

  evaluate(sample: TrafficSample, targetService: string): CanaryEvaluationResult {
    logger.debug(`Evaluating canary for request: ${sample.requestId}, service: ${targetService}`);
    
    const matchedConditions: string[] = [];
    let matchedRule: CanaryRule | null = null;

    for (const rule of this.policy.rules) {
      if (rule.service !== targetService) {
        continue;
      }

      const ruleMatch = this.evaluateRule(rule, sample);
      if (ruleMatch.matched) {
        matchedRule = rule;
        matchedConditions.push(...ruleMatch.conditions);
        break;
      }
    }

    if (matchedRule) {
      const shouldHit = this.applyWeight(matchedRule);
      return {
        rule: matchedRule,
        shouldHitCanary: shouldHit,
        targetService: matchedRule.service,
        targetVersion: matchedRule.version,
        weight: matchedRule.weight,
        matchedConditions,
        reasoning: `Matched canary rule with conditions: ${matchedConditions.join(', ')}`
      };
    }

    return {
      rule: null,
      shouldHitCanary: false,
      targetService,
      targetVersion: 'stable',
      weight: 0,
      matchedConditions: [],
      reasoning: 'No canary rule matched, routing to stable version'
    };
  }

  private evaluateRule(rule: CanaryRule, sample: TrafficSample): { matched: boolean; conditions: string[] } {
    const conditions: string[] = [];
    let allMatched = true;

    if (rule.condition.headerMatch) {
      const headerValue = sample.headers[rule.condition.headerMatch.name] || 
                         sample.headers[rule.condition.headerMatch.name.toLowerCase()];
      
      if (!headerValue) {
        allMatched = false;
      } else if (rule.condition.headerMatch.regex) {
        try {
          const regex = new RegExp(rule.condition.headerMatch.value);
          if (!regex.test(headerValue)) {
            allMatched = false;
          } else {
            conditions.push(`header:${rule.condition.headerMatch.name} matches regex`);
          }
        } catch {
          allMatched = false;
        }
      } else {
        if (headerValue !== rule.condition.headerMatch.value) {
          allMatched = false;
        } else {
          conditions.push(`header:${rule.condition.headerMatch.name}=${rule.condition.headerMatch.value}`);
        }
      }
    }

    if (rule.condition.userBucket && sample.userId) {
      const inBucket = userInBucket(
        sample.userId,
        rule.condition.userBucket.percentage,
        rule.condition.userBucket.seed
      );
      
      if (!inBucket) {
        allMatched = false;
      } else {
        conditions.push(`user in ${rule.condition.userBucket.percentage}% bucket`);
      }
    }

    if (rule.condition.pathMatch) {
      const pathPattern = new RegExp(rule.condition.pathMatch.replace(/\*/g, '.*'));
      if (!pathPattern.test(sample.path)) {
        allMatched = false;
      } else {
        conditions.push(`path matches ${rule.condition.pathMatch}`);
      }
    }

    return { matched: allMatched, conditions };
  }

  private applyWeight(rule: CanaryRule): boolean {
    const random = Math.random() * 100;
    return random < rule.weight;
  }

  getPolicy(): CanaryPolicy {
    return this.policy;
  }
}
