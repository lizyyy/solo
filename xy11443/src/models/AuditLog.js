const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  batchId: {
    type: DataTypes.UUID,
    comment: '批次ID'
  },
  batchNo: {
    type: DataTypes.STRING,
    comment: '批次号'
  },
  entityType: {
    type: DataTypes.ENUM('batch', 'delivery_note', 'weighing_record', 'photo', 'loss_record'),
    allowNull: false,
    comment: '实体类型'
  },
  entityId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: '实体ID'
  },
  entityNo: {
    type: DataTypes.STRING,
    comment: '实体编号'
  },
  action: {
    type: DataTypes.ENUM('create', 'update', 'delete', 'submit', 'withdraw', 'freeze', 'unfreeze', 'reconcile', 'confirm', 'adjust', 'export', 'ignore', 'overwrite', 'append'),
    allowNull: false,
    comment: '操作类型'
  },
  actionDetail: {
    type: DataTypes.STRING,
    comment: '操作详情'
  },
  beforeData: {
    type: DataTypes.TEXT,
    comment: '操作前数据(JSON)'
  },
  afterData: {
    type: DataTypes.TEXT,
    comment: '操作后数据(JSON)'
  },
  diffData: {
    type: DataTypes.TEXT,
    comment: '差异数据(JSON)'
  },
  operator: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '操作人'
  },
  operatorRole: {
    type: DataTypes.STRING,
    comment: '操作人角色'
  },
  ipAddress: {
    type: DataTypes.STRING,
    comment: 'IP地址'
  },
  userAgent: {
    type: DataTypes.STRING,
    comment: '用户代理'
  },
  remark: {
    type: DataTypes.TEXT,
    comment: '备注'
  },
  requestId: {
    type: DataTypes.STRING,
    comment: '请求ID'
  }
}, {
  tableName: 'audit_logs',
  indexes: [
    { fields: ['batch_id'] },
    { fields: ['batch_no'] },
    { fields: ['entity_type'] },
    { fields: ['entity_id'] },
    { fields: ['action'] },
    { fields: ['operator'] },
    { fields: ['created_at'] }
  ]
});

module.exports = AuditLog;
