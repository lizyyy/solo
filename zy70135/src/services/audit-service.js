const db = require('../models');
const { AUDIT_ACTION, AUDIT_ENTITY_TYPE } = require('../core/constants');
const { Op } = require('sequelize');
const ReportRules = require('../core/report-rules');

class AuditService {
  static async record(action, entityType, entityId, entitySnapshot = {}, requestContext = {}, metadata = {}) {
    return await db.AuditLog.create({
      action,
      entityType,
      entityId,
      entitySnapshot,
      actorId: requestContext.userId,
      actorName: requestContext.displayName,
      actorRole: requestContext.role,
      businessLineId: requestContext.businessLineId,
      ipAddress: requestContext.ipAddress,
      userAgent: requestContext.userAgent,
      requestId: requestContext.requestId,
      metadata,
    });
  }

  static async recordBlacklistAction(action, blacklist, requestContext, metadata = {}) {
    return await this.record(
      action,
      AUDIT_ENTITY_TYPE.BLACKLIST,
      blacklist.id,
      blacklist.toJSON(),
      requestContext,
      {
        memberIdentifier: blacklist.memberIdentifier,
        status: blacklist.status,
        sourceType: blacklist.sourceType,
        ...metadata,
      }
    );
  }

  static async recordExemptionAction(action, exemption, requestContext, metadata = {}) {
    return await this.record(
      action,
      AUDIT_ENTITY_TYPE.EXEMPTION,
      exemption.id,
      exemption.toJSON(),
      requestContext,
      {
        code: exemption.code,
        memberIdentifier: exemption.memberIdentifier,
        status: exemption.status,
        type: exemption.type,
        ...metadata,
      }
    );
  }

  static async recordVersionAction(action, version, requestContext, metadata = {}) {
    return await this.record(
      action,
      AUDIT_ENTITY_TYPE.SHARE_VERSION,
      version.id,
      version.toJSON(),
      requestContext,
      {
        versionNumber: version.versionNumber,
        status: version.status,
        ...metadata,
      }
    );
  }

  static async recordExportAction(exportRecord, requestContext, metadata = {}) {
    return await this.record(
      AUDIT_ACTION.EXPORT,
      AUDIT_ENTITY_TYPE.EXPORT,
      exportRecord.id,
      exportRecord.toJSON(),
      requestContext,
      {
        code: exportRecord.code,
        type: exportRecord.type,
        format: exportRecord.format,
        ...metadata,
      }
    );
  }

  static async getEntityHistory(entityType, entityId, options = {}) {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const { count, rows } = await db.AuditLog.findAndCountAll({
      where: {
        entityType,
        entityId,
      },
      include: [
        {
          model: db.User,
          as: 'actor',
          attributes: ['id', 'username', 'displayName', 'role'],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    const auditTrail = ReportRules.generateAuditTrail(rows);

    return {
      items: auditTrail,
      total: count,
      page,
      limit,
    };
  }

  static async getAuditLogs(filters = {}, options = {}) {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const where = {};

    if (filters.action) {
      where.action = filters.action;
    }

    if (filters.entityType) {
      where.entityType = filters.entityType;
    }

    if (filters.entityId) {
      where.entityId = filters.entityId;
    }

    if (filters.actorId) {
      where.actorId = filters.actorId;
    }

    if (filters.businessLineId) {
      where.businessLineId = filters.businessLineId;
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

    const { count, rows } = await db.AuditLog.findAndCountAll({
      where,
      include: [
        {
          model: db.User,
          as: 'actor',
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

  static async getBlacklistAuditTrail(blacklistId, options = {}) {
    return await this.getEntityHistory(
      AUDIT_ENTITY_TYPE.BLACKLIST,
      blacklistId,
      options
    );
  }

  static async getExemptionAuditTrail(exemptionId, options = {}) {
    return await this.getEntityHistory(
      AUDIT_ENTITY_TYPE.EXEMPTION,
      exemptionId,
      options
    );
  }

  static async getStatistics(filters = {}) {
    const where = {};

    if (filters.businessLineId) {
      where.businessLineId = filters.businessLineId;
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

    const [
      totalCount,
      actionBreakdown,
      actorBreakdown,
      entityTypeBreakdown,
    ] = await Promise.all([
      db.AuditLog.count({ where }),
      this.getActionBreakdown(where),
      this.getActorBreakdown(where),
      this.getEntityTypeBreakdown(where),
    ]);

    return {
      totalCount,
      actionBreakdown,
      actorBreakdown,
      entityTypeBreakdown,
    };
  }

  static async getActionBreakdown(where = {}) {
    const actions = Object.values(AUDIT_ACTION);
    const breakdown = {};

    for (const action of actions) {
      breakdown[action] = await db.AuditLog.count({
        where: { ...where, action },
      });
    }

    return breakdown;
  }

  static async getActorBreakdown(where = {}) {
    const results = await db.AuditLog.findAll({
      where,
      attributes: [
        'actorId',
        'actorName',
        'actorRole',
        [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count'],
      ],
      group: ['actorId', 'actorName', 'actorRole'],
      having: db.sequelize.where(
        db.sequelize.fn('COUNT', db.sequelize.col('id')),
        '>',
        0
      ),
      order: [[db.sequelize.fn('COUNT', db.sequelize.col('id')), 'DESC']],
      limit: 20,
    });

    return results.map((r) => ({
      actorId: r.actorId,
      actorName: r.actorName,
      actorRole: r.actorRole,
      count: parseInt(r.get('count'), 10),
    }));
  }

  static async getEntityTypeBreakdown(where = {}) {
    const entityTypes = Object.values(AUDIT_ENTITY_TYPE);
    const breakdown = {};

    for (const entityType of entityTypes) {
      breakdown[entityType] = await db.AuditLog.count({
        where: { ...where, entityType },
      });
    }

    return breakdown;
  }
}

module.exports = AuditService;
