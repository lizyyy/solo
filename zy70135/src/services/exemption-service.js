const db = require('../models');
const { Op } = require('sequelize');
const ExemptionRules = require('../core/exemption-rules');
const BlacklistRules = require('../core/blacklist-rules');
const {
  EXEMPTION_STATUS,
  EXEMPTION_TYPE,
  AUDIT_ACTION,
} = require('../core/constants');
const {
  NotFoundError,
  ConflictError,
  BusinessRuleError,
} = require('../utils/errors');
const AuditService = require('./audit-service');
const DateUtils = require('../utils/date-utils');

class ExemptionService {
  static async create(data, requestContext) {
    ExemptionRules.validateExemptionReason(data.reason);

    if (data.type !== EXEMPTION_TYPE.PERMANENT && !data.durationDays) {
      data.durationDays = 30;
    }

    if (data.type !== EXEMPTION_TYPE.PERMANENT) {
      ExemptionRules.validateDuration(data.durationDays, data.type);
    }

    const blacklist = await db.Blacklist.findByPk(data.blacklistId);
    if (!blacklist) {
      throw new NotFoundError('黑名单记录不存在');
    }

    const hasActiveExemption = await this.hasActiveExemptionForBlacklist(
      blacklist.id
    );

    ExemptionRules.canRequestExemption(
      blacklist.status,
      hasActiveExemption,
      blacklist.isManuallyCorrected
    );

    const startDate = data.startDate ? new Date(data.startDate) : new Date();
    const expiryDate =
      data.type === EXEMPTION_TYPE.PERMANENT
        ? null
        : ExemptionRules.calculateExpiryDate(startDate, data.durationDays);

    const exemption = await db.sequelize.transaction(async (t) => {
      const record = await db.Exemption.create(
        {
          blacklistId: blacklist.id,
          memberIdentifier: blacklist.memberIdentifier,
          identifierType: blacklist.identifierType,
          type: data.type,
          status: EXEMPTION_STATUS.PENDING,
          reason: data.reason,
          durationDays: data.durationDays,
          startDate,
          expiryDate,
          businessLineId: blacklist.businessLineId || requestContext.businessLineId,
          requesterId: requestContext.userId,
          requesterComment: data.comment,
        },
        { transaction: t }
      );

      await AuditService.recordExemptionAction(
        AUDIT_ACTION.EXEMPTION_REQUEST,
        record,
        requestContext,
        {
          reason: data.reason,
          type: data.type,
          durationDays: data.durationDays,
        }
      );

      return record;
    });

    return this.enrichExemption(exemption);
  }

  static async findById(id, requestContext) {
    const exemption = await db.Exemption.findByPk(id, {
      include: [
        {
          model: db.Blacklist,
          as: 'blacklist',
          attributes: ['id', 'memberIdentifier', 'status', 'reason', 'sourceType'],
        },
        {
          model: db.User,
          as: 'requester',
          attributes: ['id', 'username', 'displayName', 'role'],
        },
        {
          model: db.User,
          as: 'approver',
          attributes: ['id', 'username', 'displayName', 'role'],
        },
      ],
    });

    if (!exemption) {
      throw new NotFoundError('豁免记录不存在');
    }

    await this.checkAccess(exemption, requestContext);

    return this.enrichExemption(exemption);
  }

  static async list(filters = {}, options = {}, requestContext) {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'DESC' } = options;
    const offset = (page - 1) * limit;

    const where = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.memberIdentifier) {
      where.memberIdentifier = {
        [Op.like]: `%${filters.memberIdentifier}%`,
      };
    }

    if (filters.blacklistId) {
      where.blacklistId = filters.blacklistId;
    }

    if (filters.businessLineId) {
      where.businessLineId = filters.businessLineId;
    }

    if (filters.requesterId) {
      where.requesterId = filters.requesterId;
    }

    if (filters.approverId) {
      where.approverId = filters.approverId;
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

    const { count, rows } = await db.Exemption.findAndCountAll({
      where,
      include: [
        {
          model: db.Blacklist,
          as: 'blacklist',
          attributes: ['id', 'memberIdentifier', 'status'],
        },
        {
          model: db.User,
          as: 'requester',
          attributes: ['id', 'username', 'displayName', 'role'],
        },
        {
          model: db.User,
          as: 'approver',
          attributes: ['id', 'username', 'displayName', 'role'],
        },
      ],
      order: [[sortBy, sortOrder]],
      limit,
      offset,
    });

    const enrichedItems = await Promise.all(
      rows.map((item) => this.enrichExemption(item))
    );

    return {
      items: enrichedItems,
      total: count,
      page,
      limit,
    };
  }

  static async approve(id, data, requestContext) {
    const exemption = await db.Exemption.findByPk(id, {
      include: [
        {
          model: db.User,
          as: 'requester',
          attributes: ['id', 'role'],
        },
      ],
    });

    if (!exemption) {
      throw new NotFoundError('豁免记录不存在');
    }

    ExemptionRules.canApprove(
      exemption.status,
      exemption.requester?.role,
      requestContext.role
    );

    const blacklist = await db.Blacklist.findByPk(exemption.blacklistId);
    if (!blacklist) {
      throw new NotFoundError('关联的黑名单记录不存在');
    }

    const approved = await db.sequelize.transaction(async (t) => {
      await exemption.update(
        {
          status: EXEMPTION_STATUS.APPROVED,
          approverId: requestContext.userId,
          approverComment: data.comment,
          approvedAt: new Date(),
        },
        { transaction: t }
      );

      await AuditService.recordExemptionAction(
        AUDIT_ACTION.EXEMPTION_APPROVE,
        exemption,
        requestContext,
        {
          comment: data.comment,
          approver: requestContext.displayName,
        }
      );

      return exemption;
    });

    return this.enrichExemption(approved);
  }

  static async reject(id, data, requestContext) {
    const exemption = await db.Exemption.findByPk(id);

    if (!exemption) {
      throw new NotFoundError('豁免记录不存在');
    }

    ExemptionRules.canReject(exemption.status);

    if (!data.reason || data.reason.length < 10) {
      throw new BusinessRuleError('拒绝原因描述不充分，请补充详细信息');
    }

    const rejected = await db.sequelize.transaction(async (t) => {
      await exemption.update(
        {
          status: EXEMPTION_STATUS.REJECTED,
          approverId: requestContext.userId,
          approverComment: data.reason,
          rejectedAt: new Date(),
        },
        { transaction: t }
      );

      await AuditService.recordExemptionAction(
        AUDIT_ACTION.EXEMPTION_REJECT,
        exemption,
        requestContext,
        {
          reason: data.reason,
          approver: requestContext.displayName,
        }
      );

      return exemption;
    });

    return this.enrichExemption(rejected);
  }

  static async revoke(id, data, requestContext) {
    const exemption = await db.Exemption.findByPk(id);

    if (!exemption) {
      throw new NotFoundError('豁免记录不存在');
    }

    const isAdmin = requestContext.role === 'admin';
    ExemptionRules.canRevoke(exemption.status, isAdmin);

    if (!data.reason || data.reason.length < 10) {
      throw new BusinessRuleError('撤销原因描述不充分，请补充详细信息');
    }

    const revoked = await db.sequelize.transaction(async (t) => {
      await exemption.update(
        {
          status: EXEMPTION_STATUS.REVOKED,
          revokedBy: requestContext.userId,
          revocationReason: data.reason,
          revokedAt: new Date(),
        },
        { transaction: t }
      );

      await AuditService.recordExemptionAction(
        AUDIT_ACTION.EXEMPTION_REVOKE,
        exemption,
        requestContext,
        {
          reason: data.reason,
          revoker: requestContext.displayName,
        }
      );

      return exemption;
    });

    return this.enrichExemption(revoked);
  }

  static async processExpiredExemptions() {
    const now = new Date();
    const expiredExemptions = await db.Exemption.findAll({
      where: {
        status: EXEMPTION_STATUS.APPROVED,
        type: {
          [Op.ne]: EXEMPTION_TYPE.PERMANENT,
        },
        expiryDate: {
          [Op.lte]: now,
        },
      },
    });

    const results = {
      processed: 0,
      failed: 0,
      exemptionIds: [],
    };

    for (const exemption of expiredExemptions) {
      try {
        await db.sequelize.transaction(async (t) => {
          await exemption.update(
            {
              status: EXEMPTION_STATUS.EXPIRED,
              expiredAt: now,
            },
            { transaction: t }
          );

          await db.AuditLog.create({
            action: AUDIT_ACTION.EXEMPTION_EXPIRE,
            entityType: 'exemption',
            entityId: exemption.id,
            metadata: {
              code: exemption.code,
              memberIdentifier: exemption.memberIdentifier,
              expiredAt: now.toISOString(),
            },
          });
        });

        results.processed++;
        results.exemptionIds.push(exemption.id);
      } catch (error) {
        results.failed++;
      }
    }

    return results;
  }

  static async getPendingForApproval(approverRole, requestContext) {
    const where = {
      status: EXEMPTION_STATUS.PENDING,
    };

    if (requestContext.businessLineId) {
      where.businessLineId = requestContext.businessLineId;
    }

    const exemptions = await db.Exemption.findAll({
      where,
      include: [
        {
          model: db.Blacklist,
          as: 'blacklist',
          attributes: ['id', 'memberIdentifier', 'status', 'reason'],
        },
        {
          model: db.User,
          as: 'requester',
          attributes: ['id', 'username', 'displayName', 'role'],
        },
      ],
      order: [['createdAt', 'ASC']],
    });

    const enrichedItems = await Promise.all(
      exemptions.map((item) => this.enrichExemption(item))
    );

    return {
      items: enrichedItems,
      total: exemptions.length,
    };
  }

  static async hasActiveExemptionForBlacklist(blacklistId) {
    const count = await db.Exemption.count({
      where: {
        blacklistId,
        status: EXEMPTION_STATUS.APPROVED,
      },
    });

    if (count === 0) return false;

    const exemptions = await db.Exemption.findAll({
      where: {
        blacklistId,
        status: EXEMPTION_STATUS.APPROVED,
      },
    });

    return exemptions.some((e) => ExemptionRules.isActive(e));
  }

  static async checkAccess(exemption, requestContext) {
    if (!requestContext) return true;
    if (requestContext.role === 'admin') return true;

    if (exemption.requesterId === requestContext.userId) return true;

    if (exemption.businessLineId === requestContext.businessLineId) return true;

    throw new BusinessRuleError('您没有访问该豁免记录的权限');
  }

  static async enrichExemption(exemption) {
    const data = exemption.toJSON();

    data.isActive = ExemptionRules.isActive(exemption);

    if (data.isActive && exemption.type !== EXEMPTION_TYPE.PERMANENT) {
      data.needsReview = ExemptionRules.needsReview(exemption);
      data.daysRemaining = ExemptionRules.isExpired(exemption.expiryDate)
        ? 0
        : DateUtils.diffInDays(exemption.expiryDate, new Date());
    } else {
      data.needsReview = false;
      data.daysRemaining = 0;
    }

    return data;
  }

  static async getStatistics(filters = {}) {
    const where = {};

    if (filters.businessLineId) {
      where.businessLineId = filters.businessLineId;
    }

    const [
      totalCount,
      pendingCount,
      approvedCount,
      rejectedCount,
      expiredCount,
      revokedCount,
      typeBreakdown,
    ] = await Promise.all([
      db.Exemption.count({ where }),
      db.Exemption.count({ where: { ...where, status: EXEMPTION_STATUS.PENDING } }),
      db.Exemption.count({ where: { ...where, status: EXEMPTION_STATUS.APPROVED } }),
      db.Exemption.count({ where: { ...where, status: EXEMPTION_STATUS.REJECTED } }),
      db.Exemption.count({ where: { ...where, status: EXEMPTION_STATUS.EXPIRED } }),
      db.Exemption.count({ where: { ...where, status: EXEMPTION_STATUS.REVOKED } }),
      this.getTypeBreakdown(where),
    ]);

    const activeApproved = await db.Exemption.findAll({
      where: {
        ...where,
        status: EXEMPTION_STATUS.APPROVED,
      },
    });

    const activeCount = activeApproved.filter((e) => ExemptionRules.isActive(e)).length;

    return {
      totalCount,
      pendingCount,
      approvedCount,
      activeCount,
      rejectedCount,
      expiredCount,
      revokedCount,
      typeBreakdown,
    };
  }

  static async getTypeBreakdown(where = {}) {
    const types = Object.values(EXEMPTION_TYPE);
    const breakdown = {};

    for (const type of types) {
      breakdown[type] = await db.Exemption.count({
        where: { ...where, type },
      });
    }

    return breakdown;
  }
}

module.exports = ExemptionService;
