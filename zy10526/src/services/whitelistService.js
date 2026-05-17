const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const {
  Customer,
  WhitelistType,
  WhitelistRule,
  ApplicationSource,
  CustomerWhitelist,
  HitRecord,
  ExplanationReport,
  ExceptionLog,
  sequelize
} = require('../models');

class WhitelistService {
  async createWhitelist(data, operator = 'system') {
    const t = await sequelize.transaction();
    const requestId = uuidv4();

    try {
      const { accountId, whitelistTypeCode, ruleCode, sourceCode, effectiveDate, expiryDate, remark } = data;

      const customer = await Customer.findOne({ where: { accountId } });
      if (!customer) {
        throw new Error('客户不存在');
      }

      const whitelistType = await WhitelistType.findOne({ where: { typeCode: whitelistTypeCode, isEnabled: true } });
      if (!whitelistType) {
        throw new Error('白名单类型不存在或未启用');
      }

      const whitelistRule = await WhitelistRule.findOne({ 
        where: { ruleCode, whitelistTypeId: whitelistType.id, status: 'active' } 
      });
      if (!whitelistRule) {
        throw new Error('白名单规则不存在或未激活');
      }

      const applicationSource = await ApplicationSource.findOne({ where: { sourceCode } });
      if (!applicationSource) {
        throw new Error('申请来源不存在');
      }

      const existingWhitelist = await CustomerWhitelist.findOne({
        where: {
          customerId: customer.id,
          whitelistTypeId: whitelistType.id,
          whitelistRuleId: whitelistRule.id,
          status: ['pending', 'active']
        }
      });

      if (existingWhitelist) {
        await this.logException({
          requestId,
          exceptionType: 'duplicate_call',
          severity: 'medium',
          originalInput: data,
          processingBasis: { existingWhitelistId: existingWhitelist.id },
          errorMessage: '重复的白名单申请',
          customerId: customer.id,
          customerWhitelistId: existingWhitelist.id,
          operator,
          apiEndpoint: '/api/whitelists',
          httpMethod: 'POST'
        });
        throw new Error('该客户已存在相同类型的白名单申请');
      }

      const effectiveDt = effectiveDate ? moment(effectiveDate).toDate() : moment().toDate();
      const expiryDt = expiryDate ? moment(expiryDate).toDate() : whitelistRule.expiryDate;

      if (expiryDt && moment(expiryDt).isBefore(effectiveDt)) {
        throw new Error('到期日期不能早于生效日期');
      }

      const customerWhitelist = await CustomerWhitelist.create({
        customerId: customer.id,
        whitelistTypeId: whitelistType.id,
        whitelistRuleId: whitelistRule.id,
        applicationSourceId: applicationSource.id,
        status: 'pending',
        effectiveDate: effectiveDt,
        expiryDate: expiryDt,
        originalRequest: data,
        processingBasis: {
          whitelistType: whitelistType.toJSON(),
          whitelistRule: whitelistRule.toJSON(),
          applicationSource: applicationSource.toJSON()
        },
        createdBy: operator,
        remark
      }, { transaction: t });

      await t.commit();
      return customerWhitelist;

    } catch (error) {
      await t.rollback();
      
      if (!error.logged) {
        await this.logException({
          requestId,
          exceptionType: 'validation_error',
          severity: 'medium',
          originalInput: data,
          errorMessage: error.message,
          stackTrace: error.stack,
          operator,
          apiEndpoint: '/api/whitelists',
          httpMethod: 'POST'
        });
      }
      throw error;
    }
  }

  async getWhitelist(id) {
    return await CustomerWhitelist.findByPk(id, {
      include: [
        { model: Customer, as: 'customer' },
        { model: WhitelistType, as: 'whitelistType' },
        { model: WhitelistRule, as: 'whitelistRule' },
        { model: ApplicationSource, as: 'applicationSource' }
      ]
    });
  }

  async queryWhitelists(params = {}) {
    const { accountId, status, whitelistTypeCode, page = 1, pageSize = 20 } = params;
    const where = {};

    if (accountId) {
      const customer = await Customer.findOne({ where: { accountId } });
      if (customer) {
        where.customerId = customer.id;
      }
    }

    if (status) {
      where.status = status;
    }

    if (whitelistTypeCode) {
      const whitelistType = await WhitelistType.findOne({ where: { typeCode: whitelistTypeCode } });
      if (whitelistType) {
        where.whitelistTypeId = whitelistType.id;
      }
    }

    const { count, rows } = await CustomerWhitelist.findAndCountAll({
      where,
      include: [
        { model: Customer, as: 'customer' },
        { model: WhitelistType, as: 'whitelistType' },
        { model: WhitelistRule, as: 'whitelistRule' },
        { model: ApplicationSource, as: 'applicationSource' }
      ],
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });

    return { total: count, page, pageSize, data: rows };
  }

  async advanceStatus(id, targetStatus, operator = 'system') {
    const t = await sequelize.transaction();
    const requestId = uuidv4();

    try {
      const whitelist = await CustomerWhitelist.findByPk(id);
      if (!whitelist) {
        throw new Error('白名单不存在');
      }

      const validTransitions = {
        'pending': ['active', 'revoked'],
        'active': ['expired', 'revoked', 'manual_corrected'],
        'expired': [],
        'revoked': [],
        'manual_corrected': ['active', 'revoked']
      };

      if (!validTransitions[whitelist.status].includes(targetStatus)) {
        await this.logException({
          requestId,
          exceptionType: 'validation_error',
          severity: 'high',
          originalInput: { id, targetStatus, currentStatus: whitelist.status },
          processingBasis: { validTransitions: validTransitions[whitelist.status] },
          errorMessage: '无效的状态流转',
          customerId: whitelist.customerId,
          customerWhitelistId: whitelist.id,
          operator,
          apiEndpoint: `/api/whitelists/${id}/status`,
          httpMethod: 'PUT'
        });
        throw new Error(`无法从 ${whitelist.status} 状态流转到 ${targetStatus} 状态`);
      }

      if (targetStatus === 'active') {
        const now = moment();
        const effectiveDate = moment(whitelist.effectiveDate);
        
        if (now.isBefore(effectiveDate)) {
          throw new Error('尚未到生效日期，无法激活');
        }

        if (whitelist.expiryDate && now.isAfter(whitelist.expiryDate)) {
          await this.logException({
            requestId,
            exceptionType: 'expired_rule',
            severity: 'high',
            originalInput: { id, targetStatus },
            processingBasis: { expiryDate: whitelist.expiryDate, now: now.toDate() },
            errorMessage: '白名单已过期',
            customerId: whitelist.customerId,
            customerWhitelistId: whitelist.id,
            operator,
            apiEndpoint: `/api/whitelists/${id}/status`,
            httpMethod: 'PUT'
          });
          throw new Error('白名单已过期，无法激活');
        }
      }

      await whitelist.update({ status: targetStatus, approvedBy: operator }, { transaction: t });
      await t.commit();

      return await this.getWhitelist(id);

    } catch (error) {
      await t.rollback();
      if (!error.logged) {
        await this.logException({
          requestId,
          exceptionType: 'system_error',
          severity: 'high',
          originalInput: { id, targetStatus },
          errorMessage: error.message,
          stackTrace: error.stack,
          operator,
          apiEndpoint: `/api/whitelists/${id}/status`,
          httpMethod: 'PUT'
        });
      }
      throw error;
    }
  }

  async recordHit(whitelistId, hitScene, requestContext, hitResult = 'passed', operator = 'system') {
    const requestId = uuidv4();

    try {
      const whitelist = await CustomerWhitelist.findByPk(whitelistId, {
        include: [
          { model: WhitelistType, as: 'whitelistType' },
          { model: WhitelistRule, as: 'whitelistRule' },
          { model: ApplicationSource, as: 'applicationSource' },
          { model: Customer, as: 'customer' }
        ]
      });
      if (!whitelist) {
        throw new Error('白名单不存在');
      }

      if (whitelist.status !== 'active') {
        await this.logException({
          requestId,
          exceptionType: 'rule_mismatch',
          severity: 'medium',
          originalInput: { whitelistId, hitScene, requestContext },
          processingBasis: { whitelistStatus: whitelist.status },
          errorMessage: '白名单未激活',
          customerId: whitelist.customerId,
          customerWhitelistId: whitelist.id,
          operator,
          apiEndpoint: '/api/hits',
          httpMethod: 'POST'
        });
        throw new Error('白名单未激活，无法命中');
      }

      const matchDetails = await this.evaluateRuleMatch(whitelist, requestContext);

      const hitRecord = await HitRecord.create({
        customerWhitelistId: whitelist.id,
        customerId: whitelist.customerId,
        hitScene,
        requestContext,
        hitResult,
        matchDetails,
        hitRuleSnapshot: {
          whitelistType: whitelist.whitelistType,
          whitelistRule: whitelist.whitelistRule,
          applicationSource: whitelist.applicationSource
        },
        operator
      });

      return hitRecord;

    } catch (error) {
      if (!error.logged) {
        await this.logException({
          requestId,
          exceptionType: 'system_error',
          severity: 'medium',
          originalInput: { whitelistId, hitScene, requestContext },
          errorMessage: error.message,
          stackTrace: error.stack,
          operator,
          apiEndpoint: '/api/hits',
          httpMethod: 'POST'
        });
      }
      throw error;
    }
  }

  async evaluateRuleMatch(whitelist, requestContext) {
    const rule = whitelist.whitelistRule || await WhitelistRule.findByPk(whitelist.whitelistRuleId);
    const conditions = rule.matchConditions;
    const matchDetails = {
      ruleCode: rule.ruleCode,
      ruleName: rule.ruleName,
      matchedConditions: [],
      unmatchedConditions: []
    };

    if (conditions.customerLevels) {
      const customer = whitelist.customer || await Customer.findByPk(whitelist.customerId);
      if (conditions.customerLevels.includes(customer.customerLevel)) {
        matchDetails.matchedConditions.push({
          field: 'customerLevel',
          expected: conditions.customerLevels,
          actual: customer.customerLevel
        });
      } else {
        matchDetails.unmatchedConditions.push({
          field: 'customerLevel',
          expected: conditions.customerLevels,
          actual: customer.customerLevel
        });
      }
    }

    if (conditions.regions && requestContext.region) {
      if (conditions.regions.includes(requestContext.region)) {
        matchDetails.matchedConditions.push({
          field: 'region',
          expected: conditions.regions,
          actual: requestContext.region
        });
      } else {
        matchDetails.unmatchedConditions.push({
          field: 'region',
          expected: conditions.regions,
          actual: requestContext.region
        });
      }
    }

    if (conditions.channels && requestContext.channel) {
      if (conditions.channels.includes(requestContext.channel)) {
        matchDetails.matchedConditions.push({
          field: 'channel',
          expected: conditions.channels,
          actual: requestContext.channel
        });
      } else {
        matchDetails.unmatchedConditions.push({
          field: 'channel',
          expected: conditions.channels,
          actual: requestContext.channel
        });
      }
    }

    matchDetails.isMatch = matchDetails.unmatchedConditions.length === 0;
    return matchDetails;
  }

  async manualCorrect(id, correctionData, operator = 'system') {
    const t = await sequelize.transaction();
    const requestId = uuidv4();

    try {
      const whitelist = await CustomerWhitelist.findByPk(id);
      if (!whitelist) {
        throw new Error('白名单不存在');
      }

      const { effectiveDate, expiryDate, remark, reason } = correctionData;

      const manualCorrection = {
        correctedBy: operator,
        correctedAt: new Date(),
        reason,
        beforeValues: {
          effectiveDate: whitelist.effectiveDate,
          expiryDate: whitelist.expiryDate,
          remark: whitelist.remark
        },
        afterValues: {
          effectiveDate: effectiveDate ? moment(effectiveDate).toDate() : whitelist.effectiveDate,
          expiryDate: expiryDate ? moment(expiryDate).toDate() : whitelist.expiryDate,
          remark: remark || whitelist.remark
        }
      };

      await whitelist.update({
        effectiveDate: manualCorrection.afterValues.effectiveDate,
        expiryDate: manualCorrection.afterValues.expiryDate,
        remark: manualCorrection.afterValues.remark,
        status: 'manual_corrected',
        manualCorrection
      }, { transaction: t });

      await t.commit();
      return await this.getWhitelist(id);

    } catch (error) {
      await t.rollback();
      await this.logException({
        requestId,
        exceptionType: 'system_error',
        severity: 'high',
        originalInput: { id, correctionData },
        errorMessage: error.message,
        stackTrace: error.stack,
        operator,
        apiEndpoint: `/api/whitelists/${id}/correct`,
        httpMethod: 'POST'
      });
      throw error;
    }
  }

  async generateExplanationReport(customerId, options = {}) {
    const { whitelistId, hitRecordId, reportType = 'customer_summary', operator = 'system' } = options;
    const requestId = uuidv4();

    try {
      const reportCode = `RPT-${moment().format('YYYYMMDDHHmmss')}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

      const report = await ExplanationReport.create({
        reportCode,
        customerId,
        customerWhitelistId: whitelistId,
        hitRecordId,
        reportType,
        status: 'generating',
        generatedBy: operator
      });

      const content = await this.buildReportContent(customerId, whitelistId, hitRecordId, reportType);

      await report.update({
        status: 'completed',
        content: JSON.stringify(content),
        summary: content.summary,
        generatedAt: new Date()
      });

      return await ExplanationReport.findByPk(report.id, {
        include: [
          { model: Customer, as: 'customer' },
          { model: CustomerWhitelist, as: 'customerWhitelist' },
          { model: HitRecord, as: 'hitRecord' }
        ]
      });

    } catch (error) {
      await ExplanationReport.update(
        { status: 'failed', errorMessage: error.message },
        { where: { id: report.id } }
      );
      await this.logException({
        requestId,
        exceptionType: 'system_error',
        severity: 'high',
        originalInput: { customerId, options },
        errorMessage: error.message,
        stackTrace: error.stack,
        operator,
        apiEndpoint: '/api/reports',
        httpMethod: 'POST'
      });
      throw error;
    }
  }

  async buildReportContent(customerId, whitelistId, hitRecordId, reportType) {
    const customer = await Customer.findByPk(customerId);
    const content = {
      customer: customer.toJSON(),
      generatedAt: new Date().toISOString(),
      reportType
    };

    if (reportType === 'customer_summary') {
      const whitelists = await CustomerWhitelist.findAll({
        where: { customerId },
        include: [
          { model: WhitelistType, as: 'whitelistType' },
          { model: WhitelistRule, as: 'whitelistRule' },
          { model: ApplicationSource, as: 'applicationSource' },
          { model: HitRecord, as: 'hitRecords', limit: 10, order: [['hitTime', 'DESC']] }
        ],
        order: [['createdAt', 'DESC']]
      });

      content.whitelists = whitelists.map(w => w.toJSON());
      content.summary = `客户 ${customer.customerName} 共有 ${whitelists.length} 条白名单记录，其中 ${whitelists.filter(w => w.status === 'active').length} 条有效。`;

    } else if (reportType === 'single_hit' && hitRecordId) {
      const hitRecord = await HitRecord.findByPk(hitRecordId, {
        include: [
          { model: CustomerWhitelist, as: 'customerWhitelist', include: [
            { model: WhitelistType, as: 'whitelistType' },
            { model: WhitelistRule, as: 'whitelistRule' },
            { model: ApplicationSource, as: 'applicationSource' }
          ]}
        ]
      });

      content.hitRecord = hitRecord.toJSON();
      content.explanation = this.buildHitExplanation(hitRecord);
      content.summary = `命中时间: ${moment(hitRecord.hitTime).format('YYYY-MM-DD HH:mm:ss')}，场景: ${hitRecord.hitScene}，结果: ${hitRecord.hitResult}`;

    } else if (reportType === 'manual_correction' && whitelistId) {
      const whitelist = await CustomerWhitelist.findByPk(whitelistId);
      content.whitelist = whitelist.toJSON();
      content.manualCorrection = whitelist.manualCorrection;
      content.summary = whitelist.manualCorrection 
        ? `修正人: ${whitelist.manualCorrection.correctedBy}，修正原因: ${whitelist.manualCorrection.reason}`
        : '无人工修正记录';
    }

    return content;
  }

  buildHitExplanation(hitRecord) {
    const whitelist = hitRecord.customerWhitelist;
    return {
      conclusion: `客户通过 ${whitelist.applicationSource.sourceName} 申请的 ${whitelist.whitelistType.typeName} 白名单生效`,
      ruleDetails: {
        ruleName: whitelist.whitelistRule.ruleName,
        matchConditions: whitelist.whitelistRule.matchConditions,
        effectiveDate: whitelist.effectiveDate,
        expiryDate: whitelist.expiryDate
      },
      sourceDetails: {
        sourceName: whitelist.applicationSource.sourceName,
        sourceType: whitelist.applicationSource.sourceType,
        applicant: whitelist.applicationSource.applicant,
        applicantDept: whitelist.applicationSource.applicantDept
      },
      matchDetails: hitRecord.matchDetails
    };
  }

  async logException(data) {
    return await ExceptionLog.create(data);
  }

  async getExceptions(params = {}) {
    const { exceptionType, resolved, page = 1, pageSize = 20 } = params;
    const where = {};

    if (exceptionType) {
      where.exceptionType = exceptionType;
    }

    if (resolved !== undefined) {
      where.resolved = resolved;
    }

    const { count, rows } = await ExceptionLog.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });

    return { total: count, page, pageSize, data: rows };
  }

  async resolveException(id, resolutionNote, resolvedBy = 'system') {
    const exception = await ExceptionLog.findByPk(id);
    if (!exception) {
      throw new Error('异常记录不存在');
    }

    return await exception.update({
      resolved: true,
      resolvedBy,
      resolvedAt: new Date(),
      resolutionNote
    });
  }
}

module.exports = new WhitelistService();
