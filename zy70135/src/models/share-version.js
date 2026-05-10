const { SHARE_VERSION_STATUS } = require('../core/constants');

module.exports = (sequelize, DataTypes) => {
  const ShareVersion = sequelize.define(
    'ShareVersion',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      versionNumber: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        comment: '版本号',
      },
      name: {
        type: DataTypes.STRING(200),
        allowNull: true,
        comment: '版本名称',
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '版本描述',
      },
      status: {
        type: DataTypes.ENUM(...Object.values(SHARE_VERSION_STATUS)),
        allowNull: false,
        defaultValue: SHARE_VERSION_STATUS.DRAFT,
        comment: '状态',
      },
      businessLineId: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: '所属业务线',
      },
      itemCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: '记录总数',
      },
      addedCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: '新增数量',
      },
      removedCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: '移除数量',
      },
      updatedCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: '更新数量',
      },
      previousVersionId: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: '上一个版本ID',
      },
      diffSummary: {
        type: DataTypes.JSONB,
        defaultValue: {},
        comment: '变更摘要',
      },
      publishedBy: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: '发布人',
      },
      publishedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '发布时间',
      },
      archivedBy: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: '归档人',
      },
      archivedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '归档时间',
      },
      snapshotHash: {
        type: DataTypes.STRING(64),
        allowNull: true,
        comment: '快照哈希值',
      },
      metadata: {
        type: DataTypes.JSONB,
        defaultValue: {},
        comment: '扩展字段',
      },
    },
    {
      tableName: 'share_versions',
      paranoid: true,
      indexes: [
        {
          unique: true,
          fields: ['version_number'],
        },
        {
          fields: ['status'],
        },
        {
          fields: ['business_line_id'],
        },
        {
          fields: ['published_at'],
        },
        {
          fields: ['previous_version_id'],
        },
      ],
    }
  );

  ShareVersion.associate = (models) => {
    ShareVersion.belongsTo(models.BusinessLine, {
      foreignKey: 'businessLineId',
      as: 'businessLine',
    });

    ShareVersion.belongsTo(models.ShareVersion, {
      foreignKey: 'previousVersionId',
      as: 'previousVersion',
    });

    ShareVersion.belongsTo(models.User, {
      foreignKey: 'publishedBy',
      as: 'publisher',
    });

    ShareVersion.belongsTo(models.User, {
      foreignKey: 'archivedBy',
      as: 'archiver',
    });

    ShareVersion.hasMany(models.ShareVersionItem, {
      foreignKey: 'versionId',
      as: 'items',
    });
  };

  return ShareVersion;
};
