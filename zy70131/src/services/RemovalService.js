const { v4: uuidv4 } = require('uuid');
const { Authorization, AuthorizationStatus } = require('../models/Authorization');
const { RemovalRecord, RemovalReason, RemovalStatus } = require('../models/RemovalRecord');
const RuleEngine = require('./RuleEngine');

class RemovalService {
  constructor() {
    this.ruleEngine = new RuleEngine();
  }

  async createRemovalRecord(authorization, reason, reasonDetail = '', evaluationResult = null) {
    const removalCode = `RM-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    
    return await RemovalRecord.create({
      id: uuidv4(),
      removalCode,
      authorizationId: authorization.id,
      materialId: authorization.materialId,
      channelId: authorization.channelId,
      reason,
      reasonDetail,
      ruleEvaluationResult: evaluationResult ? JSON.stringify(evaluationResult, null, 2) : null,
      status: RemovalStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  async processExpiredRemovals() {
    const checkResult = await this.ruleEngine.checkExpiredAuthorizations();
    const results = [];

    for (const authorization of checkResult.expiredAuthorizations) {
      const removalRecord = await this.createRemovalRecord(
        authorization,
        RemovalReason.EXPIRED,
        `授权于 ${authorization.expirationDate} 到期，自动触发下架`,
        checkResult.evaluationSteps
      );

      await authorization.update({
        status: AuthorizationStatus.EXPIRED
      });

      await removalRecord.update({
        status: RemovalStatus.COMPLETED,
        executedAt: new Date()
      });

      results.push({
        authorizationCode: authorization.authorizationCode,
        removalCode: removalRecord.removalCode,
        status: 'COMPLETED'
      });
    }

    return {
      processed: results.length,
      results,
      evaluationSteps: checkResult.evaluationSteps
    };
  }

  async processRevocation(authorizationId, revokedBy, revocationReason) {
    const authorization = await Authorization.findByPk(authorizationId);
    if (!authorization) {
      throw new Error('授权记录不存在');
    }

    if (authorization.status === AuthorizationStatus.REVOKED) {
      throw new Error('授权已被撤销');
    }

    const removalRecord = await this.createRemovalRecord(
      authorization,
      RemovalReason.REVOKED,
      revocationReason || '手动撤销授权'
    );

    await authorization.update({
      status: AuthorizationStatus.REVOKED,
      revokedAt: new Date(),
      revokedBy,
      revocationReason
    });

    await removalRecord.update({
      status: RemovalStatus.COMPLETED,
      executedAt: new Date(),
      executedBy: revokedBy
    });

    return {
      authorizationCode: authorization.authorizationCode,
      removalCode: removalRecord.removalCode,
      status: 'COMPLETED',
      message: '授权已撤销并触发下架'
    };
  }

  async processRegionViolation(authorization, regionCode) {
    const evaluationResult = await this.ruleEngine.evaluateAuthorizationValidity(authorization, regionCode);

    if (evaluationResult.isValid) {
      return {
        success: false,
        message: '授权在该地区有效，无需下架',
        evaluationSteps: evaluationResult.evaluationSteps
      };
    }

    const removalRecord = await this.createRemovalRecord(
      authorization,
      RemovalReason.REGION_VIOLATION,
      `地区 ${regionCode} 违反地域规则：${evaluationResult.detail}`,
      evaluationResult
    );

    await removalRecord.update({
      status: RemovalStatus.COMPLETED,
      executedAt: new Date()
    });

    return {
      success: true,
      authorizationCode: authorization.authorizationCode,
      removalCode: removalRecord.removalCode,
      regionCode,
      evaluationSteps: evaluationResult.evaluationSteps
    };
  }

  async getRemovalRecords(filters = {}, limit = 100, offset = 0) {
    const where = {};
    
    if (filters.materialId) {
      where.materialId = filters.materialId;
    }
    if (filters.channelId) {
      where.channelId = filters.channelId;
    }
    if (filters.reason) {
      where.reason = filters.reason;
    }
    if (filters.status) {
      where.status = filters.status;
    }

    return await RemovalRecord.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });
  }

  async getRemovalDetail(removalId) {
    const removal = await RemovalRecord.findByPk(removalId);
    if (!removal) {
      return null;
    }

    const authorization = await Authorization.findByPk(removal.authorizationId);
    
    return {
      removal,
      authorization,
      ruleEvaluationResult: removal.ruleEvaluationResult 
        ? JSON.parse(removal.ruleEvaluationResult) 
        : null
    };
  }
}

module.exports = RemovalService;
