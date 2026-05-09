const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class AuditLog extends Model {}

AuditLog.init({
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  claimId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'claims',
      key: 'id'
    }
  },
  action: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '操作类型: CREATE, UPDATE_RATIO, ALLOCATE, CONFIRM, PAY, CANCEL, ROLLBACK'
  },
  operator: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '操作人'
  },
  requestId: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '请求ID'
  },
  previousStatus: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: '操作前状态'
  },
  newStatus: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: '操作后状态'
  },
  previousData: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '操作前数据快照'
  },
  newData: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '操作后数据快照'
  },
  success: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    comment: '操作是否成功'
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '错误信息（失败时）'
  },
  rollbackVersion: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '回滚目标版本号（如果是回滚操作）'
  }
}, {
  sequelize,
  modelName: 'AuditLog',
  tableName: 'audit_logs',
  timestamps: true,
  indexes: [
    {
      fields: ['claimId']
    },
    {
      fields: ['operator']
    },
    {
      fields: ['createdAt']
    }
  ]
});

module.exports = AuditLog;
