const Enterprise = require('../models/Enterprise');
const TaxPeriod = require('../models/TaxPeriod');
const ValidationRule = require('../models/ValidationRule');
const ResponseUtils = require('../utils/response');
const logger = require('../utils/logger');
const { getOperatorInfo } = require('../middleware/upload');

class MasterDataController {
  static async getEnterprises(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const pageSize = parseInt(req.query.pageSize) || 20;
      const skip = (page - 1) * pageSize;

      const query = {};
      if (req.query.status) query.status = req.query.status;
      if (req.query.industry) query.industry = req.query.industry;

      const [enterprises, total] = await Promise.all([
        Enterprise.find(query).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
        Enterprise.countDocuments(query)
      ]);

      return ResponseUtils.success(res, {
        enterprises,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
      });
    } catch (error) {
      logger.error('[MasterDataController.getEnterprises] 查询失败', error);
      return ResponseUtils.error(res, error.message || '查询失败');
    }
  }

  static async createEnterprise(req, res) {
    try {
      const operatorInfo = getOperatorInfo(req);
      const { enterpriseCode, enterpriseName, taxRegistrationNumber, industry, contactPerson, contactPhone, contactEmail } = req.body;

      if (!enterpriseCode || !enterpriseName) {
        return ResponseUtils.badRequest(res, '企业代码和企业名称不能为空');
      }

      const existing = await Enterprise.findOne({ enterpriseCode });
      if (existing) {
        return ResponseUtils.badRequest(res, '企业代码已存在');
      }

      const enterprise = await Enterprise.create({
        enterpriseCode,
        enterpriseName,
        taxRegistrationNumber,
        industry,
        contactPerson,
        contactPhone,
        contactEmail,
        createdBy: operatorInfo.operator,
        updatedBy: operatorInfo.operator
      });

      return ResponseUtils.success(res, enterprise, '企业创建成功');
    } catch (error) {
      logger.error('[MasterDataController.createEnterprise] 创建失败', error);
      return ResponseUtils.badRequest(res, error.message || '创建失败');
    }
  }

  static async updateEnterprise(req, res) {
    try {
      const operatorInfo = getOperatorInfo(req);
      const { enterpriseCode } = req.params;

      const enterprise = await Enterprise.findOne({ enterpriseCode });
      if (!enterprise) {
        return ResponseUtils.notFound(res, '企业不存在');
      }

      const updated = await Enterprise.findOneAndUpdate(
        { enterpriseCode },
        { ...req.body, updatedBy: operatorInfo.operator },
        { new: true }
      );

      return ResponseUtils.success(res, updated, '企业更新成功');
    } catch (error) {
      logger.error('[MasterDataController.updateEnterprise] 更新失败', error);
      return ResponseUtils.error(res, error.message || '更新失败');
    }
  }

  static async getPeriods(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const pageSize = parseInt(req.query.pageSize) || 20;
      const skip = (page - 1) * pageSize;

      const query = {};
      if (req.query.status) query.status = req.query.status;
      if (req.query.periodType) query.periodType = req.query.periodType;
      if (req.query.year) query.year = parseInt(req.query.year);

      const [periods, total] = await Promise.all([
        TaxPeriod.find(query).sort({ year: -1, month: -1 }).skip(skip).limit(pageSize),
        TaxPeriod.countDocuments(query)
      ]);

      return ResponseUtils.success(res, {
        periods,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
      });
    } catch (error) {
      logger.error('[MasterDataController.getPeriods] 查询失败', error);
      return ResponseUtils.error(res, error.message || '查询失败');
    }
  }

  static async createPeriod(req, res) {
    try {
      const operatorInfo = getOperatorInfo(req);
      const { periodType, year, month, quarter, startDate, endDate, declarationDeadline, description } = req.body;

      if (!periodType || !year || !startDate || !endDate || !declarationDeadline) {
        return ResponseUtils.badRequest(res, '请填写完整的申报期信息');
      }

      const periodCode = TaxPeriod.generatePeriodCode(periodType, year, month, quarter);

      const existing = await TaxPeriod.findOne({ periodCode });
      if (existing) {
        return ResponseUtils.badRequest(res, `申报期 ${periodCode} 已存在`);
      }

      const period = await TaxPeriod.create({
        periodCode,
        periodType,
        year,
        month: periodType === 'MONTHLY' ? month : undefined,
        quarter: periodType === 'QUARTERLY' ? quarter : undefined,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        declarationDeadline: new Date(declarationDeadline),
        description
      });

      return ResponseUtils.success(res, period, '申报期创建成功');
    } catch (error) {
      logger.error('[MasterDataController.createPeriod] 创建失败', error);
      return ResponseUtils.badRequest(res, error.message || '创建失败');
    }
  }

  static async updatePeriod(req, res) {
    try {
      const operatorInfo = getOperatorInfo(req);
      const { periodCode } = req.params;

      const period = await TaxPeriod.findOne({ periodCode });
      if (!period) {
        return ResponseUtils.notFound(res, '申报期不存在');
      }

      const updateData = { ...req.body };
      if (updateData.startDate) updateData.startDate = new Date(updateData.startDate);
      if (updateData.endDate) updateData.endDate = new Date(updateData.endDate);
      if (updateData.declarationDeadline) updateData.declarationDeadline = new Date(updateData.declarationDeadline);

      const updated = await TaxPeriod.findOneAndUpdate(
        { periodCode },
        updateData,
        { new: true }
      );

      return ResponseUtils.success(res, updated, '申报期更新成功');
    } catch (error) {
      logger.error('[MasterDataController.updatePeriod] 更新失败', error);
      return ResponseUtils.error(res, error.message || '更新失败');
    }
  }

  static async getRules(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const pageSize = parseInt(req.query.pageSize) || 20;
      const skip = (page - 1) * pageSize;

      const query = {};
      if (req.query.status) query.status = req.query.status;
      if (req.query.periodType) query.periodType = req.query.periodType;

      const [rules, total] = await Promise.all([
        ValidationRule.find(query).sort({ priority: -1 }).skip(skip).limit(pageSize),
        ValidationRule.countDocuments(query)
      ]);

      return ResponseUtils.success(res, {
        rules,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
      });
    } catch (error) {
      logger.error('[MasterDataController.getRules] 查询失败', error);
      return ResponseUtils.error(res, error.message || '查询失败');
    }
  }

  static async createRule(req, res) {
    try {
      const operatorInfo = getOperatorInfo(req);
      const { ruleCode, ruleName, periodType, applicableIndustries, requiredAttachments, priority } = req.body;

      if (!ruleCode || !ruleName || !requiredAttachments || requiredAttachments.length === 0) {
        return ResponseUtils.badRequest(res, '请填写完整的校验规则信息');
      }

      const existing = await ValidationRule.findOne({ ruleCode });
      if (existing) {
        return ResponseUtils.badRequest(res, '规则代码已存在');
      }

      const rule = await ValidationRule.create({
        ruleCode,
        ruleName,
        periodType,
        applicableIndustries,
        requiredAttachments,
        priority,
        createdBy: operatorInfo.operator,
        updatedBy: operatorInfo.operator
      });

      return ResponseUtils.success(res, rule, '校验规则创建成功');
    } catch (error) {
      logger.error('[MasterDataController.createRule] 创建失败', error);
      return ResponseUtils.badRequest(res, error.message || '创建失败');
    }
  }

  static async updateRule(req, res) {
    try {
      const operatorInfo = getOperatorInfo(req);
      const { ruleCode } = req.params;

      const rule = await ValidationRule.findOne({ ruleCode });
      if (!rule) {
        return ResponseUtils.notFound(res, '规则不存在');
      }

      const updated = await ValidationRule.findOneAndUpdate(
        { ruleCode },
        { ...req.body, updatedBy: operatorInfo.operator },
        { new: true }
      );

      return ResponseUtils.success(res, updated, '规则更新成功');
    } catch (error) {
      logger.error('[MasterDataController.updateRule] 更新失败', error);
      return ResponseUtils.error(res, error.message || '更新失败');
    }
  }
}

module.exports = MasterDataController;
