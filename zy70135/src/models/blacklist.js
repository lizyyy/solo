const { BLACKLIST_STATUS, BLACKLIST_SOURCE_TYPE } = require('../core/constants');

module.exports = (sequelize, DataTypes) => {
  const Blacklist = sequelize.define(
    'Blacklist',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      memberIdentifier: {
        type: DataTypes.STRING(200),
        allowNull: false,
        comment: '会员标识(手机号/身份证号/用户ID等)',
      },
      identifierType: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: 'phone',
        comment: '标识类型',
      },
      memberName: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: '会员姓名',
      },
      status: {
        type: DataTypes.ENUM(...Object.values(BLACKLIST_STATUS)),
        allowNull: false,
        defaultValue: BLACKLIST_STATUS.ACTIVE,
        comment: '状态',
      },
      reason: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '加入黑名单原因',
      },
      sourceType: {
        type: DataTypes.ENUM(...Object.values(BLACKLIST_SOURCE_TYPE)),
        allowNull: false,
        defaultValue: BLACKLIST_SOURCE_TYPE.MANUAL,
        comment: '来源类型',
      },
      sourceReference: {
        type: DataTypes.STRING(200),
        allowNull: true,
        comment: '来源参考(订单号、事件ID等)',
      },
      sourceVersion: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: '来源版本号',
      },
      businessLineId: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: '所属业务线',
      },
      isShared: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: '是否共享到其他业务线',
      },
      isManuallyCorrected: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: '是否人工修正',
      },
      manualCorrectionReason: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '人工修正原因',
      },
      manualCorrectedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '人工修正时间',
      },
      manualCorrectedBy: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: '人工修正人',
      },
      hitCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: '命中次数',
      },
      lastHitAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '最后命中时间',
      },
      removedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '移除时间',
      },
      removedBy: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: '移除人',
      },
      removalReason: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '移除原因',
      },
      effectiveStatus: {
        type: DataTypes.VIRTUAL(DataTypes.STRING),
        comment: '有效状态(考虑豁免)',
      },
      metadata: {
        type: DataTypes.JSONB,
        defaultValue: {},
        comment: '扩展字段',
      },
    },
    {
      tableName: 'blacklists',
      paranoid: true,
      indexes: [
        {
          unique: true,
          fields: ['member_identifier', 'identifier_type', 'business_line_id'],
        },
        {
          fields: ['member_identifier'],
        },
        {
          fields: ['status'],
        },
        {
          fields: ['business_line_id'],
        },
        {
          fields: ['is_shared'],
        },
        {
          fields: ['is_manually_corrected'],
        },
        {
          fields: ['source_type'],
        },
        {
          fields: ['source_version'],
        },
      ],
    }
  );

  Blacklist.associate = (models) => {
    Blacklist.belongsTo(models.BusinessLine, {
      foreignKey: 'businessLineId',
      as: 'businessLine',
    });

    Blacklist.hasMany(models.BlacklistHistory, {
      foreignKey: 'blacklistId',
      as: 'histories',
    });

    Blacklist.hasMany(models.Exemption, {
      foreignKey: 'blacklistId',
      as: 'exemptions',
    });

    Blacklist.hasMany(models.HitRecord, {
      foreignKey: 'blacklistId',
      as: 'hitRecords',
    });

    Blacklist.hasMany(models.ShareVersionItem, {
      foreignKey: 'blacklistId',
      as: 'shareVersionItems',
    });

    Blacklist.hasMany(models.AuditLog, {
      foreignKey: 'entityId',
      as: 'auditLogs',
      scope: {
        entityType: 'blacklist',
      },
    });
  };

  Blacklist.prototype.hasActiveExemption = async function () {
    const { Exemption, EXEMPTION_STATUS } = sequelize.models;
    const count = await Exemption.count({
      where: {
        blacklistId: this.id,
        status: EXEMPTION_STATUS.APPROVED,
        $or: [
          { type: 'permanent' },
          { expiryDate: { $gt: new Date() } },
        ],
      },
    });
    return count > 0;
  };

  Blacklist.prototype.getActiveExemption = async function () {
    const { Exemption, EXEMPTION_STATUS } = sequelize.models;
    return await Exemption.findOne({
      where: {
        blacklistId: this.id,
        status: EXEMPTION_STATUS.APPROVED,
        $or: [
          { type: 'permanent' },
          { expiryDate: { $gt: new Date() } },
        ],
      },
    });
  };

  Blacklist.prototype.saveHistory = async function (operatorId, changeReason, transaction) {
    const { BlacklistHistory } = sequelize.models;
    return await BlacklistHistory.create(
      {
        blacklistId: this.id,
        memberIdentifier: this.memberIdentifier,
        identifierType: this.identifierType,
        memberName: this.memberName,
        status: this.status,
        reason: this.reason,
        sourceType: this.sourceType,
        sourceReference: this.sourceReference,
        sourceVersion: this.sourceVersion,
        businessLineId: this.businessLineId,
        isShared: this.isShared,
        isManuallyCorrected: this.isManuallyCorrected,
        manualCorrectionReason: this.manualCorrectionReason,
        hitCount: this.hitCount,
        removedAt: this.removedAt,
        removedBy: this.removedBy,
        removalReason: this.removalReason,
        operatorId,
        changeReason,
        snapshot: this.toJSON(),
      },
      { transaction }
    );
  };

  return Blacklist;
};
