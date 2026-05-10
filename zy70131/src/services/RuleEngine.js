const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const { Op } = require('sequelize');
const { Authorization, AuthorizationStatus } = require('../models/Authorization');
const { RegionRule, RegionRuleType } = require('../models/RegionRule');
const RuleEvaluationLog = require('../models/RuleEvaluationLog');

class RuleEngine {
  constructor() {
    this.stepResults = [];
  }

  logStep(stepName, condition, result, details = {}) {
    const step = {
      stepName,
      condition,
      result,
      timestamp: new Date().toISOString(),
      details
    };
    this.stepResults.push(step);
    return step;
  }

  async evaluateAuthorizationValidity(authorization, regionCode = null, checkTime = null) {
    this.stepResults = [];
    const evalTime = checkTime || new Date();

    const inputData = {
      authorizationId: authorization.id,
      authorizationCode: authorization.authorizationCode,
      materialId: authorization.materialId,
      channelId: authorization.channelId,
      status: authorization.status,
      effectiveDate: authorization.effectiveDate,
      expirationDate: authorization.expirationDate,
      regionCode,
      checkTime: evalTime
    };

    const step1 = this.logStep(
      '状态合法性检查',
      '授权状态是否为 ACTIVE',
      authorization.status === AuthorizationStatus.ACTIVE,
      {
        expected: AuthorizationStatus.ACTIVE,
        actual: authorization.status
      }
    );

    if (!step1.result) {
      const finalResult = {
        isValid: false,
        reason: 'AUTHORIZATION_NOT_ACTIVE',
        detail: `授权状态为 ${authorization.status}，需要 ACTIVE`
      };
      await this.saveEvaluationLog('validity_check', authorization, inputData, finalResult, null);
      return { ...finalResult, evaluationSteps: this.stepResults };
    }

    const effectiveDate = new Date(authorization.effectiveDate);
    const step2 = this.logStep(
      '生效日期检查',
      '当前时间是否晚于生效日期',
      evalTime >= effectiveDate,
      {
        effectiveDate: effectiveDate.toISOString(),
        checkTime: evalTime.toISOString(),
        daysDiff: dayjs(evalTime).diff(dayjs(effectiveDate), 'day')
      }
    );

    if (!step2.result) {
      const finalResult = {
        isValid: false,
        reason: 'NOT_YET_EFFECTIVE',
        detail: '授权尚未生效'
      };
      await this.saveEvaluationLog('validity_check', authorization, inputData, finalResult, null);
      return { ...finalResult, evaluationSteps: this.stepResults };
    }

    const expirationDate = new Date(authorization.expirationDate);
    const step3 = this.logStep(
      '到期日期检查',
      '当前时间是否早于到期日期',
      evalTime < expirationDate,
      {
        expirationDate: expirationDate.toISOString(),
        checkTime: evalTime.toISOString(),
        daysRemaining: dayjs(expirationDate).diff(dayjs(evalTime), 'day')
      }
    );

    if (!step3.result) {
      const finalResult = {
        isValid: false,
        reason: 'AUTHORIZATION_EXPIRED',
        detail: '授权已到期'
      };
      await this.saveEvaluationLog('validity_check', authorization, inputData, finalResult, 'TRIGGER_EXPIRATION_REMOVAL');
      return { ...finalResult, triggeredAction: 'TRIGGER_EXPIRATION_REMOVAL', evaluationSteps: this.stepResults };
    }

    if (regionCode) {
      const regionRules = await RegionRule.findAll({
        where: { authorizationId: authorization.id },
        order: [['priority', 'DESC']]
      });

      const regionCheckResult = await this.evaluateRegionRule(authorization, regionCode, regionRules);

      if (!regionCheckResult.isValid) {
        const finalResult = {
          isValid: false,
          reason: 'REGION_VIOLATION',
          detail: regionCheckResult.detail
        };
        await this.saveEvaluationLog('validity_check', authorization, inputData, finalResult, 'TRIGGER_REGION_REMOVAL');
        return { ...finalResult, evaluationSteps: this.stepResults };
      }
    }

    const finalResult = {
      isValid: true,
      reason: 'ALL_CHECKS_PASSED',
      detail: '授权有效，所有检查通过'
    };

    await this.saveEvaluationLog('validity_check', authorization, inputData, finalResult, null);
    return { ...finalResult, evaluationSteps: this.stepResults };
  }

  async evaluateRegionRule(authorization, regionCode, regionRules) {
    if (regionRules.length === 0) {
      this.logStep(
        '地域规则检查',
        '未配置地域规则，默认可访问',
        true,
        { ruleCount: 0, defaultAction: 'ALLOW' }
      );
      return { isValid: true, detail: '未配置地域规则' };
    }

    const includeRules = regionRules.filter(r => r.ruleType === RegionRuleType.INCLUDE);
    const excludeRules = regionRules.filter(r => r.ruleType === RegionRuleType.EXCLUDE);

    this.logStep(
      '地域规则统计',
      '统计地域规则数量',
      true,
      {
        totalRules: regionRules.length,
        includeRules: includeRules.length,
        excludeRules: excludeRules.length,
        targetRegion: regionCode
      }
    );

    const excludeMatch = excludeRules.find(r => r.regionCode === regionCode);
    if (excludeMatch) {
      this.logStep(
        '排除规则检查',
        `目标地区 ${regionCode} 是否在排除列表中`,
        true,
        {
          matched: true,
          regionName: excludeMatch.regionName,
          priority: excludeMatch.priority
        }
      );
      return { isValid: false, detail: `地区 ${regionCode}(${excludeMatch.regionName}) 在排除列表中` };
    } else {
      this.logStep(
        '排除规则检查',
        `目标地区 ${regionCode} 是否在排除列表中`,
        false,
        { matched: false }
      );
    }

    if (includeRules.length > 0) {
      const includeMatch = includeRules.find(r => r.regionCode === regionCode);
      if (includeMatch) {
        this.logStep(
          '包含规则检查',
          `目标地区 ${regionCode} 是否在包含列表中`,
          true,
          {
            matched: true,
            regionName: includeMatch.regionName,
            priority: includeMatch.priority
          }
        );
        return { isValid: true, detail: `地区 ${regionCode} 在包含列表中` };
      } else {
        this.logStep(
          '包含规则检查',
          `目标地区 ${regionCode} 是否在包含列表中`,
          false,
          {
            matched: false,
            allowedRegions: includeRules.map(r => `${r.regionCode}(${r.regionName})`).join(', ')
          }
        );
        return { isValid: false, detail: `地区 ${regionCode} 不在授权包含列表中` };
      }
    }

    this.logStep(
      '地域规则结论',
      '无排除规则且无包含规则，默认允许',
      true,
      { action: 'ALLOW_BY_DEFAULT' }
    );
    return { isValid: true, detail: '无地域限制' };
  }

  async checkExpiringAuthorizations(daysThreshold = 7) {
    this.stepResults = [];
    const now = new Date();
    const thresholdDate = dayjs(now).add(daysThreshold, 'day').toDate();

    const expiringAuths = await Authorization.findAll({
      where: {
        status: AuthorizationStatus.ACTIVE,
        expirationDate: {
          [Op.between]: [now, thresholdDate]
        }
      }
    });

    this.logStep(
      '即将到期授权查询',
      `查询 ${daysThreshold} 天内到期的活跃授权`,
      true,
      {
        checkTime: now,
        thresholdDate,
        count: expiringAuths.length
      }
    );

    const results = [];
    for (const auth of expiringAuths) {
      const daysRemaining = dayjs(auth.expirationDate).diff(dayjs(now), 'day');
      this.logStep(
        `授权 ${auth.authorizationCode}`,
        '计算到期剩余天数',
        true,
        {
          materialId: auth.materialId,
          channel: auth.channelName,
          expirationDate: auth.expirationDate,
          daysRemaining
        }
      );
      results.push({
        authorization: auth,
        daysRemaining,
        shouldNotify: daysRemaining >= 0
      });
    }

    return {
      count: expiringAuths.length,
      expiringAuthorizations: results,
      evaluationSteps: this.stepResults
    };
  }

  async checkExpiredAuthorizations() {
    this.stepResults = [];
    const now = new Date();

    const expiredAuths = await Authorization.findAll({
      where: {
        status: AuthorizationStatus.ACTIVE,
        expirationDate: {
          [Op.lt]: now
        }
      }
    });

    this.logStep(
      '已到期授权查询',
      '查询状态为 ACTIVE 但已超过到期日期的授权',
      true,
      {
        checkTime: now,
        count: expiredAuths.length
      }
    );

    return {
      count: expiredAuths.length,
      expiredAuthorizations: expiredAuths,
      evaluationSteps: this.stepResults
    };
  }

  async saveEvaluationLog(evaluationType, authorization, inputData, finalResult, triggeredAction) {
    await RuleEvaluationLog.create({
      id: uuidv4(),
      authorizationId: authorization.id,
      materialId: authorization.materialId,
      evaluationType,
      inputData: JSON.stringify(inputData, null, 2),
      evaluationSteps: JSON.stringify(this.stepResults, null, 2),
      finalResult: JSON.stringify(finalResult, null, 2),
      triggeredAction,
      evaluatedAt: new Date()
    });
  }

  async getEvaluationHistory(authorizationId, limit = 20) {
    return await RuleEvaluationLog.findAll({
      where: { authorizationId },
      order: [['evaluatedAt', 'DESC']],
      limit
    });
  }
}

module.exports = RuleEngine;
