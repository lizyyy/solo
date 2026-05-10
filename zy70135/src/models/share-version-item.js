const { BLACKLIST_STATUS, BLACKLIST_SOURCE_TYPE } = require('../core/constants');

module.exports = (sequelize, DataTypes) => {
  const ShareVersionItem = sequelize.define(
    'ShareVersionItem',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      versionId: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: '版本ID',
      },
      blacklistId: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: '关联黑名单ID',
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
        comment: '状态',
      },
      reason: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '原因',
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
      businessLineId: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: '来源业务线',
      },
      changeType: {
        type: DataTypes.ENUM('added', 'removed', 'updated', 'unchanged'),
        allowNull: true,
        comment: '变更类型',
      },
      orderIndex: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: '排序索引',
      },
      snapshot: {
        type: DataTypes.JSONB,
        defaultValue: {},
        comment: '快照数据',
      },
    },
    {
      tableName: 'share_version_items',
      timestamps: true,
      updatedAt: false,
      indexes: [
        {
          fields: ['version_id'],
        },
        {
          fields: ['member_identifier'],
        },
        {
          fields: ['status'],
        },
        {
          fields: ['change_type'],
        },
        {
          fields: ['version_id', 'member_identifier'],
        },
      ],
    }
  );

  ShareVersionItem.associate = (models) => {
    ShareVersionItem.belongsTo(models.ShareVersion, {
      foreignKey: 'versionId',
      as: 'version',
    });

    ShareVersionItem.belongsTo(models.Blacklist, {
      foreignKey: 'blacklistId',
      as: 'blacklist',
    });

    ShareVersionItem.belongsTo(models.BusinessLine, {
      foreignKey: 'businessLineId',
      as: 'businessLine',
    });
  };

  return ShareVersionItem;
};
