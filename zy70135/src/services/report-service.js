const db = require('../models');
const { Op } = require('sequelize');
const ReportRules = require('../core/report-rules');
const DateUtils = require('../utils/date-utils');
const {
  BLACKLIST_STATUS,
  BLACKLIST_SOURCE_TYPE,
  EXEMPTION_STATUS,
  EXEMPTION_TYPE,
  SHARE_VERSION_STATUS,
} = require('../core/constants');
const { BadRequestError } = require('../utils/errors');

class ReportService {
  static async getOverview(filters = {}, requestContext) {
    const validation = ReportRules.validateReportParameters(filters);
    if (!validation.isValid) {
      throw new BadRequestError(validation.errors.join('; '));
    }

    const where = {};
    if (filters.businessLineId) {
      where.businessLineId = filters.businessLineId;
    }

    const [
      blacklistStats,
      exemptionStats,
      versionStats,
      hitStats,
    ] = await Promise.all([
      this.getBlacklistOverview(where),
      this.getExemptionOverview(where),
      this.getVersionOverview(where),
      this.getHitOverview(where, filters),
    ]);

    return {
      period: {
        startDate: filters.startDate,
        endDate: filters.endDate,
      },
      blacklist: blacklistStats,
      exemption: exemptionStats,
      version: versionStats,
      hit: hitStats,
      generatedAt: new Date(),
    };
  }

  static async getBlacklistOverview(where = {}) {
    const [
      totalCount,
      activeCount,
      inactiveCount,
      manuallyCorrectedCount,
      sharedCount,
      sourceBreakdown,
    ] = await Promise.all([
      db.Blacklist.count({ where }),
      db.Blacklist.count({ where: { ...where, status: BLACKLIST_STATUS.ACTIVE } }),
      db.Blacklist.count({ where: { ...where, status: BLACKLIST_STATUS.INACTIVE } }),
      db.Blacklist.count({ where: { ...where, isManuallyCorrected: true } }),
      db.Blacklist.count({ where: { ...where, isShared: true } }),
      this.getSourceTypeBreakdown(where),
    ]);

    return {
      totalCount,
      activeCount,
      inactiveCount,
      manuallyCorrectedCount,
      sharedCount,
      privateCount: totalCount - sharedCount,
      sourceBreakdown,
    };
  }

  static async getExemptionOverview(where = {}) {
    const [
      totalCount,
      pendingCount,
      approvedCount,
      activeCount,
      rejectedCount,
      expiredCount,
      revokedCount,
      typeBreakdown,
    ] = await Promise.all([
      db.Exemption.count({ where }),
      db.Exemption.count({ where: { ...where, status: EXEMPTION_STATUS.PENDING } }),
      db.Exemption.count({ where: { ...where, status: EXEMPTION_STATUS.APPROVED } }),
      this.getActiveExemptionCount(where),
      db.Exemption.count({ where: { ...where, status: EXEMPTION_STATUS.REJECTED } }),
      db.Exemption.count({ where: { ...where, status: EXEMPTION_STATUS.EXPIRED } }),
      db.Exemption.count({ where: { ...where, status: EXEMPTION_STATUS.REVOKED } }),
      this.getExemptionTypeBreakdown(where),
    ]);

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

  static async getVersionOverview(where = {}) {
    const [totalCount, draftCount, publishedCount, archivedCount] =
      await Promise.all([
        db.ShareVersion.count({ where }),
        db.ShareVersion.count({ where: { ...where, status: SHARE_VERSION_STATUS.DRAFT } }),
        db.ShareVersion.count({ where: { ...where, status: SHARE_VERSION_STATUS.PUBLISHED } }),
        db.ShareVersion.count({ where: { ...where, status: SHARE_VERSION_STATUS.ARCHIVED } }),
      ]);

    const latestPublished = await db.ShareVersion.findOne({
      where: { ...where, status: SHARE_VERSION_STATUS.PUBLISHED },
      order: [['publishedAt', 'DESC']],
      attributes: ['id', 'versionNumber', 'publishedAt', 'itemCount'],
    });

    return {
      totalCount,
      draftCount,
      publishedCount,
      archivedCount,
      latestPublished: latestPublished
        ? {
            id: latestPublished.id,
            versionNumber: latestPublished.versionNumber,
            publishedAt: latestPublished.publishedAt,
            itemCount: latestPublished.itemCount,
          }
        : null,
    };
  }

  static async getHitOverview(where = {}, filters = {}) {
    const hitWhere = { ...where };

    if (filters.startDate || filters.endDate) {
      hitWhere.createdAt = {};
      if (filters.startDate) {
        hitWhere.createdAt[Op.gte] = new Date(filters.startDate);
      }
      if (filters.endDate) {
        hitWhere.createdAt[Op.lte] = new Date(filters.endDate);
      }
    }

    const [
      totalChecks,
      hitCount,
      noHitCount,
      topHitRecords,
    ] = await Promise.all([
      db.HitRecord.count(hitWhere),
      db.HitRecord.count({ ...hitWhere, isHit: true }),
      db.HitRecord.count({ ...hitWhere, isHit: false }),
      this.getTopHitRecords(hitWhere),
    ]);

    return {
      totalChecks,
      hitCount,
      noHitCount,
      hitRate: totalChecks > 0 ? (hitCount / totalChecks).toFixed(4) : 0,
      topHitRecords,
    };
  }

  static async getTopHitRecords(where = {}, limit = 10) {
    const results = await db.HitRecord.findAll({
      where: { ...where, isHit: true },
      attributes: [
        'memberIdentifier',
        'blacklistStatus',
        [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'hitCount'],
        [db.sequelize.fn('MAX', db.sequelize.col('created_at')), 'lastHitAt'],
      ],
      group: ['memberIdentifier', 'blacklist_status'],
      order: [[db.sequelize.fn('COUNT', db.sequelize.col('id')), 'DESC']],
      limit,
    });

    return results.map((r) => ({
      memberIdentifier: r.memberIdentifier,
      blacklistStatus: r.blacklistStatus,
      hitCount: parseInt(r.get('hitCount'), 10),
      lastHitAt: r.get('lastHitAt'),
    }));
  }

  static async getTrendReport(filters = {}, options = {}) {
    const validation = ReportRules.validateReportParameters(filters);
    if (!validation.isValid) {
      throw new BadRequestError(validation.errors.join('; '));
    }

    const { groupBy = 'day' } = options;
    const startDate = filters.startDate ? new Date(filters.startDate) : DateUtils.addDays(new Date(), -30);
    const endDate = filters.endDate ? new Date(filters.endDate) : new Date();

    const where = {};
    if (filters.businessLineId) {
      where.businessLineId = filters.businessLineId;
    }

    const [blacklistTrend, hitTrend, exemptionTrend] = await Promise.all([
      this.getBlacklistTrend(where, startDate, endDate, groupBy),
      this.getHitTrend(where, startDate, endDate, groupBy),
      this.getExemptionTrend(where, startDate, endDate, groupBy),
    ]);

    return {
      period: {
        startDate,
        endDate,
        groupBy,
      },
      blacklistTrend,
      hitTrend,
      exemptionTrend,
    };
  }

  static async getBlacklistTrend(where, startDate, endDate, groupBy) {
    const records = await db.Blacklist.findAll({
      where: {
        ...where,
        createdAt: {
          [Op.between]: [startDate, endDate],
        },
      },
      attributes: ['id', 'memberIdentifier', 'status', 'createdAt'],
    });

    return ReportRules.groupByTimeRange(records, startDate, endDate, groupBy);
  }

  static async getHitTrend(where, startDate, endDate, groupBy) {
    const records = await db.HitRecord.findAll({
      where: {
        ...where,
        createdAt: {
          [Op.between]: [startDate, endDate],
        },
      },
      attributes: ['id', 'isHit', 'createdAt'],
    });

    const groups = ReportRules.groupByTimeRange(records, startDate, endDate, groupBy);

    for (const group of groups) {
      const periodRecords = records.filter((r) => {
        const dateKey = DateUtils.format(
          r.createdAt,
          groupBy === 'day' ? 'YYYY-MM-DD' : 'YYYY-MM'
        );
        return dateKey === group.period;
      });

      group.hits = periodRecords.filter((r) => r.isHit).length;
      group.total = periodRecords.length;
      group.hitRate =
        group.total > 0 ? (group.hits / group.total).toFixed(4) : 0;
    }

    return groups;
  }

  static async getExemptionTrend(where, startDate, endDate, groupBy) {
    const records = await db.Exemption.findAll({
      where: {
        ...where,
        createdAt: {
          [Op.between]: [startDate, endDate],
        },
      },
      attributes: ['id', 'status', 'type', 'createdAt'],
    });

    const groups = ReportRules.groupByTimeRange(records, startDate, endDate, groupBy);

    for (const group of groups) {
      const periodRecords = records.filter((r) => {
        const dateKey = DateUtils.format(
          r.createdAt,
          groupBy === 'day' ? 'YYYY-MM-DD' : 'YYYY-MM'
        );
        return dateKey === group.period;
      });

      group.pending = periodRecords.filter((r) => r.status === EXEMPTION_STATUS.PENDING).length;
      group.approved = periodRecords.filter((r) => r.status === EXEMPTION_STATUS.APPROVED).length;
      group.rejected = periodRecords.filter((r) => r.status === EXEMPTION_STATUS.REJECTED).length;
      group.total = periodRecords.length;
    }

    return groups;
  }

  static async getSyncStatus(localVersion, businessLineId = null) {
    const where = {};
    if (businessLineId) {
      where.businessLineId = businessLineId;
    }

    const sharedVersions = await db.ShareVersion.findAll({
      where,
      attributes: ['id', 'versionNumber', 'status', 'publishedAt'],
    });

    return ReportRules.calculateSyncMetrics(localVersion, sharedVersions);
  }

  static async getRiskReport(filters = {}, requestContext) {
    const validation = ReportRules.validateReportParameters(filters);
    if (!validation.isValid) {
      throw new BadRequestError(validation.errors.join('; '));
    }

    const where = {};
    if (filters.businessLineId) {
      where.businessLineId = filters.businessLineId;
    }

    const highRiskBlacklists = await this.getHighRiskBlacklists(where, 10);
    const highRiskExemptions = await this.getHighRiskExemptions(where, 10);
    const statistics = await this.getRiskStatistics(where);

    return {
      period: {
        startDate: filters.startDate,
        endDate: filters.endDate,
      },
      statistics,
      highRiskBlacklists,
      highRiskExemptions,
      riskLevel: this.calculateOverallRiskLevel(statistics),
      generatedAt: new Date(),
    };
  }

  static async getHighRiskBlacklists(where = {}, limit = 10) {
    const blacklists = await db.Blacklist.findAll({
      where: {
        ...where,
        status: BLACKLIST_STATUS.ACTIVE,
        hitCount: {
          [Op.gt]: 5,
        },
      },
      include: [
        {
          model: db.Exemption,
          as: 'exemptions',
          attributes: ['id', 'status'],
        },
      ],
      order: [['hitCount', 'DESC']],
      limit,
    });

    return blacklists.map((b) => {
      const exemptionCount = b.exemptions?.filter(
        (e) => e.status === EXEMPTION_STATUS.APPROVED
      ).length || 0;

      const daysActive = b.createdAt
        ? DateUtils.diffInDays(new Date(), b.createdAt)
        : 0;

      return {
        id: b.id,
        memberIdentifier: b.memberIdentifier,
        memberName: b.memberName,
        hitCount: b.hitCount,
        exemptionCount,
        daysActive,
        reason: b.reason,
        sourceType: b.sourceType,
        riskLevel: ReportRules.calculateRiskLevel(b.hitCount, exemptionCount, daysActive),
        lastHitAt: b.lastHitAt,
        createdAt: b.createdAt,
      };
    });
  }

  static async getHighRiskExemptions(where = {}, limit = 10) {
    const exemptions = await db.Exemption.findAll({
      where: {
        ...where,
        status: EXEMPTION_STATUS.APPROVED,
        hitCount: {
          [Op.gt]: 0,
        },
      },
      include: [
        {
          model: db.Blacklist,
          as: 'blacklist',
          attributes: ['id', 'memberIdentifier', 'memberName', 'hitCount'],
        },
      ],
      order: [['hitCount', 'DESC']],
      limit,
    });

    return exemptions.map((e) => {
      const daysActive = e.approvedAt
        ? DateUtils.diffInDays(new Date(), e.approvedAt)
        : 0;

      const needsReview = e.type !== EXEMPTION_TYPE.PERMANENT && daysActive > 7;

      return {
        id: e.id,
        code: e.code,
        type: e.type,
        reason: e.reason,
        hitCount: e.hitCount,
        daysActive,
        needsReview,
        expiryDate: e.expiryDate,
        blacklist: e.blacklist,
      };
    });
  }

  static async getRiskStatistics(where = {}) {
    const [
      totalActiveBlacklists,
      totalActiveExemptions,
      totalHits,
      manuallyCorrectedCount,
    ] = await Promise.all([
      db.Blacklist.count({ ...where, status: BLACKLIST_STATUS.ACTIVE }),
      this.getActiveExemptionCount(where),
      db.HitRecord.count({ ...where, isHit: true }),
      db.Blacklist.count({ ...where, isManuallyCorrected: true }),
    ]);

    return {
      totalActiveBlacklists,
      totalActiveExemptions,
      totalHits,
      manuallyCorrectedCount,
      exemptionRatio:
        totalActiveBlacklists > 0
          ? (totalActiveExemptions / totalActiveBlacklists).toFixed(4)
          : 0,
    };
  }

  static calculateOverallRiskLevel(statistics) {
    let score = 0;

    if (statistics.totalActiveExemptions > 50) score += 3;
    else if (statistics.totalActiveExemptions > 20) score += 2;
    else if (statistics.totalActiveExemptions > 10) score += 1;

    if (statistics.totalHits > 1000) score += 3;
    else if (statistics.totalHits > 500) score += 2;
    else if (statistics.totalHits > 100) score += 1;

    if (statistics.exemptionRatio > 0.2) score += 2;
    else if (statistics.exemptionRatio > 0.1) score += 1;

    if (statistics.manuallyCorrectedCount > 20) score += 2;
    else if (statistics.manuallyCorrectedCount > 5) score += 1;

    if (score >= 8) return 'critical';
    if (score >= 5) return 'high';
    if (score >= 2) return 'medium';
    return 'low';
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

  static async getExemptionTypeBreakdown(where = {}) {
    const types = Object.values(EXEMPTION_TYPE);
    const breakdown = {};

    for (const type of types) {
      breakdown[type] = await db.Exemption.count({
        where: { ...where, type },
      });
    }

    return breakdown;
  }

  static async getActiveExemptionCount(where = {}) {
    const approved = await db.Exemption.findAll({
      where: {
        ...where,
        status: EXEMPTION_STATUS.APPROVED,
      },
    });

    return approved.filter((e) => {
      if (e.type === EXEMPTION_TYPE.PERMANENT) return true;
      return e.expiryDate && new Date() < new Date(e.expiryDate);
    }).length;
  }
}

module.exports = ReportService;
