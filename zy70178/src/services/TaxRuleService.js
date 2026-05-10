const TaxRule = require('../models/TaxRule');
const store = require('../stores/MemoryStore');

class TaxRuleService {
  static createRule(params) {
    if (!params.name || !params.code || params.taxRate === undefined || !params.taxType || !params.effectiveDate) {
      throw new Error('税率规则缺少必要字段：name, code, taxRate, taxType, effectiveDate 为必填项');
    }

    if (typeof params.taxRate !== 'number' || params.taxRate < 0 || params.taxRate > 1) {
      throw new Error('税率必须是 0 到 1 之间的小数，例如 0.13 代表 13%');
    }

    const existing = store.getTaxRuleByCode(params.code);
    if (existing) {
      throw new Error(`税率代码 ${params.code} 已存在，不允许重复创建`);
    }

    const rule = new TaxRule({
      ...params,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    store.saveTaxRule(rule);
    return rule;
  }

  static updateRule(id, updates) {
    const existing = store.getTaxRuleById(id);
    if (!existing) {
      throw new Error(`税率规则 ${id} 不存在`);
    }

    if (updates.taxRate !== undefined && (typeof updates.taxRate !== 'number' || updates.taxRate < 0 || updates.taxRate > 1)) {
      throw new Error('税率必须是 0 到 1 之间的小数');
    }

    const updatedRule = new TaxRule({
      ...existing,
      ...updates,
      id: existing.id,
      updatedAt: new Date().toISOString()
    });

    store.saveTaxRule(updatedRule);
    return updatedRule;
  }

  static deactivateRule(id) {
    return this.updateRule(id, { isActive: false });
  }

  static activateRule(id) {
    return this.updateRule(id, { isActive: true });
  }

  static getRuleById(id) {
    return store.getTaxRuleById(id);
  }

  static getRuleByCode(code) {
    return store.getTaxRuleByCode(code);
  }

  static getAllRules() {
    return store.getAllTaxRules();
  }

  static getActiveRules() {
    return this.getAllRules().filter(r => r.isActive);
  }

  static findApplicableRule(industry = null, date = null) {
    const activeRules = this.getActiveRules();
    
    const applicable = activeRules.filter(rule => {
      if (!rule.isApplicableOn(date)) return false;
      if (rule.applicableIndustry && industry) {
        return rule.applicableIndustry === industry;
      }
      if (rule.applicableIndustry && !industry) return false;
      return true;
    });

    if (applicable.length === 0) {
      return null;
    }

    applicable.sort((a, b) => b.priority - a.priority);
    return applicable[0];
  }

  static findApplicableRuleByCode(code, date = null) {
    const rule = this.getRuleByCode(code);
    if (!rule || !rule.isActive) {
      return null;
    }
    if (rule.isApplicableOn(date)) {
      return rule;
    }
    return null;
  }

  static generateRuleSummary(rule) {
    return {
      id: rule.id,
      name: rule.name,
      code: rule.code,
      taxRate: rule.taxRate,
      taxRatePercentage: rule.getTaxRatePercentage(),
      taxType: rule.taxType,
      applicableIndustry: rule.applicableIndustry,
      effectivePeriod: {
        start: rule.effectiveDate,
        end: rule.expiryDate || '永久有效'
      },
      isActive: rule.isActive,
      priority: rule.priority
    };
  }

  static initializeDefaultRules() {
    const rules = [
      {
        name: '一般纳税人增值税 13%',
        code: 'VAT_13',
        taxRate: 0.13,
        taxType: 'VAT',
        applicableIndustry: 'GENERAL',
        effectiveDate: '2019-04-01',
        priority: 10
      },
      {
        name: '一般纳税人增值税 9%',
        code: 'VAT_9',
        taxRate: 0.09,
        taxType: 'VAT',
        applicableIndustry: 'TRANSPORTATION',
        effectiveDate: '2019-04-01',
        priority: 10
      },
      {
        name: '一般纳税人增值税 6%',
        code: 'VAT_6',
        taxRate: 0.06,
        taxType: 'VAT',
        applicableIndustry: 'SERVICE',
        effectiveDate: '2019-04-01',
        priority: 10
      },
      {
        name: '小规模纳税人增值税 3%',
        code: 'VAT_3',
        taxRate: 0.03,
        taxType: 'VAT_SMALL',
        applicableIndustry: null,
        effectiveDate: '2019-04-01',
        priority: 5
      },
      {
        name: '免税',
        code: 'VAT_0',
        taxRate: 0,
        taxType: 'VAT_EXEMPT',
        applicableIndustry: null,
        effectiveDate: '2019-04-01',
        priority: 1
      }
    ];

    rules.forEach(rule => {
      try {
        this.createRule(rule);
      } catch (e) {
      }
    });

    return this.getAllRules();
  }
}

module.exports = TaxRuleService;
