const { AUDIT_ACTION, AUDIT_ENTITY_TYPE } = require('../core/constants');

module.exports = (sequelize, DataTypes) => {
  const AuditLog = sequelize.define(
    'AuditLog',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      action: {
        type: DataTypes.ENUM(...Object.values(AUDIT_ACTION)),
        allowNull: false,
        comment: '操作类型',
      },
      entityType: {
        type: DataTypes.ENUM(...Object.values(AUDIT_ENTITY_TYPE)),
        allowNull: false,
        comment: '实体类型',
      },
      entityId: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: '实体ID',
      },
      entitySnapshot: {
        type: DataTypes.JSONB,
        defaultValue: {},
        comment: '实体快照',
      },
      actorId: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: '操作人ID',
      },
      actorName: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: '操作人名称',
      },
      actorRole: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: '操作人角色',
      },
      businessLineId: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: '所属业务线',
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
      metadata: {
        type: DataTypes.JSONB,
        defaultValue: {},
        comment: '元数据(原因、备注等)',
      },
    },
    {
      tableName: 'audit_logs',
      timestamps: true,
      updatedAt: false,
      indexes: [
        {
          fields: ['action'],
        },
        {
          fields: ['entity_type', 'entity_id'],
        },
        {
          fields: ['actor_id'],
        },
        {
          fields: ['business_line_id'],
        },
        {
          fields: ['created_at'],
        },
        {
          fields: ['created_at', 'entity_type', 'action'],
        },
      ],
    }
  );

  AuditLog.associate = (models) => {
    AuditLog.belongsTo(models.User, {
      foreignKey: 'actorId',
      as: 'actor',
    });
  };

  return AuditLog;
};
