const { BLACKLIST_STATUS, BLACKLIST_SOURCE_TYPE } = require('../core/constants');

module.exports = (sequelize, DataTypes) => {
  const BlacklistHistory = sequelize.define(
    'BlacklistHistory',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      blacklistId: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: '黑名单记录ID',
      },
      memberIdentifier: {
        type: DataTypes.STRING(200),
        allowNull: false,
        comment: '会员标识',
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
        comment: '状态快照',
      },
      reason: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '加入黑名单原因',
      },
      sourceType: {
        type: DataTypes.ENUM(...Object.values(BLACKLIST_SOURCE_TYPE)),
        allowNull: false,
        comment: '来源类型',
      },
      sourceReference: {
        type: DataTypes.STRING(200),
        allowNull: true,
        comment: '来源参考',
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
        comment: '是否共享',
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
      hitCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: '命中次数',
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
      operatorId: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: '操作人ID',
      },
      changeReason: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '变更原因',
      },
      snapshot: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: '完整快照',
      },
    },
    {
      tableName: 'blacklist_histories',
      timestamps: true,
      updatedAt: false,
      indexes: [
        {
          fields: ['blacklist_id'],
        },
        {
          fields: ['member_identifier'],
        },
        {
          fields: ['status'],
        },
        {
          fields: ['operator_id'],
        },
        {
          fields: ['created_at'],
        },
      ],
    }
  );

  BlacklistHistory.associate = (models) => {
    BlacklistHistory.belongsTo(models.Blacklist, {
      foreignKey: 'blacklistId',
      as: 'blacklist',
    });

    BlacklistHistory.belongsTo(models.User, {
      foreignKey: 'operatorId',
      as: 'operator',
    });
  };

  return BlacklistHistory;
};
