const TaxRuleService = require('../services/TaxRuleService');
const ResponseHandler = require('../utils/responseHandler');

class TaxRuleController {
  static async createRule(req, res) {
    try {
      const rule = TaxRuleService.createRule(req.body);
      return ResponseHandler.created(
        res, 
        { rule: rule.toJSON() },
        `税率规则 ${rule.code} 创建成功`
      );
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  static async getAllRules(req, res) {
    try {
      const rules = TaxRuleService.getAllRules();
      return ResponseHandler.success(
        res,
        {
          count: rules.length,
          rules: rules.map(r => TaxRuleService.generateRuleSummary(r))
        },
        `共查询到 ${rules.length} 条税率规则`
      );
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  static async getActiveRules(req, res) {
    try {
      const rules = TaxRuleService.getActiveRules();
      return ResponseHandler.success(
        res,
        {
          count: rules.length,
          rules: rules.map(r => TaxRuleService.generateRuleSummary(r))
        },
        `共查询到 ${rules.length} 条生效的税率规则`
      );
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  static async getRuleById(req, res) {
    try {
      const rule = TaxRuleService.getRuleById(req.params.id);
      if (!rule) {
        return ResponseHandler.notFound(res, '税率规则');
      }
      return ResponseHandler.success(
        res,
        { rule: TaxRuleService.generateRuleSummary(rule) },
        `查询成功：${rule.name}`
      );
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  static async findApplicableRule(req, res) {
    try {
      const { industry, date } = req.query;
      const rule = TaxRuleService.findApplicableRule(industry, date);
      
      if (!rule) {
        return ResponseHandler.success(
          res,
          { rule: null },
          `未找到适用于行业 ${industry || '未指定'} 的税率规则`
        );
      }
      
      return ResponseHandler.success(
        res,
        { rule: TaxRuleService.generateRuleSummary(rule) },
        `找到适用税率：${rule.name} (${rule.getTaxRatePercentage()})`
      );
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  static async updateRule(req, res) {
    try {
      const rule = TaxRuleService.updateRule(req.params.id, req.body);
      return ResponseHandler.success(
        res,
        { rule: rule.toJSON() },
        `税率规则 ${rule.code} 更新成功`
      );
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  static async deactivateRule(req, res) {
    try {
      const rule = TaxRuleService.deactivateRule(req.params.id);
      return ResponseHandler.success(
        res,
        { rule: rule.toJSON() },
        `税率规则 ${rule.code} 已停用`
      );
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  static async activateRule(req, res) {
    try {
      const rule = TaxRuleService.activateRule(req.params.id);
      return ResponseHandler.success(
        res,
        { rule: rule.toJSON() },
        `税率规则 ${rule.code} 已启用`
      );
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  static async initializeDefaultRules(req, res) {
    try {
      const rules = TaxRuleService.initializeDefaultRules();
      return ResponseHandler.success(
        res,
        {
          count: rules.length,
          rules: rules.map(r => TaxRuleService.generateRuleSummary(r))
        },
        `已初始化 ${rules.length} 条默认税率规则`
      );
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }
}

module.exports = TaxRuleController;
