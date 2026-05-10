const db = require('../models');
const { Op } = require('sequelize');
const VersionRules = require('../core/version-rules');
const {
  SHARE_VERSION_STATUS,
  BLACKLIST_STATUS,
  AUDIT_ACTION,
} = require('../core/constants');
const {
  NotFoundError,
  ConflictError,
  BusinessRuleError,
} = require('../utils/errors');
const AuditService = require('./audit-service');
const crypto = require('crypto');

class VersionService {
  static async createDraft(data, requestContext) {
    const existingVersions = await db.ShareVersion.findAll({
      where: {
        status: [SHARE_VERSION_STATUS.DRAFT, SHARE_VERSION_STATUS.PUBLISHED],
      },
      order: [['createdAt', 'DESC']],
    });

    const versionNumber = VersionRules.generateVersionNumber(existingVersions);

    const version = await db.ShareVersion.create({
      versionNumber,
      name: data.name || `版本 ${versionNumber}`,
      description: data.description,
      status: SHARE_VERSION_STATUS.DRAFT,
      businessLineId: requestContext.businessLineId,
    });

    await AuditService.recordVersionAction(
      AUDIT_ACTION.VERSION_PUBLISH,
      version,
      requestContext,
      {
        action: 'create_draft',
        versionNumber,
      }
    );

    return this.enrichVersion(version);
  }

  static async addItemsToVersion(versionId, items, requestContext) {
    const version = await db.ShareVersion.findByPk(versionId);

    if (!version) {
      throw new NotFoundError('版本不存在');
    }

    if (version.status !== SHARE_VERSION_STATUS.DRAFT) {
      throw new ConflictError('只能向草稿版本添加项目');
    }

    VersionRules.validateSnapshot(items);

    await db.sequelize.transaction(async (t) => {
      await db.ShareVersionItem.destroy({
        where: { versionId },
        transaction: t,
      });

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        await db.ShareVersionItem.create(
          {
            versionId,
            blacklistId: item.blacklistId,
            memberIdentifier: item.memberIdentifier,
            identifierType: item.identifierType || 'phone',
            memberName: item.memberName,
            status: item.status,
            reason: item.reason,
            sourceType: item.sourceType,
            sourceReference: item.sourceReference,
            businessLineId: item.businessLineId || requestContext.businessLineId,
            orderIndex: i,
            snapshot: item,
          },
          { transaction: t }
        );
      }
    });

    await this.updateVersionStats(versionId);

    return await this.findById(versionId, requestContext);
  }

  static async buildVersionFromCurrentState(versionId, requestContext) {
    const version = await db.ShareVersion.findByPk(versionId);

    if (!version) {
      throw new NotFoundError('版本不存在');
    }

    if (version.status !== SHARE_VERSION_STATUS.DRAFT) {
      throw new ConflictError('只能构建草稿版本');
    }

    const blacklists = await db.Blacklist.findAll({
      where: {
        isShared: true,
        status: {
          [Op.ne]: BLACKLIST_STATUS.INACTIVE,
        },
      },
      order: [['createdAt', 'ASC']],
    });

    const items = blacklists.map((b) => ({
      blacklistId: b.id,
      memberIdentifier: b.memberIdentifier,
      identifierType: b.identifierType,
      memberName: b.memberName,
      status: b.status,
      reason: b.reason,
      sourceType: b.sourceType,
      sourceReference: b.sourceReference,
      businessLineId: b.businessLineId,
    }));

    return await this.addItemsToVersion(versionId, items, requestContext);
  }

  static async calculateVersionDiff(versionId, requestContext) {
    const version = await db.ShareVersion.findByPk(versionId, {
      include: [
        {
          model: db.ShareVersionItem,
          as: 'items',
          order: [['orderIndex', 'ASC']],
        },
      ],
    });

    if (!version) {
      throw new NotFoundError('版本不存在');
    }

    if (!version.previousVersionId) {
      const items = version.items || [];
      return {
        added: items,
        removed: [],
        updated: [],
        unchanged: [],
        summary: {
          total: items.length,
          added: items.length,
          removed: 0,
          updated: 0,
          unchanged: 0,
        },
      };
    }

    const previousVersion = await db.ShareVersion.findByPk(
      version.previousVersionId,
      {
        include: [
          {
            model: db.ShareVersionItem,
            as: 'items',
            order: [['orderIndex', 'ASC']],
          },
        ],
      }
    );

    if (!previousVersion) {
      throw new NotFoundError('上一个版本不存在');
    }

    const newSnapshot = (version.items || []).map((i) => ({
      memberIdentifier: i.memberIdentifier,
      status: i.status,
      source: i.sourceType,
      reason: i.reason,
    }));

    const oldSnapshot = (previousVersion.items || []).map((i) => ({
      memberIdentifier: i.memberIdentifier,
      status: i.status,
      source: i.sourceType,
      reason: i.reason,
    }));

    return VersionRules.calculateDiff(oldSnapshot, newSnapshot);
  }

  static async publish(id, requestContext) {
    const version = await db.ShareVersion.findByPk(id, {
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

    const latestPublished = await db.ShareVersion.findOne({
      where: { status: SHARE_VERSION_STATUS.PUBLISHED },
      order: [['publishedAt', 'DESC']],
    });

    const diff = await this.calculateVersionDiff(id, requestContext);
    const hasChanges = VersionRules.hasSignificantChanges(diff);

    VersionRules.canPublish(version.status, hasChanges || !latestPublished);

    const published = await db.sequelize.transaction(async (t) => {
      if (latestPublished) {
        await version.update(
          { previousVersionId: latestPublished.id },
          { transaction: t }
        );
      }

      await version.update(
        {
          status: SHARE_VERSION_STATUS.PUBLISHED,
          itemCount: version.items?.length || 0,
          addedCount: diff.summary.added,
          removedCount: diff.summary.removed,
          updatedCount: diff.summary.updated,
          diffSummary: diff.summary,
          snapshotHash: this.calculateSnapshotHash(version.items || []),
          publishedBy: requestContext.userId,
          publishedAt: new Date(),
        },
        { transaction: t }
      );

      for (let i = 0; i < (version.items || []).length; i++) {
        const item = version.items[i];
        let changeType = 'unchanged';

        if (diff.added.some((a) => a.memberIdentifier === item.memberIdentifier)) {
          changeType = 'added';
        } else if (diff.removed.some((r) => r.memberIdentifier === item.memberIdentifier)) {
          changeType = 'removed';
        } else if (diff.updated.some((u) => u.after.memberIdentifier === item.memberIdentifier)) {
          changeType = 'updated';
        }

        await item.update({ changeType }, { transaction: t });
      }

      await AuditService.recordVersionAction(
        AUDIT_ACTION.VERSION_PUBLISH,
        version,
        requestContext,
        {
          versionNumber: version.versionNumber,
          itemCount: version.itemCount,
          diff: diff.summary,
        }
      );

      return version;
    });

    return this.enrichVersion(published);
  }

  static async archive(id, requestContext) {
    const version = await db.ShareVersion.findByPk(id);

    if (!version) {
      throw new NotFoundError('版本不存在');
    }

    VersionRules.canArchive(version.status);

    const archived = await db.sequelize.transaction(async (t) => {
      await version.update(
        {
          status: SHARE_VERSION_STATUS.ARCHIVED,
          archivedBy: requestContext.userId,
          archivedAt: new Date(),
        },
        { transaction: t }
      );

      await AuditService.recordVersionAction(
        AUDIT_ACTION.VERSION_ARCHIVE,
        version,
        requestContext,
        {
          versionNumber: version.versionNumber,
        }
      );

      return version;
    });

    return this.enrichVersion(archived);
  }

  static async findById(id, requestContext) {
    const version = await db.ShareVersion.findByPk(id, {
      include: [
        {
          model: db.BusinessLine,
          as: 'businessLine',
          attributes: ['id', 'code', 'name'],
        },
        {
          model: db.User,
          as: 'publisher',
          attributes: ['id', 'username', 'displayName', 'role'],
        },
        {
          model: db.ShareVersionItem,
          as: 'items',
          order: [['orderIndex', 'ASC']],
        },
      ],
    });

    if (!version) {
      throw new NotFoundError('版本不存在');
    }

    return this.enrichVersion(version);
  }

  static async list(filters = {}, options = {}, requestContext) {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'DESC' } = options;
    const offset = (page - 1) * limit;

    const where = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.versionNumber) {
      where.versionNumber = {
        [Op.like]: `%${filters.versionNumber}%`,
      };
    }

    if (filters.businessLineId) {
      where.businessLineId = filters.businessLineId;
    }

    if (filters.publishedBy) {
      where.publishedBy = filters.publishedBy;
    }

    const { count, rows } = await db.ShareVersion.findAndCountAll({
      where,
      include: [
        {
          model: db.BusinessLine,
          as: 'businessLine',
          attributes: ['id', 'code', 'name'],
        },
        {
          model: db.User,
          as: 'publisher',
          attributes: ['id', 'username', 'displayName', 'role'],
        },
      ],
      order: [[sortBy, sortOrder]],
      limit,
      offset,
    });

    const enrichedItems = rows.map((item) => this.enrichVersion(item));

    return {
      items: enrichedItems,
      total: count,
      page,
      limit,
    };
  }

  static async getLatestPublished() {
    const version = await db.ShareVersion.findOne({
      where: { status: SHARE_VERSION_STATUS.PUBLISHED },
      order: [['publishedAt', 'DESC']],
      include: [
        {
          model: db.ShareVersionItem,
          as: 'items',
          order: [['orderIndex', 'ASC']],
        },
      ],
    });

    if (!version) {
      return null;
    }

    return this.enrichVersion(version);
  }

  static async deleteDraft(id, requestContext) {
    const version = await db.ShareVersion.findByPk(id);

    if (!version) {
      throw new NotFoundError('版本不存在');
    }

    VersionRules.canDelete(version.status);

    await version.destroy();

    return true;
  }

  static calculateSnapshotHash(items) {
    const sortedItems = [...items].sort((a, b) =>
      a.memberIdentifier.localeCompare(b.memberIdentifier)
    );

    const content = sortedItems
      .map((item) => `${item.memberIdentifier}:${item.status}`)
      .join('|');

    return crypto.createHash('sha256').update(content).digest('hex');
  }

  static async updateVersionStats(versionId) {
    const version = await db.ShareVersion.findByPk(versionId, {
      include: [
        {
          model: db.ShareVersionItem,
          as: 'items',
        },
      ],
    });

    if (!version) return;

    const items = version.items || [];

    await version.update({
      itemCount: items.length,
    });
  }

  static enrichVersion(version) {
    const data = version.toJSON();

    if (data.items) {
      data.itemCount = data.items.length;
    }

    return data;
  }

  static async getStatistics(filters = {}) {
    const where = {};

    if (filters.businessLineId) {
      where.businessLineId = filters.businessLineId;
    }

    const [totalCount, draftCount, publishedCount, archivedCount] =
      await Promise.all([
        db.ShareVersion.count({ where }),
        db.ShareVersion.count({ where: { ...where, status: SHARE_VERSION_STATUS.DRAFT } }),
        db.ShareVersion.count({ where: { ...where, status: SHARE_VERSION_STATUS.PUBLISHED } }),
        db.ShareVersion.count({ where: { ...where, status: SHARE_VERSION_STATUS.ARCHIVED } }),
      ]);

    return {
      totalCount,
      draftCount,
      publishedCount,
      archivedCount,
    };
  }
}

module.exports = VersionService;
