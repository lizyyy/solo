module.exports = (sequelize, DataTypes) => {
  const HitRecord = sequelize.define(
    'HitRecord',
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
      blacklistStatus: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: '命中时黑名单状态',
      },
      effectiveStatus: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: '命中时有效状态',
      },
      isHit: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: '是否命中',
      },
      hitReason: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '命中原因说明',
      },
      businessLineId: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: '请求业务线',
      },
      requesterId: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: '请求人ID',
      },
      requesterName: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: '请求人名称',
      },
      requestContext: {
        type: DataTypes.STRING(200),
        allowNull: true,
        comment: '请求场景',
      },
      requestReference: {
        type: DataTypes.STRING(200),
        allowNull: true,
        comment: '请求参考(订单号等)',
      },
      ipAddress: {
        type: DataTypes.STRING(45),
        allowNull: true,
        comment: 'IP地址',
      },
      userAgent: {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: 'User Agent',
      },
      requestId: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: '请求ID',
      },
      sourceVersion: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: '请求时使用的版本号',
      },
      exemptionId: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: '关联豁免ID',
      },
      metadata: {
        type: DataTypes.JSONB,
        defaultValue: {},
        comment: '扩展字段',
      },
    },
    {
      tableName: 'hit_records',
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
          fields: ['is_hit'],
        },
        {
          fields: ['business_line_id'],
        },
        {
          fields: ['requester_id'],
        },
        {
          fields: ['created_at'],
        },
        {
          fields: ['source_version'],
        },
        {
          fields: ['created_at', 'is_hit', 'business_line_id'],
        },
      ],
    }
  );

  HitRecord.associate = (models) => {
    HitRecord.belongsTo(models.Blacklist, {
      foreignKey: 'blacklistId',
      as: 'blacklist',
    });

    HitRecord.belongsTo(models.BusinessLine, {
      foreignKey: 'businessLineId',
      as: 'businessLine',
    });

    HitRecord.belongsTo(models.User, {
      foreignKey: 'requesterId',
      as: 'requester',
    });

    HitRecord.belongsTo(models.Exemption, {
      foreignKey: 'exemptionId',
      as: 'exemption',
    });
  };

  return HitRecord;
};
