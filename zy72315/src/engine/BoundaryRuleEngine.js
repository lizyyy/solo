const BOUNDARY_RULES = {
  DENOMINATOR_EMPTY_STRING: {
    id: 'DENOMINATOR_EMPTY_STRING',
    description: '分母为空字符串',
    severity: 'needs_review',
    autoHandle: false,
    displayBehavior: 'show_as_abnormal',
    reviewRequired: true
  },
  DENOMINATOR_ZERO: {
    id: 'DENOMINATOR_ZERO',
    description: '分母为0',
    severity: 'needs_review',
    autoHandle: false,
    displayBehavior: 'show_as_abnormal',
    reviewRequired: true
  },
  NUMERATOR_MISSING: {
    id: 'NUMERATOR_MISSING',
    description: '分子缺失',
    severity: 'warning',
    autoHandle: true,
    displayBehavior: 'show_zero',
    reviewRequired: false
  },
  BOTH_MISSING: {
    id: 'BOTH_MISSING',
    description: '分子分母均缺失',
    severity: 'needs_review',
    autoHandle: false,
    displayBehavior: 'show_as_abnormal',
    reviewRequired: true
  },
  NORMAL: {
    id: 'NORMAL',
    description: '正常数据',
    severity: 'normal',
    autoHandle: true,
    displayBehavior: 'show_calculated',
    reviewRequired: false
  }
};

class BoundaryRuleEngine {
  constructor() {
    this.rules = BOUNDARY_RULES;
  }

  evaluate(record) {
    const boundaryData = record.boundaryEvidence?.rawData || {};
    const { numerator, denominator } = boundaryData;

    const result = {
      ruleId: null,
      ruleDescription: '',
      severity: 'normal',
      displayValue: null,
      reviewRequired: false,
      rawInputs: { numerator, denominator },
      notes: []
    };

    if (denominator === '' || denominator === null || denominator === undefined) {
      result.ruleId = 'DENOMINATOR_EMPTY_STRING';
      result.ruleDescription = '分母为空字符串（或未填写）';
      result.severity = 'needs_review';
      result.displayValue = '[需复核 - 分母为空]';
      result.reviewRequired = true;
      result.notes.push('数据复核人请确认：分母是漏填还是确实为0？');
      result.notes.push('运营规划阿岚：不急着归正常，先留复核');
      return result;
    }

    if (denominator === 0) {
      result.ruleId = 'DENOMINATOR_ZERO';
      result.ruleDescription = '分母为0';
      result.severity = 'needs_review';
      result.displayValue = '[需复核 - 分母为0]';
      result.reviewRequired = true;
      result.notes.push('数据复核人请确认：分母为0的业务含义？');
      result.notes.push('运营规划阿岚：不急着归正常，先留复核');
      return result;
    }

    if (numerator === '' || numerator === null || numerator === undefined) {
      result.ruleId = 'NUMERATOR_MISSING';
      result.ruleDescription = '分子缺失，按0处理';
      result.severity = 'warning';
      result.displayValue = (0 / Number(denominator)).toFixed(4);
      result.reviewRequired = false;
      result.notes.push('系统自动将缺失分子按0计算');
      return result;
    }

    result.ruleId = 'NORMAL';
    result.ruleDescription = '正常计算';
    result.severity = 'normal';
    result.displayValue = (Number(numerator) / Number(denominator)).toFixed(4);
    result.reviewRequired = false;
    return result;
  }

  canApplyAutoFix(ruleId) {
    const rule = this.rules[ruleId];
    return rule ? rule.autoHandle : false;
  }

  getDisplayBehavior(ruleId) {
    const rule = this.rules[ruleId];
    return rule ? rule.displayBehavior : 'show_as_abnormal';
  }

  applyManualFix(record, fixType, operator, reason) {
    const evaluation = this.evaluate(record);
    const boundaryData = record.boundaryEvidence?.rawData || {};

    const fixes = {
      SET_DENOMINATOR_ZERO: () => {
        if (evaluation.ruleId !== 'DENOMINATOR_EMPTY_STRING') {
          throw new Error('该修复仅适用于分母为空字符串的情况');
        }
        return {
          field: 'boundaryEvidence.rawData.denominator',
          oldValue: boundaryData.denominator,
          newValue: 0,
          note: '人工确认：空分母修正为0'
        };
      },
      SET_DENOMINATOR_EMPTY: () => {
        return {
          field: 'boundaryEvidence.rawData.denominator',
          oldValue: boundaryData.denominator,
          newValue: '',
          note: '人工修正：分母改为空'
        };
      },
      OVERRIDE_RESULT: (value) => ({
        field: 'unifiedResult.overrideValue',
        oldValue: record.unifiedResult?.overrideValue || null,
        newValue: value,
        note: `人工覆盖结果为: ${value}`
      })
    };

    const fix = fixes[fixType];
    if (!fix) {
      throw new Error(`未知的修复类型: ${fixType}`);
    }

    return fix();
  }

  getAllRules() {
    return Object.values(this.rules).map(rule => ({
      id: rule.id,
      description: rule.description,
      severity: rule.severity,
      reviewRequired: rule.reviewRequired,
      canAutoHandle: rule.autoHandle
    }));
  }

  explainRule(ruleId) {
    const rule = this.rules[ruleId];
    if (!rule) return null;

    const explanations = {
      DENOMINATOR_EMPTY_STRING: `
【运营规划阿岚 ↔ 数据复核人 交接说明】
现象：Excel 里分母那格是空的（什么都没填）
处理方式：系统不会自动改成0，也不会跳过这条记录
显示方式：页面、导出、接口都会显示"[需复核 - 分母为空]"，不会一个地方正常一个地方消失
复核要求：数据复核人请确认是空着没填，还是业务上就是0
回滚：如果改错了，可以在人工变更记录里回滚
      `,
      DENOMINATOR_ZERO: `
【运营规划阿岚 ↔ 数据复核人 交接说明】
现象：分母填的是0
处理方式：系统不会自动处理，保留原始数据
显示方式：统一显示"[需复核 - 分母为0]"，各处一致
复核要求：请确认分母为0的业务场景，是否需要特殊处理
      `,
      NORMAL: `
【运营规划阿岚 ↔ 数据复核人 交接说明】
现象：分子分母都有有效值
处理方式：自动计算转化率/比率
显示方式：显示计算结果（保留4位小数）
复核要求：无需复核，正常流转
      `
    };

    return {
      ...rule,
      explanation: explanations[ruleId] || rule.description
    };
  }
}

module.exports = BoundaryRuleEngine;
module.exports.BOUNDARY_RULES = BOUNDARY_RULES;
