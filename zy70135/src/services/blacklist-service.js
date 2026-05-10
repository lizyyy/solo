const db = require('../models');
const { Op, Transaction } = require('sequelize');
const BlacklistRules = require('../core/blacklist-rules');
const {
  BLACKLIST_STATUS,
  BLACKLIST_SOURCE_TYPE,
  AUDIT_ACTION,
} = require('../core/constants');
const {
  NotFoundError,
  ConflictError,
  BusinessRuleError,
} = require('../utils/errors');
const AuditService = require('./audit-service');
const ExemptionRules = require('../core/exemption-rules');

class BlacklistService {
  static async create(data, requestContext) {
    BlacklistRules.validateReasonLength(data.reason);

    const existing = await db.Blacklist.findOne({
      where: {
        memberIdentifier: data.memberIdentifier,
        identifierType: data.identifierType || 'phone',
        businessLineId: requestContext.businessLineId,
      },
    });

    if (existing) {
      throw new ConflictError('该会员已在黑名单中');
    }

    const blacklist = await db.sequelize.transaction(async (t) => {
      const record = await db.Blacklist.create(
        {
          memberIdentifier: data.memberIdentifier,
          identifierType: data.identifierType || 'phone',
          memberName: data.memberName,
          status: BLACKLIST_STATUS.ACTIVE,
          reason: data.reason,
          sourceType: data.sourceType || BLACKLIST_SOURCE_TYPE.MANUAL,
          sourceReference: data.sourceReference,
          businessLineId: requestContext.businessLineId,
          isShared: data.isShared !== undefined ? data.isShared : true,
          metadata: data.metadata || {},
        },
        { transaction: t }
      );

      await record.saveHistory(requestContext.userId, '加入黑名单', t);

      await AuditService.recordBlacklistAction(
        AUDIT_ACTION.ADD,
        record,
        requestContext,
        {
          reason: data.reason,
          sourceType: data.sourceType || BLACKLIST_SOURCE_TYPE.MANUAL,
        }
      );

      return record;
    });

    return this.enrichBlacklist(blacklist);
  }

  static async findById(id, requestContext) {
    const blacklist = await db.Blacklist.findByPk(id, {
      include: [
        {
          model: db.BusinessLine,
          as: 'businessLine',
          attributes: ['id', 'code', 'name'],
        },
      ],
    });

    if (!blacklist) {
      throw new NotFoundError('黑名单记录不存在');
    }

    await this.checkAccess(blacklist, requestContext);

    return this.enrichBlacklist(blacklist);
  }

  static async findByMemberIdentifier(
    memberIdentifier,
    identifierType = 'phone',
    requestContext
  ) {
    const blacklist = await db.Blacklist.findOne({
      where: {
        memberIdentifier,
        identifierType,
      },
      include: [
        {
          model: db.BusinessLine,
          as: 'businessLine',
          attributes: ['id', 'code', 'name'],
        },
      ],
    });

    if (!blacklist) {
      return null;
    }

    await this.checkAccess(blacklist, requestContext);

    return this.enrichBlacklist(blacklist);
  }

  static async list(filters = {}, options = {}, requestContext) {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'DESC' } = options;
    const offset = (page - 1) * limit;

    const where = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.sourceType) {
      where.sourceType = filters.sourceType;
    }

    if (filters.isShared !== undefined) {
      where.isShared = filters.isShared;
    }

    if (filters.isManuallyCorrected !== undefined) {
      where.isManuallyCorrected = filters.isManuallyCorrected;
    }

    if (filters.memberIdentifier) {
      where.memberIdentifier = {
        [Op.like]: `%${filters.memberIdentifier}%`,
      };
    }

    if (filters.businessLineId) {
      where.businessLineId = filters.businessLineId;
    } else if (requestContext && requestContext.businessLineId && requestContext.role !== 'admin') {
      where[Op.or] = [
        { businessLineId: requestContext.businessLineId },
        { isShared: true },
      ];
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt[Op.gte] = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.createdAt[Op.lte] = new Date(filters.endDate);
      }
    }

    const { count, rows } = await db.Blacklist.findAndCountAll({
      where,
      include: [
        {
          model: db.BusinessLine,
          as: 'businessLine',
          attributes: ['id', 'code', 'name'],
        },
      ],
      order: [[sortBy, sortOrder]],
      limit,
      offset,
    });

    const enrichedItems = await Promise.all(
      rows.map((item) => this.enrichBlacklist(item))
    );

    return {
      items: enrichedItems,
      total: count,
      page,
      limit,
    };
  }

  static async update(id, data, requestContext) {
    const blacklist = await db.Blacklist.findByPk(id);

    if (!blacklist) {
      throw new NotFoundError('黑名单记录不存在');
    }

    await this.checkAccess(blacklist, requestContext);

    if (data.reason !== undefined) {
      BlacklistRules.validateReasonLength(data.reason);
    }

    const updated = await db.sequelize.transaction(async (t) => {
      await blacklist.saveHistory(
        requestContext.userId,
        '更新黑名单信息',
        t
      );

      await blacklist.update(
        {
          reason: data.reason,
          isShared: data.isShared,
          memberName: data.memberName,
          metadata: data.metadata ? { ...blacklist.metadata, ...data.metadata } : blacklist.metadata,
        },
        { transaction: t }
      );

      await AuditService.recordBlacklistAction(
        AUDIT_ACTION.UPDATE,
        blacklist,
        requestContext
      );

      return blacklist;
    });

    return this.enrichBlacklist(updated);
  }

  static async remove(id, removalReason, requestContext) {
    const blacklist = await db.Blacklist.findByPk(id);

    if (!blacklist) {
      throw new NotFoundError('黑名单记录不存在');
    }

    await this.checkAccess(blacklist, requestContext);

    const hasActiveExemption = await this.hasActiveExemption(blacklist.id);
    BlacklistRules.canBeRemoved(blacklist.status, hasActiveExemption);

    await db.sequelize.transaction(async (t) => {
      await blacklist.saveHistory(requestContext.userId, '从黑名单移除', t);

      await blacklist.update(
        {
          status: BLACKLIST_STATUS.INACTIVE,
          removedAt: new Date(),
          removedBy: requestContext.userId,
          removalReason,
        },
        { transaction: t }
      );

      await AuditService.recordBlacklistAction(
        AUDIT_ACTION.REMOVE,
        blacklist,
        requestContext,
        { removalReason }
      );
    });

    return this.enrichBlacklist(blacklist);
  }

  static async manualCorrect(id, data, requestContext) {
    const blacklist = await db.Blacklist.findByPk(id);

    if (!blacklist) {
      throw new NotFoundError('黑名单记录不存在');
    }

    await this.checkAccess(blacklist, requestContext);

    if (requestContext.role !== 'admin') {
      throw new BusinessRuleError('只有管理员可以人工修正状态');
    }

    BlacklistRules.canBeManuallyCorrected(blacklist.status, requestContext.role);

    if (!data.reason || data.reason.length < 10) {
      throw new BusinessRuleError('人工修正原因描述不充分，请补充详细信息');
    }

    const corrected = await db.sequelize.transaction(async (t) => {
      await blacklist.saveHistory(
        requestContext.userId,
        '人工修正状态',
        t
      );

      await blacklist.update(
        {
          status: data.newStatus || BLACKLIST_STATUS.MANUALLY_CORRECTED,
          isManuallyCorrected: true,
          manualCorrectionReason: data.reason,
          manualCorrectedAt: new Date(),
          manualCorrectedBy: requestContext.userId,
        },
        { transaction: t }
      );

      await AuditService.recordBlacklistAction(
        AUDIT_ACTION.MANUAL_CORRECT,
        blacklist,
        requestContext,
        {
          reason: data.reason,
          newStatus: data.newStatus || BLACKLIST_STATUS.MANUALLY_CORRECTED,
        }
      );

      return blacklist;
    });

    return this.enrichBlacklist(corrected);
  }

  static async checkMember(memberIdentifier, identifierType = 'phone', context = {}, requestContext) {
    const blacklist = await db.Blacklist.findOne({
      where: {
        memberIdentifier,
        identifierType,
      },
      include: [
        {
          model: db.BusinessLine,
          as: 'businessLine',
          attributes: ['id', 'code', 'name'],
        },
        {
          model: db.Exemption,
          as: 'exemptions',
          where: {
            status: 'approved',
          },
          required: false,
        },
      ],
    });

    let isHit = false;
    let hitReason = '';
    let effectiveStatus = null;
    let activeExemption = null;

    if (blacklist) {
      activeExemption = blacklist.exemptions?.find(
        (e) => ExemptionRules.isActive(e)
      );

      effectiveStatus = BlacklistRules.determineEffectiveStatus(
        blacklist.status,
        !!activeExemption,
        activeExemption?.status
      );

      isHit = BlacklistRules.isHit(
        blacklist.memberIdentifier,
        blacklist.status,
        !!activeExemption,
        blacklist.isManuallyCorrected
      );

      if (isHit) {
        hitReason = blacklist.reason || '命中黑名单检查';
      }
    }

    const latestVersion = await this.getLatestPublishedVersion();

    const hitRecord = await db.HitRecord.create({
      blacklistId: blacklist?.id,
      memberIdentifier,
      identifierType,
      blacklistStatus: blacklist?.status,
      effectiveStatus,
      isHit,
      hitReason,
      businessLineId: requestContext?.businessLineId,
      requesterId: requestContext?.userId,
      requesterName: requestContext?.displayName,
      requestContext: context?.scene,
      requestReference: context?.reference,
      ipAddress: requestContext?.ipAddress,
      userAgent: requestContext?.userAgent,
      requestId: requestContext?.requestId,
      sourceVersion: latestVersion?.versionNumber,
      exemptionId: activeExemption?.id,
      metadata: {
        businessLine: blacklist?.businessLine?.code,
        sourceType: blacklist?.sourceType,
      },
    });

    if (isHit && blacklist) {
      await blacklist.update({
        hitCount: blacklist.hitCount + 1,
        lastHitAt: new Date(),
      });

      if (activeExemption) {
        await activeExemption.update({
          hitCount: activeExemption.hitCount + 1,
        });
      }

      await AuditService.recordBlacklistAction(
        AUDIT_ACTION.HIT,
        blacklist,
        requestContext,
        {
          hitRecordId: hitRecord.id,
          context: context?.scene,
          reference: context?.reference,
        }
      );
    }

    return {
      isHit,
      hitReason,
      hitRecordId: hitRecord.id,
      checkedAt: hitRecord.createdAt,
      sourceVersion: latestVersion?.versionNumber,
      blacklist: blacklist
        ? {
            id: blacklist.id,
            memberIdentifier: blacklist.memberIdentifier,
            status: blacklist.status,
            effectiveStatus,
            isManuallyCorrected: blacklist.isManuallyCorrected,
            reason: blacklist.reason,
            sourceType: blacklist.sourceType,
            businessLine: blacklist.businessLine,
            hitCount: blacklist.hitCount,
          }
        : null,
      activeExemption: activeExemption
        ? {
            id: activeExemption.id,
            code: activeExemption.code,
            type: activeExemption.type,
            expiryDate: activeExemption.expiryDate,
          }
        : null,
    };
  }

  static async batchImport(items, requestContext) {
    const results = {
      success: [],
      failed: [],
      skipped: [],
      summary: {
        total: items.length,
        success: 0,
        failed: 0,
        skipped: 0,
      },
    };

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        const existing = await db.Blacklist.findOne({
          where: {
            memberIdentifier: item.memberIdentifier,
            identifierType: item.identifierType || 'phone',
            businessLineId: requestContext.businessLineId,
          },
        });

        if (existing) {
          results.skipped.push({
            index: i,
            memberIdentifier: item.memberIdentifier,
            reason: '已存在，跳过',
          });
          results.summary.skipped++;
          continue;
        }

        const created = await this.create(
          {
            ...item,
            sourceType: BLACKLIST_SOURCE_TYPE.BATCH_UPLOAD,
          },
          requestContext
        );

        results.success.push({
          index: i,
          memberIdentifier: item.memberIdentifier,
          id: created.id,
        });
        results.summary.success++;
      } catch (error) {
        results.failed.push({
          index: i,
          memberIdentifier: item.memberIdentifier,
          reason: error.message,
        });
        results.summary.failed++;
      }
    }

    return results;
  }

  static async getHistory(id, options = {}, requestContext) {
    const blacklist = await db.Blacklist.findByPk(id);

    if (!blacklist) {
      throw new NotFoundError('黑名单记录不存在');
    }

    await this.checkAccess(blacklist, requestContext);

    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const { count, rows } = await db.BlacklistHistory.findAndCountAll({
      where: { blacklistId: id },
      include: [
        {
          model: db.User,
          as: 'operator',
          attributes: ['id', 'username', 'displayName', 'role'],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return {
      items: rows,
      total: count,
      page,
      limit,
    };
  }

  static async getStatistics(filters = {}) {
    const where = {};

    if (filters.businessLineId) {
      where.businessLineId = filters.businessLineId;
    }

    const [
      totalCount,
      activeCount,
      inactiveCount,
      exemptedCount,
      manuallyCorrectedCount,
      sharedCount,
      sourceTypeBreakdown,
    ] = await Promise.all([
      db.Blacklist.count({ where }),
      db.Blacklist.count({ where: { ...where, status: BLACKLIST_STATUS.ACTIVE } }),
      db.Blacklist.count({ where: { ...where, status: BLACKLIST_STATUS.INACTIVE } }),
      db.Blacklist.count({ where: { ...where, status: BLACKLIST_STATUS.EXEMPTED } }),
      db.Blacklist.count({ where: { ...where, isManuallyCorrected: true } }),
      db.Blacklist.count({ where: { ...where, isShared: true } }),
      this.getSourceTypeBreakdown(where),
    ]);

    return {
      totalCount,
      activeCount,
      inactiveCount,
      exemptedCount,
      manuallyCorrectedCount,
      sharedCount,
      sourceTypeBreakdown,
    };
  }

  static async getSourceTypeBreakdown(where = {}) {
    const sourceTypes = Object.values(BLACKLIST_SOURCE_TYPE);
    const breakdown = {};

    for (const sourceType of sourceTypes) {
      breakdown[sourceType] = await db.Blacklist.count({
        where: { ...where, sourceType },
      });
    }

    return breakdown;
  }

  static async hasActiveExemption(blacklistId) {
    const count = await db.Exemption.count({
      where: {
        blacklistId,
        status: 'approved',
      },
    });

    if (count === 0) return false;

    const exemptions = await db.Exemption.findAll({
      where: {
        blacklistId,
        status: 'approved',
      },
    });

    return exemptions.some((e) => ExemptionRules.isActive(e));
  }

  static async checkAccess(blacklist, requestContext) {
    if (!requestContext) return true;
    if (requestContext.role === 'admin') return true;

    if (blacklist.isShared) return true;

    if (blacklist.businessLineId === requestContext.businessLineId) return true;

    throw new BusinessRuleError('您没有访问该黑名单记录的权限');
  }

  static async enrichBlacklist(blacklist) {
    const activeExemption = await db.Exemption.findOne({
      where: {
        blacklistId: blacklist.id,
        status: 'approved',
      },
    });

    const hasActiveExemption = activeExemption && ExemptionRules.isActive(activeExemption);

    const effectiveStatus = BlacklistRules.determineEffectiveStatus(
      blacklist.status,
      hasActiveExemption,
      activeExemption?.status
    );

    const data = blacklist.toJSON();
    data.effectiveStatus = effectiveStatus;
    data.hasActiveExemption = hasActiveExemption;
    data.activeExemption = hasActiveExemption ? {
      id: activeExemption.id,
      code: activeExemption.code,
      type: activeExemption.type,
      expiryDate: activeExemption.expiryDate,
    } : null;

    return data;
  }

  static async getLatestPublishedVersion() {
    return await db.ShareVersion.findOne({
      where: { status: 'published' },
      order: [['publishedAt', 'DESC']],
      attributes: ['id', 'versionNumber', 'publishedAt'],
    });
  }

  static async syncFromVersion(versionId, requestContext) {
    const version = await db.ShareVersion.findByPk(versionId, {
      include: [
        {
          model: db.ShareVersionItem,
          as: 'items',
        },
      ],
    });

    if (!version) {
      throw new NotFoundError('版本不存在');
    }

    if (version.status !== 'published') {
      throw new BusinessRuleError('只能从已发布的版本同步');
    }

    const results = {
      added: 0,
      updated: 0,
      removed: 0,
      unchanged: 0,
      skipped: 0,
    };

    for (const item of version.items) {
      const existing = await db.Blacklist.findOne({
        where: {
          memberIdentifier: item.memberIdentifier,
          identifierType: item.identifierType,
          businessLineId: item.businessLineId,
        },
      });

      if (item.changeType === 'added' || item.changeType === 'unchanged') {
        if (!existing) {
          await db.Blacklist.create({
            memberIdentifier: item.memberIdentifier,
            identifierType: item.identifierType,
            memberName: item.memberName,
            status: item.status,
            reason: item.reason,
            sourceType: item.sourceType,
            sourceReference: item.sourceReference,
            sourceVersion: version.versionNumber,
            businessLineId: item.businessLineId,
            isShared: true,
          });
          results.added++;
        } else if (existing.status !== item.status || existing.sourceVersion !== version.versionNumber) {
          await existing.update({
            status: item.status,
            reason: item.reason,
            sourceVersion: version.versionNumber,
          });
          results.updated++;
        } else {
          results.unchanged++;
        }
      } else if (item.changeType === 'removed' && existing) {
        await existing.update({
          status: BLACKLIST_STATUS.INACTIVE,
          sourceVersion: version.versionNumber,
          removedAt: new Date(),
          removalReason: '从共享版本同步移除',
        });
        results.removed++;
      }
    }

    await AuditService.record(
      AUDIT_ACTION.SYNC,
      'share_version',
      version.id,
      {},
      requestContext,
      {
        versionNumber: version.versionNumber,
        results,
      }
    );

    return {
      versionNumber: version.versionNumber,
      syncAt: new Date(),
      results,
    };
  }
}

module.exports = BlacklistService;
