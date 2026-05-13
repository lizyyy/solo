const { sequelize, DataTypes } = require('../database');

const OperationLog = sequelize.define('OperationLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  entityType: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '实体类型: survey, reason, department, task, result'
  },
  entityId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '实体ID'
  },
  operation: {
    type: DataTypes.ENUM('create', 'update', 'delete', 'block', 'review', 'complete'),
    comment: '操作类型'
  },
  operator: {
    type: DataTypes.STRING,
    comment: '操作人'
  },
  operationTime: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: '操作时间'
  },
  beforeValue: {
    type: DataTypes.TEXT,
    comment: '修改前值（JSON）'
  },
  afterValue: {
    type: DataTypes.TEXT,
    comment: '修改后值（JSON）'
  },
  remark: {
    type: DataTypes.TEXT,
    comment: '备注'
  },
  changedFields: {
    type: DataTypes.TEXT,
    comment: '变更字段（JSON数组）'
  }
}, {
  tableName: 'operation_log',
  timestamps: false
});

module.exports = OperationLog;
