class RuleEngine {
  constructor(rules) {
    this.rules = rules.filter(rule => rule.isActive);
  }

  evaluateSample(sample) {
    const result = {
      blocked: false,
      discountApplied: 0,
      membershipBenefits: {},
      hitRules: [],
      conflicts: []
    };

    const groupedRules = this._groupByMutualExclusion(this.rules);

    for (const [groupName, groupRules] of Object.entries(groupedRules)) {
      const sortedRules = groupRules.sort((a, b) => b.priority - a.priority);
      const hitRulesInGroup = [];

      for (const rule of sortedRules) {
        if (this._matchesCondition(rule.conditions, sample)) {
          hitRulesInGroup.push(rule);
        }
      }

      if (hitRulesInGroup.length > 0) {
        if (groupName !== 'ungrouped' && hitRulesInGroup.length > 1) {
          result.conflicts.push({
            groupName,
            rules: hitRulesInGroup.map(r => ({
              ruleId: r.ruleId,
              ruleName: r.ruleName,
              ruleType: r.ruleType
            }))
          });
          
          const highestPriorityRule = hitRulesInGroup[0];
          this._applyRule(highestPriorityRule, sample, result);
        } else {
          for (const rule of hitRulesInGroup) {
            this._applyRule(rule, sample, result);
          }
        }
      }
    }

    return result;
  }

  _groupByMutualExclusion(rules) {
    const groups = { ungrouped: [] };
    
    for (const rule of rules) {
      if (rule.mutuallyExclusiveGroup) {
        if (!groups[rule.mutuallyExclusiveGroup]) {
          groups[rule.mutuallyExclusiveGroup] = [];
        }
        groups[rule.mutuallyExclusiveGroup].push(rule);
      } else {
        groups.ungrouped.push(rule);
      }
    }
    
    return groups;
  }

  _matchesCondition(conditions, sample) {
    if (!conditions || Object.keys(conditions).length === 0) {
      return true;
    }

    for (const [field, condition] of Object.entries(conditions)) {
      if (!this._evaluateCondition(field, condition, sample)) {
        return false;
      }
    }
    
    return true;
  }

  _evaluateCondition(field, condition, sample) {
    if (typeof condition === 'object' && condition !== null) {
      if (condition.$eq !== undefined) {
        return this._getNestedValue(sample, field) === condition.$eq;
      }
      if (condition.$ne !== undefined) {
        return this._getNestedValue(sample, field) !== condition.$ne;
      }
      if (condition.$gt !== undefined) {
        return this._getNestedValue(sample, field) > condition.$gt;
      }
      if (condition.$gte !== undefined) {
        return this._getNestedValue(sample, field) >= condition.$gte;
      }
      if (condition.$lt !== undefined) {
        return this._getNestedValue(sample, field) < condition.$lt;
      }
      if (condition.$lte !== undefined) {
        return this._getNestedValue(sample, field) <= condition.$lte;
      }
      if (condition.$in !== undefined) {
        return condition.$in.includes(this._getNestedValue(sample, field));
      }
      if (condition.$contains !== undefined) {
        const value = this._getNestedValue(sample, field);
        return Array.isArray(value) && value.includes(condition.$contains);
      }
    } else {
      return this._getNestedValue(sample, field) === condition;
    }
    
    return false;
  }

  _getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  _applyRule(rule, sample, result) {
    result.hitRules.push({
      ruleId: rule.ruleId,
      ruleType: rule.ruleType,
      ruleName: rule.ruleName,
      hitReason: this._generateHitReason(rule, sample)
    });

    if (rule.ruleType === 'risk_control') {
      if (rule.actions.block === true) {
        result.blocked = true;
      }
    } else if (rule.ruleType === 'discount_threshold') {
      if (rule.actions.discount) {
        result.discountApplied = Math.max(result.discountApplied, rule.actions.discount);
      }
    } else if (rule.ruleType === 'membership_benefit') {
      if (rule.actions.benefits) {
        Object.assign(result.membershipBenefits, rule.actions.benefits);
      }
    }
  }

  _generateHitReason(rule, sample) {
    const reasons = [];
    
    for (const [field, condition] of Object.entries(rule.conditions)) {
      const value = this._getNestedValue(sample, field);
      
      if (typeof condition === 'object' && condition !== null) {
        if (condition.$gt !== undefined) {
          reasons.push(`${field}=${value} > ${condition.$gt}`);
        } else if (condition.$gte !== undefined) {
          reasons.push(`${field}=${value} >= ${condition.$gte}`);
        } else if (condition.$lt !== undefined) {
          reasons.push(`${field}=${value} < ${condition.$lt}`);
        } else if (condition.$lte !== undefined) {
          reasons.push(`${field}=${value} <= ${condition.$lte}`);
        } else if (condition.$eq !== undefined) {
          reasons.push(`${field}=${value} == ${condition.$eq}`);
        } else if (condition.$in !== undefined) {
          reasons.push(`${field}=${value} in ${JSON.stringify(condition.$in)}`);
        }
      } else {
        reasons.push(`${field}=${value}`);
      }
    }
    
    return reasons.join(' AND ');
  }
}

module.exports = RuleEngine;
